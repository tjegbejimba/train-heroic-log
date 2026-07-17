import { test, expect } from '@playwright/test';
import { captureVisualEvidence, gotoCleanApp, importSampleCsv } from './helpers';

// Regression journeys proving prescribed-set *targets* stay consistent between a
// Template and its materialized Workout in both directions, exercised through the
// real UI (which drives the production lifecycle authority, `applyTemplateChange`).

async function startLowerBodyB(page) {
  await page.getByRole('button', { name: /Preview Lower Body B/ }).click();
  await page.getByRole('button', { name: 'Start Now' }).click();
  await expect(page.getByRole('button', { name: 'Finish (0/7 sets)' })).toBeVisible();
}

async function openLowerBodyBTemplate(page) {
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Templates' }).click();
  await page.getByRole('button', { name: /Lower Body B/ }).click();
  await expect(page.locator('.tpl-editor')).toBeVisible();
}

test('@visual Template target edit propagates to the materialized Workout', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  // Edit the first exercise's first set target (Leg Swings reps) in the Template.
  await openLowerBodyBTemplate(page);
  const firstSetReps = page.locator('.tpl-editor__set-input').first();
  await firstSetReps.fill('9');
  await expect(firstSetReps).toHaveValue('9');
  await page.getByRole('button', { name: 'Save Template' }).click();

  // Start the materialized Workout — its first set target must reflect the edit.
  await expect(page.getByRole('tab', { name: 'Templates' })).toBeVisible();
  await page.getByRole('button', { name: 'Training' }).click();
  await startLowerBodyB(page);

  const firstTarget = page.locator('.log-set-row__target').first();
  await expect(firstTarget).toHaveText('9 × BW');
  await captureVisualEvidence(page, testInfo, 'session-target-reflects-template-edit');
});

test('@visual Session target confirmation propagates back to the Template', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  // Start the Workout, edit the first set target, and confirm via the pencil.
  await startLowerBodyB(page);
  await page.getByRole('button', { name: 'Edit workout' }).click();
  const firstEditReps = page.locator('.log-set-row__input').first();
  await firstEditReps.fill('5');
  await expect(firstEditReps).toHaveValue('5');
  await page.getByRole('button', { name: 'Save edits' }).click();

  // Leave the active session (progress is saved) so the bottom nav returns.
  await page.getByRole('button', { name: 'Cancel workout' }).click();
  await page.getByRole('button', { name: 'Cancel Workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();

  // Confirmed target must now appear on the matching Template.
  await openLowerBodyBTemplate(page);
  const templateFirstSetReps = page.locator('.tpl-editor__set-input').first();
  await expect(templateFirstSetReps).toHaveValue('5');
  await captureVisualEvidence(page, testInfo, 'template-target-reflects-session-confirmation');
});
