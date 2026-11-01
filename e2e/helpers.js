import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sampleCsvPath = path.join(repoRoot, 'sample.csv');

export async function captureVisualEvidence(page, testInfo, name, options = {}) {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const evidenceDir = path.join(repoRoot, 'artifacts', 'visual', testInfo.project.name);
  const evidencePath = path.join(evidenceDir, `${safeName}.png`);

  await mkdir(evidenceDir, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: evidencePath,
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    ...options,
  });
  await testInfo.attach(name, { path: evidencePath, contentType: 'image/png' });

  return evidencePath;
}

export async function gotoCleanApp(page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('skipSync', '1');
  });
  await page.reload();
}

export async function importSampleCsv(page) {
  await page.locator('input[type="file"]').setInputFiles(sampleCsvPath);
  await expect(page.getByRole('heading', { name: 'Ready to import' })).toBeVisible();
  await page.getByRole('button', { name: 'Merge safely' }).click();
  await expect(page.getByRole('heading', { name: 'Import report' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}

export async function quickStartLowerBodyWorkout(page) {
  await page.getByRole('button', { name: /Preview Lower Body B/ }).click();
  await page.getByRole('button', { name: 'Start Now' }).click();
  await expect(page.getByRole('button', { name: 'Finish (0/7 sets)' })).toBeVisible();
}

export async function completeNextSet(page) {
  await page.getByRole('button', { name: 'Mark complete' }).first().click();
  const skipRest = page.getByRole('button', { name: 'Skip rest' });
  if (await skipRest.isVisible()) {
    await skipRest.click();
  }
}

export async function expectNoDocumentHorizontalOverflow(page) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

export async function expectBottomNavVisible(page) {
  for (const label of ['Training', 'Planner', 'History', 'Stats', 'Library', 'Settings']) {
    await expect(page.locator('.navbar__tab', { hasText: label })).toBeVisible();
  }
}

export async function mockCoachSync(page, state) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const payload = route.request().postDataJSON();
    if (url.pathname.endsWith('/sync/conflicts') && method === 'GET') {
      return route.fulfill({ json: { revision: state.revision, conflicts: state.conflicts } });
    }
    if (/\/sync\/conflicts\/[^/]+\/resolve$/.test(url.pathname)) {
      if (state.failResolve) return route.fulfill({ status: 409, json: { error: 'Data changed. Refresh conflicts before choosing.' } });
      const conflict = state.conflicts[0];
      state.sections[conflict.key].data[conflict.path[0]] = conflict[payload.choice].value;
      state.conflicts = [];
      state.revision = 'b'.repeat(64);
      return route.fulfill({ json: { ok: true, revision: state.revision } });
    }
    if (url.pathname.endsWith('/data') && method === 'GET') {
      state.pulls = (state.pulls || 0) + 1;
      return route.fulfill({ json: state.ready === false ? {} : state.sections });
    }
    if (url.pathname.endsWith('/data') && method === 'PUT') return route.fulfill({ json: { ok: true, data: state.sections, conflicts: state.conflicts } });
    if (url.pathname.includes('/data/') && ['PUT', 'POST'].includes(method)) return route.fulfill({ json: { ok: true, ...state.sections[url.pathname.split('/').pop()], conflicts: state.conflicts } });
    return route.fulfill({ json: { status: 'ok' } });
  });
}

export async function mountCoachFixture(page, state) {
  state.ready = false;
  await mockCoachSync(page, state);
  await page.addInitScript(() => sessionStorage.setItem('skipSync', '1'));
  await gotoCleanApp(page);
  await page.evaluate((sections) => {
    for (const [key, entry] of Object.entries(sections)) if (entry.data !== null) localStorage.setItem(key, JSON.stringify(entry.data));
    localStorage.setItem('sync_protocol_version', '2');
    localStorage.setItem('sync_baselines', JSON.stringify(Object.fromEntries(Object.entries(sections).map(([key, entry]) => [key, entry.data]))));
  }, state.sections);
  state.ready = true;
  await page.reload();
}
