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
  
  test('Section headings align with card content', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);
    
    // Navigate to Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    
    // Find all settings sections
    const sections = page.locator('.settings-section');
    const sectionCount = await sections.count();
    
    // Test each section
    for (let i = 0; i < sectionCount; i++) {
      const section = sections.nth(i);
      
      // Get the section heading (h2 within settings-section__head)
      const heading = section.locator('.settings-section__head h2');
      if (await heading.count() === 0) continue;
      
      // Get the first content element after the heading
      // This could be a .settings-control, .settings-view__reminder-row, or other content div
      const contentElements = section.locator('.settings-control, .settings-view__reminder-row, .settings-view__sync-status, .settings-subsection, .settings-view__storage');
      if (await contentElements.count() === 0) continue;
      
      const firstContent = contentElements.first();
      
      // Get bounding boxes
      const headingBox = await heading.boundingBox();
      const contentBox = await firstContent.boundingBox();
      const sectionBox = await section.boundingBox();
      
      if (!headingBox || !contentBox || !sectionBox) continue;
      
      // The heading's left edge should align with the content's left edge
      // (both should be inset from the section's left edge by the same amount)
      const headingLeftInset = headingBox.x - sectionBox.x;
      const contentLeftInset = contentBox.x - sectionBox.x;
      
      // Allow 1px tolerance for rounding
      expect(Math.abs(headingLeftInset - contentLeftInset)).toBeLessThanOrEqual(1);
      
      // Also verify heading doesn't touch the section border (should have some inset)
      // Settings section has 1px border + should have padding
      expect(headingLeftInset).toBeGreaterThan(5); // At minimum, some padding
    }
    
    // Capture desktop evidence
    await captureVisualEvidence(page, testInfo, 'settings-heading-alignment');
  });

  test('Backup actions stack on mobile without narrow wrapping', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);
    
    // Navigate to Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    
    // Scroll to Data portability section
    const dataSection = page.locator('.settings-section').filter({ has: page.getByRole('heading', { name: 'Data portability' }) });
    await dataSection.scrollIntoViewIfNeeded();
    
    // Find the backup action buttons container (the one with Re-import, Export Backup, Restore)
    const backupActionsContainer = dataSection.locator('.settings-view__data-actions').last();
    const backupButtons = backupActionsContainer.locator('button');
    
    // Should have exactly 3 backup action buttons
    await expect(backupButtons).toHaveCount(3);
    
    // Get button labels for verification
    await expect(backupButtons.nth(0)).toContainText('Re-import CSV');
    await expect(backupButtons.nth(1)).toContainText('Export Backup');
    await expect(backupButtons.nth(2)).toContainText('Restore from Backup');
    
    // All three buttons should be at least 44px tall (WCAG touch target)
    for (let i = 0; i < 3; i++) {
      const box = await backupButtons.nth(i).boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    
    // Get viewport width to determine expected layout
    const viewportWidth = page.viewportSize().width;
    const box1 = await backupButtons.nth(0).boundingBox();
    const box2 = await backupButtons.nth(1).boundingBox();
    const box3 = await backupButtons.nth(2).boundingBox();
    const containerBox = await backupActionsContainer.boundingBox();
    
    if (viewportWidth <= 430) {
      // Mobile: buttons should be vertically stacked (no horizontal neighbors)
      expect(box2.y).toBeGreaterThan(box1.y + box1.height - 1); // Button2 below button1
      expect(box3.y).toBeGreaterThan(box2.y + box2.height - 1); // Button3 below button2
      
      // Each button should be nearly full-width on mobile (not squeezed into columns)
      for (let i = 0; i < 3; i++) {
        const buttonBox = await backupButtons.nth(i).boundingBox();
        expect(buttonBox.width).toBeGreaterThan(containerBox.width * 0.85);
      }
    } else {
      // Desktop: buttons can be multi-column, but not excessively narrow
      // Allow for grid layouts (2-column or 3-column)
      for (let i = 0; i < 3; i++) {
        const buttonBox = await backupButtons.nth(i).boundingBox();
        // Buttons shouldn't be squeezed below reasonable width (min ~140px for icon+text)
        expect(buttonBox.width).toBeGreaterThanOrEqual(140);
      }
    }
    
    // Capture viewport-specific evidence
    await captureVisualEvidence(page, testInfo, viewportWidth <= 430 ? 'backup-actions-mobile' : 'backup-actions-desktop');
  });
});
