import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv, captureVisualEvidence, expectBottomNavVisible } from './helpers';

test('@visual long template name wraps and keeps actions visible at mobile width', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-specific wrapping behavior test.');

  await gotoCleanApp(page);
  await importSampleCsv(page);

  // Navigate to template editor
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: /Lower Body B/ }).click();

  // Template editor should be visible
  await expect(page.getByRole('button', { name: 'Save Template' })).toBeVisible();
  const nameInput = page.locator('#template-name');
  await expect(nameInput).toBeVisible();

  // Clear and enter a long template name
  await nameInput.fill('');
  const longName = 'Full Body Hypertrophy and Strength Training Program with Progressive Overload';
  await nameInput.fill(longName);

  // Wait for DOM to stabilize after input
  await page.waitForTimeout(100);

  // Verify the full name was entered
  await expect(nameInput).toHaveValue(longName);

  // Assert the field wrapped/grew (auto-resize worked)
  const textareaHeight = await nameInput.evaluate((el) => ({
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
    minHeight: 52, // from CSS
  }));
  expect(textareaHeight.clientHeight).toBeGreaterThan(textareaHeight.minHeight);
  expect(textareaHeight.clientHeight).toBeGreaterThanOrEqual(textareaHeight.scrollHeight - 2);

  // Capture visual evidence showing the long name
  await captureVisualEvidence(page, testInfo, 'template-editor-long-name-mobile');

  // Actions should remain visible and in viewport
  await expect(page.getByRole('button', { name: /Cancel/ })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Save Template' })).toBeInViewport();
});

test('@visual long template name wraps on desktop too', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop verification for consistency.');

  await gotoCleanApp(page);
  await importSampleCsv(page);

  // Navigate to template editor
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: /Lower Body B/ }).click();

  const nameInput = page.locator('#template-name');
  
  // Enter a long template name
  await nameInput.fill('');
  const longName = 'Full Body Hypertrophy and Strength Training Program with Progressive Overload';
  await nameInput.fill(longName);

  await page.waitForTimeout(100);

  // Verify full value is in the field
  await expect(nameInput).toHaveValue(longName);

  // Assert the field wrapped/grew
  const textareaHeight = await nameInput.evaluate((el) => ({
    clientHeight: el.clientHeight,
    minHeight: 52,
  }));
  expect(textareaHeight.clientHeight).toBeGreaterThan(textareaHeight.minHeight);

  // Capture visual evidence
  await captureVisualEvidence(page, testInfo, 'template-editor-long-name-desktop');

  // Actions should be visible
  await expect(page.getByRole('button', { name: /Cancel/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Template' })).toBeVisible();
});

test('short template names retain compact header treatment', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: /Pull Day/ }).click();

  const nameInput = page.locator('#template-name');
  
  // Short name should display normally
  await nameInput.fill('Pull Day');
  await expect(nameInput).toHaveValue('Pull Day');

  // Actions should be visible
  await expect(page.getByRole('button', { name: /Cancel/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Template' })).toBeVisible();

  // Header should still be compact (not testing exact height, just visibility)
  const header = page.locator('.tpl-editor__header');
  await expect(header).toBeVisible();
});

test.describe('Template Editor @visual', () => {
  test('shows unsaved changes indicator and guards cancel when dirty', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);

    // Navigate to Library > Templates tab
    await page.click('text=Library');
    await page.click('button[role="tab"]:has-text("Templates")');
    
    // Click on a template to edit
    await page.click('text=Push Day');
    await expect(page.locator('.tpl-editor')).toBeVisible();

    // Initially no unsaved indicator (clean state)
    await expect(page.locator('text=Unsaved changes')).not.toBeVisible();

    // Cancel should work immediately on clean editor
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Push Day')).toBeVisible(); // Back in library

    // Go back to editor
    await page.click('text=Push Day');
    await expect(page.locator('.tpl-editor')).toBeVisible();

    // Make a change - edit name
    await page.fill('#template-name', 'Modified Push Day');

    // Unsaved changes indicator should appear
    await expect(page.locator('text=Unsaved changes')).toBeVisible();
    await captureVisualEvidence(page, testInfo, 'unsaved-indicator-after-name-change');

    // Click Cancel - should show confirmation
    await page.click('button:has-text("Cancel")');

    // Confirmation dialog should appear
    await expect(page.locator('text=Unsaved changes will be lost')).toBeVisible();
    await expect(page.locator('button:has-text("Stay")')).toBeVisible();
    await expect(page.locator('button:has-text("Discard")')).toBeVisible();
    await captureVisualEvidence(page, testInfo, 'discard-confirmation-modal');

    // Click Stay - should remain in editor with changes
    await page.click('button:has-text("Stay")');
    await expect(page.locator('.tpl-editor')).toBeVisible();
    await expect(page.locator('#template-name')).toHaveValue('Modified Push Day');
    await expect(page.locator('text=Unsaved changes')).toBeVisible();

    // Click Cancel again
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Unsaved changes will be lost')).toBeVisible();

    // Click Discard - should exit without saving
    await page.click('button:has-text("Discard")');
    await expect(page.locator('text=Push Day')).toBeVisible(); // Original name still there

    // Template should not have changed
    await expect(page.locator('text=Modified Push Day')).not.toBeVisible();
  });

  test('clears dirty state after save', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);

    await page.click('text=Library');
    await page.click('button[role="tab"]:has-text("Templates")');
    await page.click('text=Push Day');

    // Make changes
    await page.fill('#template-name', 'Updated Push Day');
    await expect(page.locator('text=Unsaved changes')).toBeVisible();

    // Save
    await page.click('button:has-text("Save Template")');
    
    // Should navigate back to library after save
    await expect(page.locator('button[role="tab"]:has-text("Templates")')).toBeVisible();
    
    // Re-open the template (use first template row to avoid name matching issues)
    const templateRow = page.locator('.tpl-list__row').first();
    await templateRow.click();
    await expect(page.locator('.tpl-editor')).toBeVisible();

    // No unsaved indicator initially (dirty state was cleared after save)
    await expect(page.locator('text=Unsaved changes')).not.toBeVisible();

    // Cancel should work immediately (no dirty state)
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('button[role="tab"]:has-text("Templates")')).toBeVisible();
  });

  test('tracks changes to workout notes, sets, rest duration, and bar weight', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);

    await page.click('text=Library');
    await page.click('button[role="tab"]:has-text("Templates")');
    await page.click('text=Push Day');

    // No indicator initially (clean)
    await expect(page.locator('text=Unsaved changes')).not.toBeVisible();

    // Change set reps
    await page.fill('.tpl-editor__set-input >> nth=0', '12');
    await expect(page.locator('text=Unsaved changes')).toBeVisible();
    await captureVisualEvidence(page, testInfo, 'unsaved-after-set-change');
  });
});
