import { test, expect } from '@playwright/test';
import { 
  captureVisualEvidence,
  completeNextSet, 
  expectNoDocumentHorizontalOverflow,
  gotoCleanApp, 
  importSampleCsv, 
  quickStartLowerBodyWorkout 
} from './helpers';

test('quick-starts and completes a workout session', async ({ page }) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);

  await quickStartLowerBodyWorkout(page);

  await expect(page.getByRole('button', { name: 'Finish (0/7 sets)' })).toBeVisible();

  for (let i = 0; i < 7; i += 1) {
    await completeNextSet(page);
  }

  await expect(page.getByRole('button', { name: 'Complete Workout' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete Workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();
  await expect(page.getByText('5,810')).toBeVisible();

  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('1 workout completed')).toBeVisible();
  await expect(page.getByRole('button', { name: /Lower Body B.*7\/7 sets/ })).toBeVisible();

  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.getByText('Getting Stronger')).toBeVisible();
  await expect(page.getByText('PRs')).toBeVisible();
  await expect(page.getByText('Total Volume (lb)')).toBeVisible();
});

test('@visual keeps a final Session note typed just before completion', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await quickStartLowerBodyWorkout(page);

  for (let i = 0; i < 7; i += 1) {
    await completeNextSet(page);
  }

  // Type a final Session note, then immediately complete — the pending note must
  // be folded into the completed Log (neither lost nor duplicated).
  const note = 'felt great, big PRs today';
  const noteInput = page.getByPlaceholder(/How did the session feel/);
  await noteInput.fill(note);
  await captureVisualEvidence(page, testInfo, 'session-note-before-completion');

  await page.getByRole('button', { name: 'Complete Workout' }).click();
  await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // The note survives into completed History exactly once.
  await page.getByRole('button', { name: 'History' }).click();
  await page.locator('.history-card__toggle').first().click();
  await expect(page.getByText('Session note')).toBeVisible();
  await expect(page.getByText(note)).toBeVisible();
  await expect(page.getByText(note)).toHaveCount(1);
  await captureVisualEvidence(page, testInfo, 'session-note-in-history');
});

test('@visual set row layout has non-overlapping grid columns', async ({ page, browserName }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await quickStartLowerBodyWorkout(page);

  // Wait for the active workout view to be fully rendered
  await expect(page.getByRole('button', { name: 'Finish (0/7 sets)' })).toBeVisible();

  // Get first set row (bodyweight exercise: "3 × BW")
  const firstSetRow = page.locator('.log-set-row').first();
  await expect(firstSetRow).toBeVisible();

  // Assert four distinct direct children of the grid container
  const setNumberCell = firstSetRow.locator('.log-set-row__set-num');
  const targetCell = firstSetRow.locator('.log-set-row__target-wrap');
  const inputsCell = firstSetRow.locator('.log-set-row__inputs');
  const completeCell = firstSetRow.locator('.log-set-row__complete');

  await expect(setNumberCell).toBeVisible();
  await expect(targetCell).toBeVisible();
  await expect(inputsCell).toBeVisible();
  await expect(completeCell).toBeVisible();

  // Get bounding boxes to verify non-overlapping layout
  const setNumBox = await setNumberCell.boundingBox();
  const targetBox = await targetCell.boundingBox();
  const inputsBox = await inputsCell.boundingBox();
  const completeBox = await completeCell.boundingBox();

  // Set number and target must not overlap (target starts after set number)
  expect(targetBox.x).toBeGreaterThanOrEqual(setNumBox.x + setNumBox.width - 1);

  // Inputs have their own line so weight is not squeezed between target and check.
  expect(inputsBox.y).toBeGreaterThanOrEqual(targetBox.y + targetBox.height - 1);
  expect(completeBox.x).toBeGreaterThanOrEqual(targetBox.x + targetBox.width - 1);

  // Complete button must have 44px minimum touch target (mobile accessibility)
  expect(completeBox.width).toBeGreaterThanOrEqual(44);
  expect(completeBox.height).toBeGreaterThanOrEqual(44);

  // Check no horizontal document overflow
  await expectNoDocumentHorizontalOverflow(page);

  // Capture bodyweight row evidence
  await captureVisualEvidence(page, testInfo, 'set-row-layout-bodyweight-active');

  // Complete first set and verify completed state
  await completeNextSet(page);
  await captureVisualEvidence(page, testInfo, 'set-row-layout-bodyweight-completed');

  // Scroll to second exercise (weighted: "3 × 225 lb")
  const secondExercise = page.locator('.aw-exercise-card').nth(1);
  await secondExercise.scrollIntoViewIfNeeded();
  
  // Find the first set of the weighted exercise
  const weightedSetRow = secondExercise.locator('.log-set-row').first();
  await expect(weightedSetRow).toBeVisible();

  // Verify weighted row has proper layout
  const weightedSetNum = weightedSetRow.locator('.log-set-row__set-num');
  const weightedTarget = weightedSetRow.locator('.log-set-row__target-wrap');
  const weightedInputs = weightedSetRow.locator('.log-set-row__inputs');
  const weightedComplete = weightedSetRow.locator('.log-set-row__complete');

  const weightedSetNumBox = await weightedSetNum.boundingBox();
  const weightedTargetBox = await weightedTarget.boundingBox();
  const weightedInputsBox = await weightedInputs.boundingBox();
  const weightedCompleteBox = await weightedComplete.boundingBox();

  // Same non-overlap checks for weighted row
  expect(weightedTargetBox.x).toBeGreaterThanOrEqual(weightedSetNumBox.x + weightedSetNumBox.width - 1);
  expect(weightedInputsBox.y).toBeGreaterThanOrEqual(weightedTargetBox.y + weightedTargetBox.height - 1);
  expect(weightedCompleteBox.x).toBeGreaterThanOrEqual(weightedTargetBox.x + weightedTargetBox.width - 1);

  // Capture weighted row evidence
  await captureVisualEvidence(page, testInfo, 'set-row-layout-weighted-active');

  // Complete the weighted set and skip rest timer to see completed row
  await page.getByRole('button', { name: 'Mark complete' }).first().click();
  
  // Skip rest timer to view completed row
  const skipRest = page.getByRole('button', { name: 'Skip rest' });
  if (await skipRest.isVisible({ timeout: 2000 })) {
    await skipRest.click();
  }
  
  // Verify completed weighted row hides adjustment buttons and plate display
  const completedRow = weightedSetRow;
  await expect(completedRow).toHaveClass(/log-set-row--completed/);
  
  // Assert that adjustment buttons and plate display are not rendered in completed state
  await expect(completedRow.locator('.log-set-row__adjust-btn')).toHaveCount(0);
  await expect(completedRow.locator('.plate-display')).toHaveCount(0);
  
  await captureVisualEvidence(page, testInfo, 'set-row-layout-weighted-completed');

  // Check no horizontal overflow after interactions
  await expectNoDocumentHorizontalOverflow(page);
});

test('@visual weight entry and last completed sets stay readable on the workout screen', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const day = date.toISOString().slice(0, 10);
    const key = `${day}::Lower Body B`;
    localStorage.setItem('th_logs', JSON.stringify({
      [key]: {
        logKey: key,
        date: day,
        completedAt: `${day}T18:00:00.000Z`,
        exercises: {
          'Barbell Back Squat': [
            { actualReps: 3, actualWeight: 230, unit: 'lb', completed: true },
            { actualReps: 5, actualWeight: 210, unit: 'lb', completed: true },
            { actualReps: 8, actualWeight: 190, unit: 'lb', completed: true },
          ],
        },
      },
    }));
  });
  await page.reload();
  await quickStartLowerBodyWorkout(page);

  const squat = page.locator('.aw-exercise-card', { has: page.getByRole('heading', { name: 'Barbell Back Squat' }) });
  await squat.scrollIntoViewIfNeeded();
  await expect(squat.getByText('Last: 3 × 230 lb')).toBeVisible();
  await expect(squat.getByText('Last: 5 × 210 lb')).toBeVisible();
  await expect(squat.getByText('Last: 8 × 190 lb')).toBeVisible();
  const weight = squat.locator('.log-set-row__weight-row input').first();
  await weight.fill('240');
  await expect(weight).toHaveValue('240');
  const metrics = await weight.evaluate((input) => ({
    fontSize: parseFloat(getComputedStyle(input).fontSize),
    width: input.getBoundingClientRect().width,
    clipped: input.scrollWidth > input.clientWidth,
  }));
  expect(metrics.fontSize).toBeGreaterThanOrEqual(20);
  expect(metrics.width).toBeGreaterThanOrEqual(70);
  expect(metrics.width).toBeLessThanOrEqual(90);
  expect(metrics.clipped).toBe(false);
  await expectNoDocumentHorizontalOverflow(page);
  await captureVisualEvidence(page, testInfo, 'weight-entry-with-last-session');
  if (testInfo.project.name === 'mobile-chrome') {
    await page.setViewportSize({ width: 320, height: 700 });
    await expectNoDocumentHorizontalOverflow(page);
    const bounds = await squat.locator('.log-set-row').first().boundingBox();
    const weightBounds = await weight.boundingBox();
    expect(weightBounds.x + weightBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    await captureVisualEvidence(page, testInfo, 'weight-entry-narrow-mobile');
  }
});
