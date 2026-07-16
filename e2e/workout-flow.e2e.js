import { test, expect } from '@playwright/test';
import { completeNextSet, gotoCleanApp, importSampleCsv, quickStartLowerBodyWorkout } from './helpers';

test('quick-starts and completes a workout session', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  await quickStartLowerBodyWorkout(page);

  await expect(page.getByRole('button', { name: 'Finish (0/7 sets)' })).toBeVisible();

  for (let i = 0; i < 7; i += 1) {
    await completeNextSet(page);
  }

  await expect(page.getByRole('button', { name: 'Complete Workout' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete Workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();
  await expect(page.getByText('5,810')).toBeVisible();

  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('1 workout completed')).toBeVisible();
  await expect(page.getByRole('button', { name: /Lower Body B.*7\/7 sets/ })).toBeVisible();

  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.getByText('Getting Stronger')).toBeVisible();
  await expect(page.getByText('PRs')).toBeVisible();
  await expect(page.getByText('Total Volume (lb)')).toBeVisible();
});
