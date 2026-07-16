/**
 * @file validation-states.e2e.js
 * Tests disabled state treatments for validation-gated buttons.
 * Ensures disabled actions are visually distinct from enabled actions
 * and do not respond to hover/active interactions.
 */

import { test, expect } from '@playwright/test';
import { gotoCleanApp, captureVisualEvidence } from './helpers.js';

test.describe('Disabled button treatments @visual', () => {
  test('Disabled button treatment prevents hover and uses not-allowed cursor', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    
    // Create test buttons to verify CSS treatment works across button variants
    await page.evaluate(() => {
      const container = document.createElement('div');
      container.id = 'test-buttons-container';
      container.style.cssText = 'position: fixed; top: 100px; left: 50%; transform: translateX(-50%); z-index: 9999; display: flex; flex-direction: column; gap: 12px; padding: 20px; background: var(--bg); border: 1px solid var(--border);';
      
      const primary = document.createElement('button');
      primary.className = 'btn btn-primary';
      primary.disabled = true;
      primary.textContent = 'Disabled Primary';
      primary.id = 'test-primary-disabled';
      
      const secondary = document.createElement('button');
      secondary.className = 'btn btn-secondary';
      secondary.disabled = true;
      secondary.textContent = 'Disabled Secondary';
      secondary.id = 'test-secondary-disabled';
      
      const danger = document.createElement('button');
      danger.className = 'btn btn-danger';
      danger.disabled = true;
      danger.textContent = 'Disabled Danger';
      danger.id = 'test-danger-disabled';
      
      container.appendChild(primary);
      container.appendChild(secondary);
      container.appendChild(danger);
      document.body.appendChild(container);
    });
    
    // Test primary button disabled styles
    const primaryBtn = page.locator('#test-primary-disabled');
    await expect(primaryBtn).toBeVisible();
    await expect(primaryBtn).toBeDisabled();
    
    // Get base styles (no hover)
    const baseStyles = await primaryBtn.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        cursor: computed.cursor,
        opacity: computed.opacity,
        background: computed.backgroundColor,
        boxShadow: computed.boxShadow,
      };
    });
    
    // Now actually hover the button with Playwright
    await primaryBtn.hover();
    
    // Get styles while hovering
    const hoverStyles = await primaryBtn.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        background: computed.backgroundColor,
        boxShadow: computed.boxShadow,
      };
    });
    
    expect(baseStyles.cursor).toBe('not-allowed');
    expect(parseFloat(baseStyles.opacity)).toBeLessThan(1);
    // CRITICAL: Hover should NOT change background or add shadow when disabled
    expect(hoverStyles.background).toBe(baseStyles.background);
    expect(hoverStyles.boxShadow).toBe(baseStyles.boxShadow);
    
    // Test secondary button disabled styles with real hover
    const secondaryBtn = page.locator('#test-secondary-disabled');
    const secondaryBase = await secondaryBtn.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        cursor: computed.cursor,
        opacity: computed.opacity,
        background: computed.backgroundColor,
        borderColor: computed.borderColor,
      };
    });
    
    await secondaryBtn.hover();
    
    const secondaryHover = await secondaryBtn.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        background: computed.backgroundColor,
        borderColor: computed.borderColor,
      };
    });
    
    expect(secondaryBase.cursor).toBe('not-allowed');
    expect(parseFloat(secondaryBase.opacity)).toBeLessThan(1);
    // Hover should NOT change background or border when disabled
    expect(secondaryHover.background).toBe(secondaryBase.background);
    expect(secondaryHover.borderColor).toBe(secondaryBase.borderColor);
    
    // Test danger button disabled styles with real hover
    const dangerBtn = page.locator('#test-danger-disabled');
    const dangerBase = await dangerBtn.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        cursor: computed.cursor,
        opacity: computed.opacity,
        filter: computed.filter,
      };
    });
    
    await dangerBtn.hover();
    
    const dangerHover = await dangerBtn.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        filter: computed.filter,
      };
    });
    
    expect(dangerBase.cursor).toBe('not-allowed');
    expect(parseFloat(dangerBase.opacity)).toBeLessThan(1);
    // Hover should NOT change filter (brightness) when disabled
    expect(dangerHover.filter).toBe(dangerBase.filter);
    
    await captureVisualEvidence(page, testInfo, 'disabled-buttons-all-variants');
  });

  test('Send Feedback button disabled vs enabled states', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    
    // Open Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    
    // Open Feedback modal
    await page.getByRole('button', { name: 'Send Feedback' }).click();
    await page.waitForSelector('.feedback-modal');
    
    // DISABLED STATE: empty title and description -> Send Feedback should be disabled
    const submitButtonDisabled = page.getByRole('button', { name: 'Send Feedback' }).last();
    await expect(submitButtonDisabled).toBeDisabled();
    
    const disabledStyles = await submitButtonDisabled.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      const hoverComputed = window.getComputedStyle(el);
      return {
        cursor: computed.cursor,
        opacity: computed.opacity,
        hoverBackground: hoverComputed.backgroundColor,
      };
    });
    
    expect(disabledStyles.cursor).toBe('not-allowed');
    expect(parseFloat(disabledStyles.opacity)).toBeLessThan(1);
    
    await captureVisualEvidence(page, testInfo, 'feedback-submit-disabled-state');
    
    // ENABLED STATE: fill title and description
    await page.getByLabel('Title').fill('Test feedback');
    await page.getByLabel('Description').fill('This is a test');
    await expect(submitButtonDisabled).toBeEnabled();
    
    const enabledStyles = await submitButtonDisabled.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        cursor: computed.cursor,
        opacity: computed.opacity,
      };
    });
    
    expect(enabledStyles.cursor).toBe('pointer');
    expect(parseFloat(enabledStyles.opacity)).toBe(1);
    
    await captureVisualEvidence(page, testInfo, 'feedback-submit-enabled-state');
  });

  test('Clear Data Delete button disabled vs enabled states', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    
    // Open Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    
    // Click Clear Data to open modal
    await page.getByRole('button', { name: 'Clear Data...' }).click();
    await page.waitForSelector('.modal');
    
    // Uncheck "Select All" to get zero selections (modal pre-selects all items)
    await page.getByLabel('Select All').uncheck();
    
    // DISABLED STATE: no selections -> Delete should be disabled
    const deleteButtonDisabled = page.getByRole('button', { name: 'Delete' });
    await expect(deleteButtonDisabled).toBeDisabled();
    
    const disabledStyles = await deleteButtonDisabled.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      const hoverComputed = window.getComputedStyle(el);
      return {
        cursor: computed.cursor,
        opacity: computed.opacity,
        hoverFilter: hoverComputed.filter,
      };
    });
    
    expect(disabledStyles.cursor).toBe('not-allowed');
    expect(parseFloat(disabledStyles.opacity)).toBeLessThan(1);
    
    await captureVisualEvidence(page, testInfo, 'clear-data-delete-disabled-state');
    
    // ENABLED STATE: select at least one item
    await page.getByLabel('Workout Logs').check();
    await expect(deleteButtonDisabled).toBeEnabled();
    
    const enabledStyles = await deleteButtonDisabled.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        cursor: computed.cursor,
        opacity: computed.opacity,
      };
    });
    
    expect(enabledStyles.cursor).toBe('pointer');
    expect(parseFloat(enabledStyles.opacity)).toBe(1);
    
    await captureVisualEvidence(page, testInfo, 'clear-data-delete-enabled-state');
  });
});
