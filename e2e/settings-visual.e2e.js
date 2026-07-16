import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv, captureVisualEvidence } from './helpers.js';

test.describe('Settings visual states @visual', () => {
  test('Clear Data dialog shows visible checked states', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);
    
    // Navigate to Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    
    // Open Clear Data dialog
    await page.getByRole('button', { name: 'Clear Data...' }).click();
    await expect(page.getByRole('heading', { name: 'Clear Data' })).toBeVisible();
    
    // All checkboxes should be checked by default
    const selectAllCheckbox = page.locator('.settings-clear-modal__check--all input[type="checkbox"]');
    await expect(selectAllCheckbox).toBeChecked();
    
    // Verify all individual checkboxes are checked
    const individualCheckboxes = page.locator('.settings-clear-modal__checks label:not(.settings-clear-modal__check--all) input[type="checkbox"]');
    const count = await individualCheckboxes.count();
    for (let i = 0; i < count; i++) {
      await expect(individualCheckboxes.nth(i)).toBeChecked();
    }
    
    // Verify checked checkboxes have visible styling (not just DOM checked state)
    // A checked checkbox should have a distinct visual indicator
    const firstChecked = individualCheckboxes.first();
    const checkedColor = await firstChecked.evaluate((el) => {
      const styles = window.getComputedStyle(el, ':after');
      // Check for pseudo-element, background, or accent-color
      return {
        accentColor: window.getComputedStyle(el).accentColor,
        backgroundColor: styles.backgroundColor || window.getComputedStyle(el).backgroundColor,
      };
    });
    
    // The accent color should be applied to checked state
    expect(checkedColor.accentColor).toBeTruthy();
    expect(checkedColor.accentColor).not.toBe('rgb(0, 0, 0)'); // Should not be default black
    
    // Capture visual evidence of all checked
    await captureVisualEvidence(page, testInfo, 'clear-data-all-checked');
    
    // Uncheck one item
    await page.locator('.settings-clear-modal__checks label:not(.settings-clear-modal__check--all)').first().click();
    
    // Select All should now be unchecked
    await expect(selectAllCheckbox).not.toBeChecked();
    
    // First individual checkbox should be unchecked
    await expect(individualCheckboxes.first()).not.toBeChecked();
    
    // Capture visual evidence of mixed state
    await captureVisualEvidence(page, testInfo, 'clear-data-mixed-state');
    
    // Re-check via Select All
    await page.locator('.settings-clear-modal__check--all').click();
    await expect(selectAllCheckbox).toBeChecked();
    
    // All should be checked again
    for (let i = 0; i < count; i++) {
      await expect(individualCheckboxes.nth(i)).toBeChecked();
    }
    
    // Capture final all-checked state
    await captureVisualEvidence(page, testInfo, 'clear-data-re-checked');
  });
  
  test('Feedback modal checkbox shows visible checked state', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);
    
    // Navigate to Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    
    // Open Feedback modal (use the one in Settings, not the FAB)
    await page.locator('.settings-view__content .btn').filter({ hasText: 'Send Feedback' }).click();
    await expect(page.getByRole('heading', { name: 'Send Feedback' })).toBeVisible();
    
    // Bug category should be default
    await expect(page.getByRole('button', { name: 'Bug' })).toHaveClass(/btn-primary/);
    
    // Snapshot checkbox should be checked by default for Bug category
    const snapshotCheckbox = page.locator('.feedback-modal__snapshot input[type="checkbox"]');
    await expect(snapshotCheckbox).toBeChecked();
    
    // Verify visible checked styling
    const checkedColor = await snapshotCheckbox.evaluate((el) => {
      return window.getComputedStyle(el).accentColor;
    });
    expect(checkedColor).toBeTruthy();
    expect(checkedColor).not.toBe('rgb(0, 0, 0)');
    
    // Capture checked state
    await captureVisualEvidence(page, testInfo, 'feedback-snapshot-checked');
    
    // Uncheck the snapshot
    await page.locator('.feedback-modal__snapshot').click();
    await expect(snapshotCheckbox).not.toBeChecked();
    
    // Capture unchecked state
    await captureVisualEvidence(page, testInfo, 'feedback-snapshot-unchecked');
    
    // Check it again
    await page.locator('.feedback-modal__snapshot').click();
    await expect(snapshotCheckbox).toBeChecked();
    
    // Capture re-checked state
    await captureVisualEvidence(page, testInfo, 'feedback-snapshot-rechecked');
  });
  
  test('Checkbox focus state is visible', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);
    
    // Navigate to Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    
    // Open Clear Data dialog
    await page.getByRole('button', { name: 'Clear Data...' }).click();
    
    // Tab to first checkbox
    const firstCheckbox = page.locator('.settings-clear-modal__checks label:not(.settings-clear-modal__check--all) input[type="checkbox"]').first();
    await firstCheckbox.focus();
    
    // Verify focus is visible
    const focusOutline = await firstCheckbox.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineColor: styles.outlineColor,
        outlineWidth: styles.outlineWidth,
      };
    });
    
    // Should have visible focus outline (from global :focus-visible)
    expect(focusOutline.outlineWidth).not.toBe('0px');
    
    // Capture focused state
    await captureVisualEvidence(page, testInfo, 'checkbox-focused');
  });
});
