import { test, expect } from '@playwright/test';
import {
  captureVisualEvidence,
  gotoCleanApp,
  importSampleCsv,
  quickStartLowerBodyWorkout,
} from './helpers';

test('@visual rest starts automatically without covering the next set', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await quickStartLowerBodyWorkout(page);

  await page.getByRole('button', { name: 'Mark complete' }).first().click();

  const timer = page.getByRole('region', { name: 'Rest timer' });
  await expect(timer).toBeVisible();
  await expect(page.getByRole('dialog', { name: /rest timer/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark complete' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Pause timer' }).click();
  await expect(timer.getByText('Rest paused')).toBeVisible();
  await page.getByRole('button', { name: 'Resume timer' }).click();
  await captureVisualEvidence(page, testInfo, 'compact-rest-running');
  await page.getByRole('button', { name: 'Skip rest' }).click();
  await expect(timer).toHaveCount(0);
});

test('logging another set while resting remains possible', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await quickStartLowerBodyWorkout(page);

  await page.getByRole('button', { name: 'Mark complete' }).first().click();
  const timer = page.getByRole('region', { name: 'Rest timer' });
  await expect(timer).toBeVisible();
  await page.getByRole('button', { name: 'Mark complete' }).first().click();
  await expect(page.getByRole('button', { name: 'Finish (2/7 sets)' })).toBeVisible();
  await expect(timer).toBeVisible();
});
