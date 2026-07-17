import { test, expect } from '@playwright/test';
import {
  gotoCleanApp,
  importSampleCsv,
  quickStartLowerBodyWorkout,
  completeNextSet,
} from './helpers';

// Proves the persistence-authority migration keeps TrainLog offline-first:
// with the network fully disabled, an athlete can still plan and log a workout,
// and every change commits to local storage.
test('plans and logs a workout with the network disabled', async ({ page, context }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  // Cut the network. From here every read/write must be served locally.
  await context.setOffline(true);

  // ── Plan: assign a template from the Planner while offline ───────────────
  await page.getByRole('button', { name: 'Planner' }).click();
  await page.getByRole('button', { name: '+ Add' }).first().click();
  await expect(page.getByRole('heading', { name: 'Pick a Template' })).toBeVisible();
  await page.getByRole('button', { name: /Pull Day\s+4 exercises/ }).click();
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await page.getByRole('button', { name: 'Apply Plan' }).click();
  await expect(page.getByText('Unsaved changes')).not.toBeVisible();

  // The plan committed locally despite having no network.
  const scheduleRaw = await page.evaluate(() => localStorage.getItem('th_schedule'));
  expect(scheduleRaw).toContain('Pull Day');

  // ── Log: complete a full workout while offline ───────────────────────────
  await page.getByRole('button', { name: 'Training' }).click();
  await quickStartLowerBodyWorkout(page);
  for (let i = 0; i < 7; i += 1) {
    await completeNextSet(page);
  }
  await page.getByRole('button', { name: 'Complete Workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // History reflects the completed session — read back through the authority.
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('1 workout completed')).toBeVisible();
  await expect(page.getByRole('button', { name: /Lower Body B.*7\/7 sets/ })).toBeVisible();

  // The log persisted to local storage even though no request ever left.
  const logsRaw = await page.evaluate(() => localStorage.getItem('th_logs'));
  expect(logsRaw).toContain('Lower Body B');

  await context.setOffline(false);
});
