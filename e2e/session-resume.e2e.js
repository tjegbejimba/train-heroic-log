import { test, expect } from '@playwright/test';
import {
  captureVisualEvidence,
  completeNextSet,
  expectBottomNavVisible,
  gotoCleanApp,
  importSampleCsv,
  quickStartLowerBodyWorkout,
} from './helpers';
// Simulates a crash: an active Session is left in localStorage mid-Workout,
// then the PWA is reloaded. The Session module drives the resume decision.

test('resumes an unfinished Session with completed Sets and start time intact', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await quickStartLowerBodyWorkout(page);

  // Log one Set, then "crash" by reloading before completing the Workout.
  await completeNextSet(page);
  await expect(page.getByRole('button', { name: 'Finish (1/7 sets)' })).toBeVisible();

  await page.reload();

  // The Session module classifies this as a valid unfinished Session -> prompt.
  const resumeModal = page.getByRole('heading', { name: 'Resume Workout?' });
  await expect(resumeModal).toBeVisible();
  await expect(page.locator('.modal').getByText('Lower Body B')).toBeVisible();
  await expect(page.getByText('1 of 7 sets completed')).toBeVisible();

  await page.getByRole('button', { name: 'Resume' }).click();

  // The recovered Session restores the completed Set (1/7), not a fresh start.
  await expect(page.getByRole('button', { name: 'Finish (1/7 sets)' })).toBeVisible();
});

test('@visual resume prompt appears after a mid-Session reload', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await quickStartLowerBodyWorkout(page);

  await completeNextSet(page);
  await expect(page.getByRole('button', { name: 'Finish (1/7 sets)' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Resume Workout?' })).toBeVisible();
  await expect(page.getByText('1 of 7 sets completed')).toBeVisible();

  await captureVisualEvidence(page, testInfo, 'session-resume-prompt');
});

test('discarding an unfinished Session clears it and returns to Training', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await quickStartLowerBodyWorkout(page);

  await completeNextSet(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Resume Workout?' })).toBeVisible();

  await page.getByRole('button', { name: 'Discard' }).click();

  // Back on Training with the nav visible, and no lingering active Session.
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
  await expectBottomNavVisible(page);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Resume Workout?' })).toHaveCount(0);
});

test('@visual Exercise and Session Workout notes survive crash recovery and resume', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await quickStartLowerBodyWorkout(page);

  // Log a Set so recovery treats this as a resumable Session.
  await completeNextSet(page);

  // Add an Exercise-scoped Session note on the first Exercise.
  await page.getByRole('button', { name: 'Add a note…' }).first().click();
  const exerciseNoteInput = page.getByPlaceholder('Note (e.g. felt weak, RPE 8, elbow pain)');
  await exerciseNoteInput.fill('elbow twinge, RPE 8');
  await exerciseNoteInput.blur();

  // Add the overall Session Workout note.
  const sessionNoteInput = page.getByPlaceholder(/How did the session feel/);
  await sessionNoteInput.fill('low energy today');
  await sessionNoteInput.blur();

  // "Crash" mid-Session, then resume.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Resume Workout?' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('button', { name: 'Finish (1/7 sets)' })).toBeVisible();

  // Both note types are recovered, each on its own field.
  await expect(page.getByRole('button', { name: /elbow twinge, RPE 8/ })).toBeVisible();
  await expect(page.getByPlaceholder(/How did the session feel/)).toHaveValue('low energy today');

  await captureVisualEvidence(page, testInfo, 'session-notes-recovered', { fullPage: true });
});
