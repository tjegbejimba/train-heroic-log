import { test, expect } from '@playwright/test';
import {
  captureVisualEvidence,
  gotoCleanApp,
  importSampleCsv,
  quickStartLowerBodyWorkout,
} from './helpers';

// Priority 2 of the harden pass: the full-screen rest timer intentionally
// owns the screen, but a tap that lands on its own background must never
// disappear silently — it must surface a clear cue pointing at Skip.

test('@visual rest timer is a labelled dialog and a background tap shows a Skip cue instead of failing silently', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await quickStartLowerBodyWorkout(page);

  await page.getByRole('button', { name: 'Mark complete' }).first().click();

  const timer = page.getByRole('dialog', { name: /rest timer/i });
  await expect(timer).toBeVisible();

  // Tap the overlay's own background (top padding area, not a control).
  const box = await timer.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + 8);

  const cue = page.getByRole('status');
  await expect(cue).toBeVisible();
  await expect(cue).toContainText(/rest is active/i);
  await expect(cue).toContainText(/skip/i);
  await captureVisualEvidence(page, testInfo, 'rest-timer-blocked-tap-cue');

  // The blocked tap must not have paused the timer or skipped rest.
  await expect(page.getByText('PAUSED')).toHaveCount(0);
  await expect(timer).toBeVisible();

  // Skip still works normally afterward.
  await page.getByRole('button', { name: 'Skip rest' }).click();
  await expect(timer).toHaveCount(0);
});

test('Escape on the rest timer skips it (keyboard parity with the Skip button)', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await quickStartLowerBodyWorkout(page);

  await page.getByRole('button', { name: 'Mark complete' }).first().click();
  const timer = page.getByRole('dialog', { name: /rest timer/i });
  await expect(timer).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(timer).toHaveCount(0);
});
