import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv, captureVisualEvidence } from './helpers';

test('@visual empty template list shows next action and navigates to Training', async ({ page }, testInfo) => {
  await gotoCleanApp(page);

  // Navigate to Library → Templates (with zero templates)
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();

  // Empty state should be visible
  await expect(page.getByRole('heading', { name: 'No templates yet', level: 2 })).toBeVisible();

  // Should explain how templates are created
  const explanation = page.getByText(/created from imported workouts/i);
  await expect(explanation).toBeVisible();

  // Should have a "Go to Training" action
  const goToTrainingBtn = page.getByRole('button', { name: /Go to Training/i });
  await expect(goToTrainingBtn).toBeVisible();

  // Capture visual evidence of empty state with action
  await captureVisualEvidence(page, testInfo, 'templates-empty-with-action');

  // Click the action and verify navigation to Training view
  await goToTrainingBtn.click();

  // Should land on Training view - verify by looking for Training-specific UI
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
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
  
  // Should NOT show "Go to Training" button when templates exist
  await expect(page.getByRole('button', { name: /Go to Training/i })).not.toBeVisible();
});
