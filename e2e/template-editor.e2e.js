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
