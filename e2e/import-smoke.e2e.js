import { test, expect } from '@playwright/test';
import {
  captureVisualEvidence,
  expectNoDocumentHorizontalOverflow,
  gotoCleanApp,
  importSampleCsv,
} from './helpers';

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

test('reviews safe import conflicts before changing existing data @visual', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Re-import CSV' }).click();
  await page.getByLabel('Paste CSV').fill(
    `WorkoutTitle,ScheduledDate,ExerciseTitle,ExerciseData
Upper Body A,2026-03-24,Bench Press,10 rep x 135 pound`
  );
  await page.getByRole('button', { name: 'Preview pasted CSV' }).click();
  await page.getByRole('button', { name: 'Merge safely' }).click();

  await expect(page.getByRole('heading', { name: 'Import report' })).toBeVisible();
  await expect(page.getByText('Needs choice')).toBeVisible();
  await expect(page.getByLabel('Send feedback')).toHaveCount(0);
  await page.getByText('Compare workout definitions').click();
  await expect(page.getByText(/10 reps @ 135/i)).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
  await captureVisualEvidence(page, testInfo, 'safe import conflict report');
});
