import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sampleCsvPath = path.join(repoRoot, 'sample.csv');

export async function captureVisualEvidence(page, testInfo, name, options = {}) {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const evidenceDir = path.join(repoRoot, 'artifacts', 'visual', testInfo.project.name);
  const evidencePath = path.join(evidenceDir, `${safeName}.png`);

  await mkdir(evidenceDir, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: evidencePath,
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    ...options,
  });
  await testInfo.attach(name, { path: evidencePath, contentType: 'image/png' });

  return evidencePath;
}

export async function gotoCleanApp(page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('skipSync', '1');
  });
  await page.reload();
}

export async function importSampleCsv(page) {
  await page.locator('input[type="file"]').setInputFiles(sampleCsvPath);
  await expect(page.getByRole('heading', { name: 'Ready to import' })).toBeVisible();
  await page.getByRole('button', { name: 'Import Data' }).click();
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
}

export async function quickStartLowerBodyWorkout(page) {
  await page.getByRole('button', { name: /Preview Lower Body B/ }).click();
  await page.getByRole('button', { name: 'Start Now' }).click();
  await expect(page.getByRole('button', { name: 'Finish (0/7 sets)' })).toBeVisible();
}

export async function completeNextSet(page) {
  await page.getByRole('button', { name: 'Mark complete' }).first().click();
  const skipRest = page.getByRole('button', { name: 'Skip rest' });
  if (await skipRest.isVisible()) {
    await skipRest.click();
  }
}

export async function expectNoDocumentHorizontalOverflow(page) {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

export async function expectBottomNavVisible(page) {
  for (const label of ['Training', 'Planner', 'History', 'Stats', 'Library', 'Settings']) {
    await expect(page.locator('.navbar__tab', { hasText: label })).toBeVisible();
  }
}
