import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv, captureVisualEvidence, expectBottomNavVisible } from './helpers';

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

test('@visual sticky Apply Plan appears for unsaved changes and disappears after apply', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  await page.getByRole('button', { name: 'Planner' }).click();
  
  // Before making changes, Apply Plan should not be visible
  const applyButton = page.getByRole('button', { name: 'Apply Plan' });
  await expect(applyButton).not.toBeVisible();

  // Assign a template to Monday
  await page.getByRole('button', { name: '+ Add' }).first().click();
  await expect(page.getByRole('heading', { name: 'Pick a Template' })).toBeVisible();
  await page.getByRole('button', { name: /Pull Day\s+4 exercises/ }).click();

  // Apply Plan should now be visible in the viewport without scrolling
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await expect(applyButton).toBeInViewport();
  
  // Capture evidence showing sticky Apply Plan with unsaved badge
  await captureVisualEvidence(page, testInfo, 'planner-sticky-apply-visible');

  // Bottom nav should remain visible (not covered by sticky action)
  await expectBottomNavVisible(page);

  // Apply the plan
  await applyButton.click();

  // Sticky Apply Plan should disappear
  await expect(applyButton).not.toBeVisible();
  await expect(page.getByText('Unsaved changes')).not.toBeVisible();

  // Capture evidence showing no sticky action after apply
  await captureVisualEvidence(page, testInfo, 'planner-sticky-apply-hidden');
});
