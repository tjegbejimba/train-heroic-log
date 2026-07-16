import { test, expect } from '@playwright/test';
import {
  captureVisualEvidence,
  expectBottomNavVisible,
  expectNoDocumentHorizontalOverflow,
  gotoCleanApp,
  importSampleCsv,
  quickStartLowerBodyWorkout,
} from './helpers';

test('captures the core UI journey for human inspection @visual', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  await expectNoDocumentHorizontalOverflow(page);
  await expectBottomNavVisible(page);
  await captureVisualEvidence(page, testInfo, 'training imported');

  await page.getByRole('button', { name: 'Planner' }).click();
  await expect(page.getByRole('heading', { name: 'Week Planner' })).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
  await captureVisualEvidence(page, testInfo, 'weekly planner');

  await page.getByRole('button', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Exercise Library' })).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
  await captureVisualEvidence(page, testInfo, 'exercise library');

  await page.getByRole('button', { name: 'Training' }).click();
  await quickStartLowerBodyWorkout(page);
  await expect(page.getByRole('button', { name: 'Finish (0/7 sets)' })).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
  await captureVisualEvidence(page, testInfo, 'active workout');
});
