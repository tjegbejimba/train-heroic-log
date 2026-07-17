import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { gotoCleanApp, importSampleCsv, captureVisualEvidence } from './helpers.js';

// Regression coverage for every Settings action that flows through the
// offline-persistence authority after the legacy `storage/index` path and the
// sync circular dependency were removed: export, import (restore), manual pull,
// manual push, selective clear, and (via settings-visual.e2e.js) clear all.
// Playwright runs each test on both the desktop (chromium) and mobile
// (mobile-chrome / Pixel 5) projects, so these are desktop + mobile checks.

/** Open Settings from the bottom navigation. */
async function openSettings(page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
}

test.describe('Settings persistence regression @visual', () => {
  test('Export Backup writes a complete snapshot through the authority', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);
    await openSettings(page);

    const exportButton = page.getByRole('button', { name: /Export Backup/ });
    await exportButton.scrollIntoViewIfNeeded();

    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();
    const download = await downloadPromise;
    const backupPath = testInfo.outputPath('exported-backup.json');
    await download.saveAs(backupPath);

    // The exported JSON is a full snapshot read back through readByKey.
    const backup = await download.createReadStream().then(streamToJson);
    expect(Object.keys(backup).sort()).toEqual(
      ['th_logs', 'th_schedule', 'th_templates', 'th_workouts', 'th_yt_links'].sort()
    );
    // Imported workouts and templates are present…
    expect(Object.keys(backup.th_workouts).length).toBeGreaterThan(0);
    expect(Object.keys(backup.th_templates).length).toBeGreaterThan(0);
    // …and the in-progress recovery session is never exported.
    expect(backup).not.toHaveProperty('th_active');

    await expect(page.getByText('Backup exported!')).toBeVisible();
    await captureVisualEvidence(page, testInfo, 'settings-export-backup');
  });

  test('Restore from Backup persists through the authority and survives reload', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);

    // A recognizable backup fixture on disk. Restoring must overwrite the
    // current sections through writeByKey and survive the reload without a
    // startup pull merging over it (skipSync).
    const fixturePath = testInfo.outputPath('restore-fixture.json');
    const restoredTemplates = { restored1: { id: 'restored1', name: 'Restored Split', blocks: [] } };
    writeFileSync(
      fixturePath,
      JSON.stringify({
        th_templates: restoredTemplates,
        th_workouts: {},
        th_schedule: {},
        th_logs: {},
        th_yt_links: {},
      })
    );

    await openSettings(page);
    const restoreButton = page.getByRole('button', { name: 'Restore from Backup' });
    await restoreButton.scrollIntoViewIfNeeded();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await restoreButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);

    // Confirm the destructive restore.
    await expect(page.getByRole('heading', { name: 'Restore from backup?' })).toBeVisible();
    await captureVisualEvidence(page, testInfo, 'settings-restore-confirm');
    await page.getByRole('button', { name: 'Restore', exact: true }).click();

    // Emptying th_workouts sends the app back to the import screen after reload.
    await expect(page.getByRole('heading', { name: 'Import TrainHeroic CSV' })).toBeVisible();

    // The restored templates persisted through the authority and were not
    // overwritten by a startup pull.
    const persistedTemplates = await page.evaluate(() => localStorage.getItem('th_templates'));
    expect(JSON.parse(persistedTemplates)).toEqual(restoredTemplates);
    const persistedWorkouts = await page.evaluate(() => localStorage.getItem('th_workouts'));
    expect(JSON.parse(persistedWorkouts)).toEqual({});
  });

  test('Selective clear deletes only the chosen sections', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);
    await openSettings(page);

    await page.getByRole('button', { name: 'Clear Data...' }).click();
    await expect(page.getByRole('heading', { name: 'Clear Data' })).toBeVisible();

    // Deselect everything, then re-select only Workouts and Schedule.
    await page.locator('.settings-clear-modal__check--all').click();
    await page.locator('.settings-clear-modal__checks label', { hasText: 'Workouts' }).click();
    await page.locator('.settings-clear-modal__checks label', { hasText: 'Schedule' }).click();

    await captureVisualEvidence(page, testInfo, 'settings-selective-clear');

    // Only two sections selected → the button reflects the count.
    await page.getByRole('button', { name: 'Delete (2)' }).click();

    // The reload lands on the import screen because workouts were cleared.
    await expect(page.getByRole('heading', { name: 'Import TrainHeroic CSV' })).toBeVisible();

    const state = await page.evaluate(() => ({
      workouts: localStorage.getItem('th_workouts'),
      schedule: localStorage.getItem('th_schedule'),
      templates: localStorage.getItem('th_templates'),
    }));
    // Cleared sections are gone…
    expect(state.workouts).toBeNull();
    expect(state.schedule).toBeNull();
    // …while an unselected section (templates) survives the selective clear.
    expect(JSON.parse(state.templates && state.templates)).not.toEqual({});
    expect(Object.keys(JSON.parse(state.templates)).length).toBeGreaterThan(0);
  });
});

test.describe('Settings manual sync controls', () => {
  // The app registers a service worker (`public/sw.js`) that answers GET requests
  // network-first. Service-worker-originated fetches bypass Playwright's
  // `page.route`, so without this the stubbed GET /api/data would fall through to
  // the dev server's SPA fallback (HTML) and the pull would report "offline".
  // Blocking the SW keeps all fetches on the page where the route can intercept.
  test.use({ serviceWorkers: 'block' });

  test('Pull and Push route through the authority replication facade', async ({ page }) => {
    const pushedPayloads = [];
    // Stub the entire NAS API with one handler so the test never makes a live
    // call. Health + empty pull keep the app "online" and up to date; bulk PUTs
    // capture their payload.
    await page.route('**/api/**', (route) => {
      const request = route.request();
      const url = request.url();
      const method = request.method();
      if (url.includes('/api/health')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      }
      if (method === 'PUT' && url.endsWith('/api/data')) {
        pushedPayloads.push(request.postData() || '');
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      }
      if (method === 'GET' && url.endsWith('/api/data')) {
        // Server has nothing new → pull reports "up to date".
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      // Per-key debounced pushes from the import.
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await gotoCleanApp(page);
    await importSampleCsv(page);
    await openSettings(page);

    const pullButton = page.getByRole('button', { name: 'Pull from Server' });
    await pullButton.scrollIntoViewIfNeeded();
    await pullButton.click();
    await expect(page.getByText('Already up to date')).toBeVisible();

    await page.getByRole('button', { name: 'Push to Server' }).click();
    await expect(page.getByText('Pushed to server!')).toBeVisible();

    // The manual push sent real durable data (the imported workouts) to the
    // bulk endpoint via pushAllReplication → the sync engine.
    expect(pushedPayloads.length).toBeGreaterThan(0);
    expect(pushedPayloads.some((p) => p.includes('th_workouts'))).toBe(true);
  });
});

/** Collect a Node readable stream and parse it as JSON. */
async function streamToJson(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}
