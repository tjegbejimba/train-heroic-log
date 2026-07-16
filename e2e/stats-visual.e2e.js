import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv, captureVisualEvidence, quickStartLowerBodyWorkout, completeNextSet } from './helpers.js';

// Helper to complete a full workout
async function completeFullWorkout(page) {
  for (let i = 0; i < 7; i += 1) {
    await completeNextSet(page);
  }
  await page.getByRole('button', { name: 'Complete Workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
}

test.describe('Stats VolumeChart visual @visual', () => {
  test('final label stays within SVG bounds on Pixel 5', async ({ page }, testInfo) => {
    await gotoCleanApp(page);
    await importSampleCsv(page);
    
    // Set to Pixel 5 viewport (393x851) BEFORE completing workouts
    await page.setViewportSize({ width: 393, height: 851 });
    
    // Complete at least one workout to get stats data
    await quickStartLowerBodyWorkout(page);
    await completeFullWorkout(page);
    
    // Navigate to Stats view
    await page.getByRole('button', { name: 'Stats' }).click();
    await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
    
    // Switch to 4W range
    await page.getByRole('button', { name: '4W' }).click();
    
    // Wait for chart to render
    const chart = page.locator('.stats-chart--volume');
    await chart.waitFor({ state: 'visible' });
    
    // Capture visual evidence
    await captureVisualEvidence(page, testInfo, 'stats-volume-chart-4w-pixel5');
    
    // Get all x-axis date labels (y=176)
    const labels = chart.locator('text[y="176"]');
    const labelCount = await labels.count();
    
    // Verify we have at least one label
    expect(labelCount).toBeGreaterThanOrEqual(1);
    
    // Check that all labels are fully within the SVG viewport
    const svgBox = await chart.boundingBox();
    
    for (let i = 0; i < labelCount; i++) {
      const label = labels.nth(i);
      const labelBox = await label.boundingBox();
      const labelText = await label.textContent();
      
      // Label must be fully contained (no overflow beyond SVG)
      // The issue states the last label extends past the right padding at narrow widths
      expect(labelBox.x, `Label "${labelText}" left edge`).toBeGreaterThanOrEqual(svgBox.x - 1);
      expect(labelBox.x + labelBox.width, `Label "${labelText}" right edge`).toBeLessThanOrEqual(svgBox.x + svgBox.width + 1);
    }
  });
});
