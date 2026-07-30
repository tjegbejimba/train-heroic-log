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

test('@visual creating a template with a duplicate name is rejected with visible feedback', async ({ page }, testInfo) => {
  await gotoCleanApp(page);

  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();

  // Seed an existing template through the same create flow.
  await page.getByRole('button', { name: /New Template/i }).click();
  await page.locator('#template-name').fill('Full Body A');
  await page.getByPlaceholder('Search exercises...').fill('Goblet Squat');
  await page.locator('#template-name').click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Save Template' }).click();
  await expect(page.getByRole('button', { name: /Full Body A/ })).toBeVisible();

  // Let the "Template created!" toast clear so the evidence below can only
  // show the rejection, not a leftover success message.
  await expect(page.locator('.toast--success')).toHaveCount(0);

  // Attempt a second template that collides on name.
  await page.getByRole('button', { name: /New Template/i }).click();
  await page.locator('#template-name').fill('Full Body A');
  await page.getByPlaceholder('Search exercises...').fill('Push Up');
  await page.locator('#template-name').click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Save Template' }).click();

  // The orchestrator's rejection must reach the user, not fail silently.
  const errorToast = page.locator('.toast--error', {
    hasText: 'A template with this name already exists',
  });
  await expect(errorToast).toBeVisible();

  // The toast ends on a `forwards` fade-out keyframe, so Playwright's default
  // `animations: 'disabled'` fast-forwards it to opacity 0 and the evidence
  // would show an empty frame. Capture with animations live, after the 220ms
  // fade-in has settled, so the error is legible in the screenshot.
  await page.waitForTimeout(300);
  await captureVisualEvidence(page, testInfo, 'template-create-duplicate-name-error', {
    animations: 'allow',
  });

  // The editor stays open with the user's work intact so the name can be fixed.
  await expect(page.locator('.tpl-editor')).toBeVisible();
  await expect(page.locator('#template-name')).toHaveValue('Full Body A');

  // The existing template is untouched — no overwrite, no second entry.
  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('th_templates') || '{}')
  );
  const templates = Object.values(stored);
  expect(templates).toHaveLength(1);
  expect(templates[0].name).toBe('Full Body A');
  expect(templates[0].blocks[0].exercises[0].title).toBe('Goblet Squat');
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

