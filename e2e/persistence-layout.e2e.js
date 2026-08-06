import { test, expect } from '@playwright/test';
import {
  completeNextSet,
  expectBottomNavVisible,
  expectNoDocumentHorizontalOverflow,
  gotoCleanApp,
  importSampleCsv,
  quickStartLowerBodyWorkout,
} from './helpers';

test('restores an active workout after reload', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await quickStartLowerBodyWorkout(page);
  await completeNextSet(page);

  await page.evaluate(() => sessionStorage.setItem('skipSync', '1'));
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Resume Workout?' })).toBeVisible();
  const resumeModal = page.locator('.modal');
  await expect(resumeModal.getByText('Lower Body B')).toBeVisible();
  await expect(resumeModal.getByText('1 of 7 sets completed')).toBeVisible();

  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('button', { name: 'Finish (1/7 sets)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark incomplete' })).toBeVisible();
});

test('keeps key mobile screens within the viewport width', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile layout guard runs once on the mobile project.');

  await gotoCleanApp(page);
  await importSampleCsv(page);

  await expectNoDocumentHorizontalOverflow(page);
  await expectBottomNavVisible(page);

  for (const label of ['Planner', 'Library', 'Settings']) {
    await page.getByRole('button', { name: label }).click();
    await expectNoDocumentHorizontalOverflow(page);
    await expectBottomNavVisible(page);
  }

  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();
  await expect(page.getByLabel('4 templates')).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
  await expectBottomNavVisible(page);

  await page.getByRole('button', { name: /Lower Body B/ }).click();
  await expect(page.getByRole('button', { name: 'Save Template' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Cancel/ })).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
});

test('keeps primary mobile navigation and planning controls thumb-sized', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Touch target guard runs once on the mobile project.');

  await gotoCleanApp(page);
  await importSampleCsv(page);

  for (const tab of await page.locator('.navbar__tab').all()) {
    const box = await tab.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);
  }

  await page.getByRole('button', { name: 'Planner' }).click();
  for (const assignButton of await page.locator('.planner-day__assign').all()) {
    const box = await assignButton.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);
  }

  await page.getByRole('button', { name: 'Library' }).click();
  for (const libraryTab of await page.getByRole('tab').all()) {
    const box = await libraryTab.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);
  }
});

test('keeps template editing and exercise history controls thumb-sized', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Touch target guard runs once on the mobile project.');

  await gotoCleanApp(page);
  await importSampleCsv(page);

  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: /Lower Body B/ }).click();

  for (const control of await page.locator('.tpl-editor .btn-icon, .tpl-editor .rest-picker__trigger, .tpl-editor .bar-weight-picker__trigger').all()) {
    const box = await control.boundingBox();
    const className = await control.getAttribute('class');
    expect(box.width, className).toBeGreaterThanOrEqual(47.99);
    expect(box.height, className).toBeGreaterThanOrEqual(47.99);
  }

  await page.getByRole('button', { name: /Cancel/ }).click();
  await page.getByRole('tab', { name: 'Exercises' }).click();
  await page.locator('.library-row__header').first().click();
  await page.getByRole('button', { name: 'View exercise history' }).click();

  const backBox = await page.locator('.exercise-history-view__back').boundingBox();
  expect(backBox.height).toBeGreaterThanOrEqual(48);
});
