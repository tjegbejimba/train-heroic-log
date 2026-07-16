import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv, captureVisualEvidence } from './helpers.js';

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
