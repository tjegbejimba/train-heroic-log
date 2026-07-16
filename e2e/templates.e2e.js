import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv, captureVisualEvidence } from './helpers';

test('@visual empty template list shows next action and navigates to Import', async ({ page }, testInfo) => {
  await gotoCleanApp(page);

  // Navigate to Library → Templates (with zero templates)
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();

  // Empty state should be visible
  await expect(page.getByRole('heading', { name: 'No templates yet', level: 2 })).toBeVisible();

  // Should explain how templates are created
  const explanation = page.getByText(/created from imported workouts/i);
  await expect(explanation).toBeVisible();

  // Should have an "Import Workout" action
  const importBtn = page.getByRole('button', { name: /Import Workout/i });
  await expect(importBtn).toBeVisible();

  // Capture visual evidence of empty state with action
  await captureVisualEvidence(page, testInfo, 'templates-empty-with-action');

  // Click the action and verify navigation to Import view
  await importBtn.click();

  // Should land on Import view - verify by looking for Import heading
  await expect(page.getByRole('heading', { name: 'Import TrainHeroic CSV' })).toBeVisible();
});

test('populated template list retains current behavior', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  // Navigate to Library → Templates (now with templates)
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();

  // Should NOT show the empty state
  await expect(page.getByRole('heading', { name: 'No templates yet', level: 2 })).not.toBeVisible();

  // Should show template rows
  await expect(page.getByRole('button', { name: /Lower Body B/ })).toBeVisible();
  
  // Should NOT show "Import Workout" button when templates exist
  await expect(page.getByRole('button', { name: /Import Workout/i })).not.toBeVisible();
});
