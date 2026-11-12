import { test, expect } from '@playwright/test';
import {
  captureVisualEvidence,
  completeNextSet,
  expectBottomNavVisible,
  expectNoDocumentHorizontalOverflow,
  gotoCleanApp,
  importSampleCsv,
  quickStartLowerBodyWorkout,
} from './helpers.js';

const squatSet = (setIndex, reps, weight) => ({
  setIndex,
  targetReps: reps,
  targetWeight: weight,
  unit: 'lb',
  actualReps: reps,
  actualWeight: weight,
  completed: true,
});

function earlierSession(date, squatSets) {
  return {
    logKey: `${date}::Lower Body B`,
    workoutTitle: 'Lower Body B',
    date,
    startedAt: `${date}T15:00:00.000Z`,
    completedAt: `${date}T16:05:00.000Z`,
    exercises: { 'Barbell Back Squat': squatSets },
    exerciseNotes: {},
    workoutNote: '',
  };
}

async function seedEarlierSessions(page) {
  await page.evaluate((logs) => {
    localStorage.setItem('th_logs', JSON.stringify(logs));
  }, {
    '2026-09-01::Lower Body B': earlierSession('2026-09-01', [
      squatSet(0, 3, 215), squatSet(1, 5, 195), squatSet(2, 8, 175),
    ]),
    '2026-09-08::Lower Body B': earlierSession('2026-09-08', [
      squatSet(0, 3, 230), squatSet(1, 5, 195), squatSet(2, 8, 175),
    ]),
  });
  await page.reload();
}

test('@visual sparse, dense and equal-volume histories keep every volume bar inside the plot', async ({ page }, testInfo) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: {} }));
  await gotoCleanApp(page);
  await importSampleCsv(page);
  for (const [count, equalVolume] of [[2, false], [3, false], [20, false], [3, true]]) {
    const logs = Object.fromEntries(Array.from({ length: count }, (_, index) => {
      const date = `2026-09-${String(index + 1).padStart(2, '0')}`;
      const session = earlierSession(date, [squatSet(0, 5, equalVolume ? 175 : 175 + index * 5)]);
      return [session.logKey, session];
    }));
    await page.evaluate(logs => {
      localStorage.setItem('th_logs', JSON.stringify(logs));
      sessionStorage.setItem('skipSync', '1');
    }, logs);
    await page.reload();
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: /Barbell Back Squat/ }).first().click();
    await page.getByRole('button', { name: 'View exercise history' }).click();
    const chart = page.getByRole('img', { name: 'Weight progress chart' });
    await expect(chart).toBeVisible();
    const plot = await chart.locator('.progress-chart__grid-line').first().boundingBox();
    const bars = await chart.locator('.progress-chart__volume-bar').evaluateAll(elements => elements.map(el => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height };
    }));
    expect(bars).toHaveLength(count);
    for (let index = 0; index < bars.length; index++) {
      expect(bars[index].x).toBeGreaterThanOrEqual(plot.x - 0.5);
      expect(bars[index].x + bars[index].width).toBeLessThanOrEqual(plot.x + plot.width + 0.5);
      expect(bars[index].width).toBeGreaterThan(0);
      if (index) expect(bars[index].x).toBeGreaterThanOrEqual(bars[index - 1].x + bars[index - 1].width);
      if (equalVolume) expect(bars[index].height).toBeCloseTo(bars[0].height, 2);
    }
    await expectNoDocumentHorizontalOverflow(page);
    await expect(page.getByRole('button', { name: 'Library', exact: true })).toBeVisible();
    await captureVisualEvidence(page, testInfo, `bounded-volume-${count}-${equalVolume ? 'equal' : 'varying'}`);
  }
});

test('@visual Training history reports PRs consistently across the app', async ({ page }, testInfo) => {
  await gotoCleanApp(page);
  await importSampleCsv(page);
  await seedEarlierSessions(page);

  // Today's targets: 3×225 (short of 230), 5×205 and 8×185 (PRs), RDL (Baselines).
  await quickStartLowerBodyWorkout(page);
  for (let i = 0; i < 7; i += 1) {
    await completeNextSet(page);
  }
  await page.getByRole('button', { name: 'Complete Workout' }).click();

  const summary = page.getByRole('dialog', { name: 'Workout complete' });
  await expect(summary.getByText('New PRs')).toBeVisible();
  await expect(summary.locator('.aw-summary__pr-item')).toHaveCount(2);
  await expect(summary.locator('.aw-summary__baseline-item')).toHaveCount(2);
  await expect(summary.locator('.aw-summary__baseline-item', { hasText: 'Romanian Deadlift' })).toHaveCount(2);
  await captureVisualEvidence(page, testInfo, 'completion summary with PRs and baselines');
  await summary.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'History' }).click();
  const cards = page.locator('.history-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0).locator('.history-card__pr-count-badge')).toHaveText('2 PRs');
  await expect(cards.nth(1).locator('.history-card__pr-count-badge')).toHaveText('1 PR');
  await cards.nth(0).locator('.history-card__toggle').click();
  await expect(cards.nth(0).locator('.history-card__pr-badge')).toHaveCount(2);
  await captureVisualEvidence(page, testInfo, 'history card with PR badges');

  // The first Session's Baselines keep their badges even though today beat them.
  await cards.nth(0).locator('.history-card__toggle').click();
  await cards.nth(2).locator('.history-card__toggle').click();
  await expect(cards.nth(2).locator('.history-card__baseline-badge')).toHaveCount(3);
  await cards.nth(2).scrollIntoViewIfNeeded();
  await captureVisualEvidence(page, testInfo, 'history baseline badges after being beaten');
  await expectNoDocumentHorizontalOverflow(page);
  await expectBottomNavVisible(page);

  await page.getByRole('button', { name: 'Stats' }).click();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('.stats-chart--volume')).toBeVisible();
  // One PR on 09-08 plus today's two, matching the History badges.
  await expect(page.locator('.stats-pr-callout')).toHaveText(/^\s*3\s*PRs\s*$/);
  await captureVisualEvidence(page, testInfo, 'stats with training history');
  await expectNoDocumentHorizontalOverflow(page);

  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('button', { name: /Barbell Back Squat/ }).first().click();
  await page.getByRole('button', { name: 'View exercise history' }).click();
  await expect(page.getByRole('heading', { name: 'Barbell Back Squat' })).toBeVisible();
  await expect(page.getByText('3 sessions logged / 9 completed sets')).toBeVisible();
  await expect(page.getByRole('button', { name: /personal record/ })).toHaveCount(1);
  await captureVisualEvidence(page, testInfo, 'exercise history top-set records');
  await expectNoDocumentHorizontalOverflow(page);
});
