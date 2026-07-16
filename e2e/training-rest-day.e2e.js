import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv, captureVisualEvidence } from './helpers.js';

/**
 * Computes WCAG 2.1 contrast ratio between two colors.
 * @param {string} fg - Foreground color (CSS color string in rgb/rgba format)
 * @param {string} bg - Background color (CSS color string in rgb/rgba format)
 * @returns {number} Contrast ratio (1-21)
 */
function computeContrastRatio(fg, bg) {
  const getLuminance = (color) => {
    // Parse rgb() or rgba() string - handle both comma and space separators
    const match = color.match(/rgba?\(\s*(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)/);
    if (!match) {
      console.error('Failed to parse color:', color);
      return 0;
    }
    
    const [, r, g, b] = match.map(Number);
    
    // Convert to sRGB (0-1 range)
    const toLinear = (val) => {
      const srgb = val / 255;
      return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
    };
    
    // Calculate relative luminance using WCAG formula
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  };
  
  const l1 = getLuminance(fg);
  const l2 = getLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

test.describe('Rest day contrast @visual', () => {
  test('Rest day heading and message meet WCAG AA contrast', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);
    
    // Navigate to a date with no workout scheduled
    // The sample CSV schedules workouts, so we need to find an unscheduled date
    // We can navigate forward until we find a rest day
    const trainingTab = page.getByRole('button', { name: 'Training' });
    await trainingTab.click();
    
    // Look for the rest day card
    const restCard = page.locator('.training-rest-card');
    
    // If not visible, click next day arrow until we find a rest day
    let attempts = 0;
    while (!(await restCard.isVisible()) && attempts < 10) {
      const nextDayBtn = page.locator('.date-strip__nav[aria-label="Next day"]');
      if (await nextDayBtn.isVisible()) {
        await nextDayBtn.click();
        await page.waitForTimeout(200); // Allow UI to update
      }
      attempts++;
    }
    
    // Verify rest day card is visible
    await expect(restCard).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rest Day' })).toBeVisible();
    
    // Get computed styles for heading and message
    // Use canvas to get actual RGB values from oklch colors
    const colors = await restCard.evaluate(() => {
      // Helper to convert any CSS color to rgb tuple using canvas
      const colorToRgb = (color) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return `rgb(${r}, ${g}, ${b})`;
      };
      
      const headingEl = document.querySelector('.training-rest-card__heading');
      const messageEl = document.querySelector('.training-rest-card__message');
      const cardEl = document.querySelector('.training-rest-card');
      
      const headingStyle = window.getComputedStyle(headingEl);
      const messageStyle = window.getComputedStyle(messageEl);
      const cardStyle = window.getComputedStyle(cardEl);
      
      return {
        headingColor: colorToRgb(headingStyle.color),
        messageColor: colorToRgb(messageStyle.color),
        cardBackground: colorToRgb(cardStyle.backgroundColor),
      };
    });
    
    // Log actual colors for debugging
    console.log('Heading color:', colors.headingColor);
    console.log('Message color:', colors.messageColor);
    console.log('Card background:', colors.cardBackground);
    
    // Compute contrast ratios
    const headingContrast = computeContrastRatio(colors.headingColor, colors.cardBackground);
    const messageContrast = computeContrastRatio(colors.messageColor, colors.cardBackground);
    
    console.log('Heading contrast:', headingContrast.toFixed(2));
    console.log('Message contrast:', messageContrast.toFixed(2));
    
    // WCAG AA requirements:
    // - Normal text: 4.5:1
    // - Large text (18pt+ or 14pt+ bold): 3:1
    // The heading is 2xl (~24px) and 800 weight, so it qualifies as large text
    // The message is md (~16px), so it needs normal text contrast
    
    // However, both heading AND message are primary meaningful content,
    // not secondary metadata. They should both have strong contrast.
    // Based on visual audit, message at 9.61 looks too similar to disabled/secondary UI.
    
    // Heading should have excellent contrast (close to --text)
    expect(headingContrast).toBeGreaterThanOrEqual(14.0);
    
    // Message should ALSO have excellent contrast for primary content
    // Current: 9.61 (looks like secondary UI). Target: 14+ (primary content)
    expect(messageContrast).toBeGreaterThanOrEqual(14.0);
    
    // Capture visual evidence for both desktop and mobile
    await captureVisualEvidence(page, testInfo, 'rest-day-contrast');
  });
  
  test('Secondary information remains visually differentiated', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);
    
    // Navigate to rest day
    const trainingTab = page.getByRole('button', { name: 'Training' });
    await trainingTab.click();
    
    const restCard = page.locator('.training-rest-card');
    
    let attempts = 0;
    while (!(await restCard.isVisible()) && attempts < 10) {
      const nextDayBtn = page.locator('.date-strip__nav[aria-label="Next day"]');
      if (await nextDayBtn.isVisible()) {
        await nextDayBtn.click();
        await page.waitForTimeout(200);
      }
      attempts++;
    }
    
    await expect(restCard).toBeVisible();
    
    // Get heading and message colors
    const colors = await restCard.evaluate(() => {
      const colorToRgb = (color) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return `rgb(${r}, ${g}, ${b})`;
      };
      
      const heading = document.querySelector('.training-rest-card__heading');
      const message = document.querySelector('.training-rest-card__message');
      const nextLabel = document.querySelector('.training-rest-card__next-label');
      
      const result = {
        headingColor: colorToRgb(window.getComputedStyle(heading).color),
        messageColor: colorToRgb(window.getComputedStyle(message).color),
      };
      
      // Only check next label if it exists
      if (nextLabel) {
        result.nextLabelColor = colorToRgb(window.getComputedStyle(nextLabel).color);
      }
      
      return result;
    });
    
    // Heading and message are both primary content, so they can be the same color
    // But tertiary info (like "Up next" label) should be visually distinct
    if (colors.nextLabelColor) {
      // Next label should be dimmer than primary content (heading/message)
      expect(colors.nextLabelColor).not.toBe(colors.headingColor);
      expect(colors.nextLabelColor).not.toBe(colors.messageColor);
    }
    
    // Check that Quick Start subtext uses secondary/muted color
    const quickStartSubtext = page.locator('.training-templates__subtext');
    if (await quickStartSubtext.isVisible()) {
      const subtextColor = await quickStartSubtext.evaluate((el) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        const color = window.getComputedStyle(el).color;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return `rgb(${r}, ${g}, ${b})`;
      });
      
      // Subtext should be dimmer than rest day primary content
      expect(subtextColor).not.toBe(colors.headingColor);
    }
  });
});
