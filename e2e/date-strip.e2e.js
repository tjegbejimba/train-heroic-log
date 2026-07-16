import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv, captureVisualEvidence } from './helpers.js';

test.describe('Date strip centering @visual', () => {
  test('Fresh load centers selected date without clipping on mobile', async ({ page }, testInfo) => {
    // Skip this test on desktop - it's mobile-specific
    if (testInfo.project.name !== 'mobile-chrome') {
      test.skip();
    }

    await gotoCleanApp(page);
    await importSampleCsv(page);
    
    // Wait for date strip to settle
    const dateStrip = page.locator('.date-strip__scroll');
    await expect(dateStrip).toBeVisible();
    
    // Wait for fonts to load and layout to stabilize
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500); // Allow scroll to complete
    
    // Get the selected date button
    const selectedDate = page.locator('.date-strip__day--selected');
    await expect(selectedDate).toBeVisible();
    
    // Check that the selected date is centered and no buttons are clipped
    const centeringInfo = await page.evaluate(() => {
      const container = document.querySelector('.date-strip__scroll');
      const selected = document.querySelector('.date-strip__day--selected');
      const allButtons = Array.from(document.querySelectorAll('.date-strip__day'));
      
      if (!container || !selected || allButtons.length === 0) {
        return { error: 'Elements not found' };
      }
      
      const containerRect = container.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      
      // Calculate center offset
      const containerCenter = containerRect.left + containerRect.width / 2;
      const selectedCenter = selectedRect.left + selectedRect.width / 2;
      const centerOffset = Math.abs(containerCenter - selectedCenter);
      
      // Check for clipped buttons (partially outside container viewport)
      const clippedButtons = allButtons.filter(btn => {
        const btnRect = btn.getBoundingClientRect();
        const isPartiallyVisible = (
          // Right edge visible but left edge clipped
          (btnRect.right > containerRect.left && btnRect.left < containerRect.left) ||
          // Left edge visible but right edge clipped
          (btnRect.left < containerRect.right && btnRect.right > containerRect.right)
        );
        const isCompletelyInside = (
          btnRect.left >= containerRect.left && 
          btnRect.right <= containerRect.right
        );
        return isPartiallyVisible && !isCompletelyInside;
      }).length;
      
      return {
        centerOffset,
        clippedButtons,
      };
    });
    
    // Assert selected date is centered (within 20px tolerance for button width variations)
    expect(centeringInfo.centerOffset).toBeLessThan(20);
    
    // Assert no buttons are clipped at viewport edges
    expect(centeringInfo.clippedButtons).toBe(0);
    
    // Capture visual evidence
    await captureVisualEvidence(page, testInfo, 'date-strip-fresh-load-centered');
  });
  
  test('Date change recenters without clipping on mobile', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'mobile-chrome') {
      test.skip();
    }

    await gotoCleanApp(page);
    await importSampleCsv(page);
    
    const dateStrip = page.locator('.date-strip__scroll');
    await expect(dateStrip).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    
    // Click on a different date (not the selected one)
    const allDateButtons = page.locator('.date-strip__day');
    const firstButton = allDateButtons.nth(0);
    await firstButton.click();
    
    // Wait for recentering to complete
    await page.waitForTimeout(500);
    
    // Check centering again
    const centeringInfo = await page.evaluate(() => {
      const container = document.querySelector('.date-strip__scroll');
      const selected = document.querySelector('.date-strip__day--selected');
      const allButtons = Array.from(document.querySelectorAll('.date-strip__day'));
      
      if (!container || !selected) {
        return { error: 'Elements not found' };
      }
      
      const containerRect = container.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      
      const containerCenter = containerRect.left + containerRect.width / 2;
      const selectedCenter = selectedRect.left + selectedRect.width / 2;
      const centerOffset = Math.abs(containerCenter - selectedCenter);
      
      const clippedButtons = allButtons.filter(btn => {
        const btnRect = btn.getBoundingClientRect();
        const isPartiallyVisible = (
          (btnRect.right > containerRect.left && btnRect.left < containerRect.left) ||
          (btnRect.left < containerRect.right && btnRect.right > containerRect.right)
        );
        const isCompletelyInside = (
          btnRect.left >= containerRect.left && 
          btnRect.right <= containerRect.right
        );
        return isPartiallyVisible && !isCompletelyInside;
      }).length;
      
      return { centerOffset, clippedButtons };
    });
    
    expect(centeringInfo.centerOffset).toBeLessThan(20);
    expect(centeringInfo.clippedButtons).toBe(0);
    
    await captureVisualEvidence(page, testInfo, 'date-strip-after-date-change-centered');
  });
  
  test('Respects prefers-reduced-motion for centering', async ({ page, context }, testInfo) => {
    if (testInfo.project.name !== 'mobile-chrome') {
      test.skip();
    }

    // Emulate reduced motion preference
    await context.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query) => {
          if (query.includes('prefers-reduced-motion')) {
            return {
              matches: true,
              media: query,
              addEventListener: () => {},
              removeEventListener: () => {},
            };
          }
          return window.matchMedia(query);
        },
      });
    });
    
    await gotoCleanApp(page);
    await importSampleCsv(page);
    
    const dateStrip = page.locator('.date-strip__scroll');
    await expect(dateStrip).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    
    // With reduced motion, centering should be instant - check immediately after a short delay
    await page.waitForTimeout(100);
    
    const centeringInfo = await page.evaluate(() => {
      const container = document.querySelector('.date-strip__scroll');
      const selected = document.querySelector('.date-strip__day--selected');
      
      if (!container || !selected) {
        return { error: 'Elements not found' };
      }
      
      const containerRect = container.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      
      const containerCenter = containerRect.left + containerRect.width / 2;
      const selectedCenter = selectedRect.left + selectedRect.width / 2;
      const centerOffset = Math.abs(containerCenter - selectedCenter);
      
      return { centerOffset };
    });
    
    // Should be centered quickly without smooth animation
    expect(centeringInfo.centerOffset).toBeLessThan(20);
    
    await captureVisualEvidence(page, testInfo, 'date-strip-reduced-motion-centered');
  });
});
