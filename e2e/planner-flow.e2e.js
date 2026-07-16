import { test, expect } from '@playwright/test';
import { gotoCleanApp, importSampleCsv, captureVisualEvidence, expectBottomNavVisible } from './helpers';

test('assigns a template from Planner and opens the scheduled workout', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  await page.getByRole('button', { name: 'Planner' }).click();
  await page.getByRole('button', { name: '+ Add' }).first().click();

  await expect(page.getByRole('heading', { name: 'Pick a Template' })).toBeVisible();
  await page.getByRole('button', { name: /Pull Day\s+4 exercises/ }).click();

  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await page.getByRole('button', { name: 'Apply Plan' }).click();

  await page.getByRole('button', { name: 'Pull Day' }).click();
  await expect(page.getByRole('heading', { name: 'Pull Day' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Workout' })).toBeVisible();
});

test('@visual sticky Apply Plan appears for unsaved changes and disappears after apply', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  await page.getByRole('button', { name: 'Planner' }).click();
  
  // Before making changes, Apply Plan should not be visible
  const applyButton = page.getByRole('button', { name: 'Apply Plan' });
  await expect(applyButton).not.toBeVisible();

  // Assign a template to Monday
  await page.getByRole('button', { name: '+ Add' }).first().click();
  await expect(page.getByRole('heading', { name: 'Pick a Template' })).toBeVisible();
  await page.getByRole('button', { name: /Pull Day\s+4 exercises/ }).click();

  // Apply Plan should now be visible in the viewport without scrolling
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await expect(applyButton).toBeInViewport();
  
  // Capture evidence showing sticky Apply Plan with unsaved badge
  await captureVisualEvidence(page, testInfo, 'planner-sticky-apply-visible');

  // Bottom nav should remain visible (not covered by sticky action)
  await expectBottomNavVisible(page);

  // Apply the plan
  await applyButton.click();

  // Sticky Apply Plan should disappear
  await expect(applyButton).not.toBeVisible();
  await expect(page.getByText('Unsaved changes')).not.toBeVisible();

  // Capture evidence showing no sticky action after apply
  await captureVisualEvidence(page, testInfo, 'planner-sticky-apply-hidden');
});

test('@visual template picker shows empty state for no search matches and allows recovery', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  await page.getByRole('button', { name: 'Planner' }).click();
  await page.getByRole('button', { name: '+ Add' }).first().click();
  await expect(page.getByRole('heading', { name: 'Pick a Template' })).toBeVisible();

  // Initially, template list should show templates
  await expect(page.getByRole('button', { name: /Pull Day\s+4 exercises/ })).toBeVisible();

  // Search for a non-existent template
  const searchInput = page.getByPlaceholder('Search templates...');
  await searchInput.fill('NonExistentWorkout');

  // Empty state should appear with search query
  await expect(page.getByText(/No templates match/)).toBeVisible();
  await expect(page.getByText(/NonExistentWorkout/)).toBeVisible();
  
  // Template list items should not be visible
  await expect(page.getByRole('button', { name: /Pull Day\s+4 exercises/ })).not.toBeVisible();

  // Capture desktop empty state
  await captureVisualEvidence(page, testInfo, 'planner-search-empty-state');

  // Clear Search button should be visible
  const clearSearchBtn = page.getByRole('button', { name: 'Clear Search' });
  await expect(clearSearchBtn).toBeVisible();

  // Click Clear Search
  await clearSearchBtn.click();

  // Search input should be cleared
  await expect(searchInput).toHaveValue('');

  // Template list should return
  await expect(page.getByRole('button', { name: /Pull Day\s+4 exercises/ })).toBeVisible();
  await expect(page.getByText('No templates match')).not.toBeVisible();
});
