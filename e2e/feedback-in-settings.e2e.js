import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv, expectBottomNavVisible, captureVisualEvidence } from './helpers.js';

test.describe('Feedback lives in Settings, not primary navigation', () => {
  test('@visual bottom nav shows exactly six labelled destinations and no Feedback action', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);

    await expectBottomNavVisible(page);
    await expect(page.locator('.navbar__tab')).toHaveCount(6);
    await expect(page.locator('.feedback-fab')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /feedback/i })).toHaveCount(0);

    await captureVisualEvidence(page, testInfo, 'nav-six-destinations-no-feedback');
  });

  test('Feedback action is absent from every primary view', async ({ page }) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);

    for (const viewName of ['Training', 'Planner', 'History', 'Stats', 'Library']) {
      await page.getByRole('button', { name: viewName }).click();
      await expect(page.locator('.navbar__tab')).toHaveCount(6);
      await expect(page.getByRole('button', { name: /send feedback/i })).toHaveCount(0);
    }
  });

  test('@visual Settings has a clearly labelled Feedback section that opens the feedback form', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);

    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // A dedicated, headed Feedback section (icon + heading + description),
    // consistent with every other settings section - not a bare button.
    await expect(page.getByRole('heading', { name: 'Feedback', level: 2 })).toBeVisible();

    const feedbackButton = page.locator('.settings-view__content .btn').filter({ hasText: 'Send Feedback' });
    await feedbackButton.scrollIntoViewIfNeeded();
    await expect(feedbackButton).toBeVisible();
    await captureVisualEvidence(page, testInfo, 'settings-feedback-section');

    await feedbackButton.click();

    await expect(page.getByRole('heading', { name: 'Send Feedback' })).toBeVisible();
    await captureVisualEvidence(page, testInfo, 'settings-feedback-modal-open');

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Send Feedback' })).not.toBeVisible();
  });
});
