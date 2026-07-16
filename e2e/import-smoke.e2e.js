import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv } from './helpers';

test('imports sample CSV and populates core app surfaces', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  await expect(page.getByText('Quick Start')).toBeVisible();
  await expect(page.getByRole('button', { name: /Lower Body B/ })).toBeVisible();

  await page.getByRole('button', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Exercise Library' })).toBeVisible();
  await expect(page.getByText('15 exercises across 4 workouts')).toBeVisible();
  await expect(page.getByRole('button', { name: /Barbell Back Squat/ })).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Templates\s+4 templates/ }).click();
  await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Upper Body A/ })).toBeVisible();
});
