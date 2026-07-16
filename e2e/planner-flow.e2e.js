import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv } from './helpers';

test('assigns a template from Planner and opens the scheduled workout', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  await page.getByRole('button', { name: 'Planner' }).click();
  await page.getByRole('button', { name: '+ Add' }).first().click();

  await expect(page.getByRole('heading', { name: 'Pick a Template' })).toBeVisible();
  await page.getByRole('button', { name: /Pull Day\s+4 exercises/ }).click();

  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await page.getByRole('button', { name: 'Apply Plan' }).click();

  await page.getByRole('button', { name: 'Pull Day' }).click();
  await expect(page.getByRole('heading', { name: 'Pull Day' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Workout' })).toBeVisible();
});
