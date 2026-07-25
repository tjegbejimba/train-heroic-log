import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv, captureVisualEvidence } from './helpers';

test('@visual empty template list shows next actions and navigates to Import', async ({ page }, testInfo) => {
  await gotoCleanApp(page);

  // Navigate to Library → Templates (with zero templates)
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();

  // Empty state should be visible
  await expect(page.getByRole('heading', { name: 'No templates yet', level: 2 })).toBeVisible();

  // Should explain both ways to get a template
  const explanation = page.getByText(/Build a template from scratch, or import/i);
  await expect(explanation).toBeVisible();

  // Should have both a "New Template" and an "Import Workout" action
  const newTemplateBtn = page.getByRole('button', { name: /New Template/i });
  const importBtn = page.getByRole('button', { name: /Import Workout/i });
  await expect(newTemplateBtn).toBeVisible();
  await expect(importBtn).toBeVisible();

  // Capture visual evidence of empty state with both actions
  await captureVisualEvidence(page, testInfo, 'templates-empty-with-actions');

  // Click the Import action and verify navigation to Import view
  await importBtn.click();

  // Should land on Import view - verify by looking for Import heading
  await expect(page.getByRole('heading', { name: 'Import TrainHeroic CSV' })).toBeVisible();
});

test('@visual creating a new template from scratch', async ({ page }, testInfo) => {
  await gotoCleanApp(page);

  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();

  // Start from the empty-state's New Template action
  await page.getByRole('button', { name: /New Template/i }).click();

  // Lands in the template editor, blank
  await expect(page.locator('.tpl-editor')).toBeVisible();
  const nameInput = page.locator('#template-name');
  await expect(nameInput).toHaveValue('');

  // Save is disabled until a name is entered
  await expect(page.getByRole('button', { name: 'Save Template' })).toBeDisabled();

  // Fill in a name and an exercise
  await nameInput.fill('Full Body A');
  const exerciseInput = page.getByPlaceholder('Search exercises...');
  await exerciseInput.fill('Goblet Squat');
  // Blur commits the typed exercise title (debounced ~200ms so a dropdown
  // click can win instead); wait for it before saving.
  await nameInput.click();
  await page.waitForTimeout(250);

  await captureVisualEvidence(page, testInfo, 'template-editor-new-blank-filled');

  await page.getByRole('button', { name: 'Save Template' }).click();

  // Back on the Templates tab, with the new template listed and toast confirming creation
  await expect(page.getByText('Template created!')).toBeVisible();
  await expect(page.getByRole('button', { name: /Full Body A/ })).toBeVisible();

  // Re-opening it shows the saved exercise
  await page.getByRole('button', { name: /Full Body A/ }).click();
  await expect(page.getByPlaceholder('Search exercises...')).toHaveValue('Goblet Squat');
});

test('@visual populated template list retains current behavior', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  // Navigate to Library → Templates (now with templates)
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();

  // Should NOT show the empty state
  await expect(page.getByRole('heading', { name: 'No templates yet', level: 2 })).not.toBeVisible();

  // Should show template rows
  await expect(page.getByRole('button', { name: /Lower Body B/ })).toBeVisible();

  // Should show the persistent "New Template" toolbar action
  await expect(page.getByRole('button', { name: /New Template/i })).toBeVisible();

  // Should NOT show "Import Workout" button when templates exist
  await expect(page.getByRole('button', { name: /Import Workout/i })).not.toBeVisible();

  await captureVisualEvidence(page, testInfo, 'templates-populated-with-new-template-toolbar');
});

