import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv } from './helpers';

test('imports sample CSV and populates core app surfaces', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  await expect(page.getByText('Quick Start')).toBeVisible();
  await expect(page.getByRole('button', { name: /Lower Body B/ })).toBeVisible();

  await page.getByRole('button', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(page.getByLabel('15 exercises')).toBeVisible();
  await expect(page.getByRole('button', { name: /Barbell Back Squat/ })).toBeVisible();

  await page.getByRole('tab', { name: 'Templates' }).click();
  await expect(page.getByLabel('4 templates')).toBeVisible();
  await expect(page.getByRole('button', { name: /Upper Body A/ })).toBeVisible();
});
