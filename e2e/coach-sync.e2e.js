import { test, expect } from '@playwright/test';
import { gotoCleanApp, mockCoachSync, mountCoachFixture, captureVisualEvidence, expectNoDocumentHorizontalOverflow, expectBottomNavVisible } from './helpers.js';

test.use({ serviceWorkers: 'block' });

test('resolves app and coach schedule proposals side by side without losing either @visual', async ({ page }, testInfo) => {
  const exercise = { title: 'Bench Press', sets: [{ reps: 8, weight: 60, unit: 'kg' }] };
  const blocks = [{ exercises: [exercise] }];
  const state = {
    ready: false,
    revision: 'a'.repeat(64),
    sections: Object.fromEntries(['th_templates', 'th_workouts', 'th_schedule', 'th_logs', 'th_active', 'th_yt_links'].map((key) => [key, { syncVersion: 2, data: key === 'th_active' ? null : {}, updatedAt: '2026-11-01T20:00:00Z' }])),
    conflicts: [{
      id: 'schedule-conflict', key: 'th_schedule', path: ['2099-11-03'],
      base: { present: true, value: 'Upper A' },
      local: { present: true, value: 'My Upper A - Week 2' },
      remote: { present: true, value: 'Coach Upper A - Week 2' },
    }],
  };
  state.sections.th_workouts.data = { 'Coach Upper A - Week 2': { title: 'Coach Upper A - Week 2', blocks } };
  state.sections.th_schedule.data = { '2099-11-03': 'Coach Upper A - Week 2' };
  await mountCoachFixture(page, state);
  await page.getByRole('button', { name: 'Review sync conflicts (1)' }).click();
  await expect(page.getByRole('heading', { name: 'Choose the schedule to keep' })).toBeVisible();
  await expect(page.getByText('My Upper A - Week 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Coach Upper A - Week 2', { exact: true })).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
  await expectBottomNavVisible(page);
  await captureVisualEvidence(page, testInfo, 'coach-schedule-conflict-side-by-side');
  state.failResolve = true;
  await page.getByRole('button', { name: 'Keep my edit' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Data changed. Refresh conflicts before choosing.' })).toBeVisible();
  await captureVisualEvidence(page, testInfo, 'coach-conflict-resolution-error');
  state.failResolve = false;
  await page.getByRole('button', { name: 'Refresh conflicts' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Data changed. Refresh conflicts before choosing.' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Keep my edit' }).click();
  await expect(page.getByRole('button', { name: 'Review sync conflicts (1)' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('th_schedule'))['2099-11-03'])).toBe('My Upper A - Week 2');
});

function simpleState() {
  const blocks = [{ exercises: [{ title: 'Bench Press', sets: [{ reps: 8, weight: 60, unit: 'kg' }] }] }];
  return {
    revision: 'a'.repeat(64), conflicts: [],
    sections: {
      th_workouts: { syncVersion: 2, data: { 'Upper A': { title: 'Upper A', blocks } } },
      th_templates: { syncVersion: 2, data: {} },
      th_schedule: { syncVersion: 2, data: {} },
      th_logs: { syncVersion: 2, data: {} },
      th_active: { syncVersion: 2, data: null },
      th_yt_links: { syncVersion: 2, data: {} },
    },
  };
}

test('receives the first coach plan while an empty import screen is idle @visual', async ({ page }, testInfo) => {
  const state = simpleState();
  const firstWorkouts = state.sections.th_workouts.data;
  state.sections.th_workouts.data = {};
  state.ready = false;
  await mockCoachSync(page, state);
  await gotoCleanApp(page);
  state.ready = true;
  await page.evaluate(() => sessionStorage.removeItem('skipSync'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Import TrainHeroic CSV' })).toBeVisible();
  await expect.poll(() => state.pulls).toBeGreaterThan(1);
  state.sections.th_workouts.data = firstWorkouts;
  state.sections.th_schedule.data[new Date().toLocaleDateString('en-CA')] = 'Upper A';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Workout' })).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
  await expectBottomNavVisible(page);
  await captureVisualEvidence(page, testInfo, 'coach-first-plan-received-from-empty-app');
});

test('keeps a completed offline session visible when the coach scheduled a newer version for that day @visual', async ({ page }, testInfo) => {
  const state = simpleState();
  const today = new Date().toLocaleDateString('en-CA');
  const original = state.sections.th_workouts.data['Upper A'];
  state.sections.th_workouts.data['Upper A - Week 2'] = { title: 'Upper A - Week 2', blocks: original.blocks };
  state.sections.th_schedule.data[today] = 'Upper A - Week 2';
  state.sections.th_logs.data[`${today}::Upper A`] = {
    workoutTitle: 'Upper A', workoutSnapshot: original, startedAt: `${today}T10:00:00Z`,
    completedAt: `${today}T11:00:00Z`,
    exercises: { 'Bench Press': [{ reps: 8, weight: 60, unit: 'kg', actualReps: 8, actualWeight: 60, completed: true }] },
  };
  await mountCoachFixture(page, state);
  await expect(page.getByText('Workout Complete', { exact: true })).toBeVisible();
  await expect(page.getByText('Upper A', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Workout' })).toHaveCount(0);
  await expectNoDocumentHorizontalOverflow(page);
  await expectBottomNavVisible(page);
  await captureVisualEvidence(page, testInfo, 'coach-completed-offline-day-preserved');
});

test('shows workout prescriptions and whole-section upgrade proposals for human review @visual', async ({ page }, testInfo) => {
  const state = simpleState();
  const blocks = (reps, weight, notes, workoutNotes) => [{ exercises: [{
    title: 'Bench Press', notes, workoutNotes, sets: [{ reps, weight, unit: 'kg' }],
  }] }];
  state.sections.th_workouts.data['Upper A'].blocks = blocks(6, 65, 'Keep wrists stacked', 'Slow eccentric');
  state.conflicts = [{
    id: 'workout-conflict', key: 'th_workouts', path: ['Upper A', 'blocks'],
    local: { present: true, value: blocks(8, 60, 'Feet planted', 'Pause each rep') },
    remote: { present: true, value: state.sections.th_workouts.data['Upper A'].blocks },
  }];
  await mountCoachFixture(page, state);
  await page.getByRole('button', { name: 'Review sync conflicts (1)' }).click();
  await expect(page.getByText('8 \u00d7 60 kg', { exact: true })).toBeVisible();
  await expect(page.getByText('6 \u00d7 65 kg', { exact: true })).toBeVisible();
  await expect(page.getByText('Pause each rep', { exact: true })).toBeVisible();
  await expect(page.getByText('Form notes: Keep wrists stacked', { exact: true })).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
  await expectBottomNavVisible(page);
  await captureVisualEvidence(page, testInfo, 'coach-workout-prescription-proposals');
  state.conflicts = [{
    id: 'upgrade-conflict', key: 'th_schedule', path: [], reason: 'baseline-unavailable',
    local: { present: true, value: { '2099-11-03': 'My Upper A' } },
    remote: { present: true, value: { '2099-11-04': 'Upper A' } },
  }];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText(/This device has no previous sync baseline/)).toBeVisible();
  for (const summary of await page.getByText('Full proposal', { exact: true }).all()) await summary.click();
  await expect(page.getByText(/"My Upper A"/)).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
  await captureVisualEvidence(page, testInfo, 'coach-upgrade-whole-section-proposals');
});

test('receives coach additions in place when idle but preserves a blurred form-notes draft @visual', async ({ page }, testInfo) => {
  const state = simpleState();
  await mountCoachFixture(page, state);
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: /Bench Press/ }).click();
  await page.getByRole('button', { name: '+ Add form notes' }).click();
  const draft = page.getByPlaceholder(/Add coaching tips/);
  await draft.fill('My unsaved coaching cue');
  await draft.blur();
  const pulls = state.pulls;
  state.sections.th_workouts.data['Lower A - Week 2'] = {
    title: 'Lower A - Week 2', blocks: [{ exercises: [{ title: 'Romanian Deadlift', sets: [{ reps: 10, weight: 80, unit: 'kg' }] }] }],
  };
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(draft).toHaveValue('My unsaved coaching cue');
  expect(state.pulls).toBe(pulls);
  await captureVisualEvidence(page, testInfo, 'coach-refresh-deferred-form-notes-draft');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: /Romanian Deadlift/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Exercises', selected: true })).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
  await expectBottomNavVisible(page);
  await captureVisualEvidence(page, testInfo, 'coach-exercises-received-without-navigation-reset');
});

test('resumes an offline-started workout from its pinned prescription after the shared definition changes @visual', async ({ page }, testInfo) => {
  const state = simpleState();
  const today = new Date().toLocaleDateString('en-CA');
  state.sections.th_schedule.data[today] = 'Upper A';
  await mountCoachFixture(page, state);
  await page.getByRole('button', { name: 'Start Workout' }).click();
  await expect(page.getByRole('button', { name: 'Finish (0/1 sets)' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('th_active')).workoutSnapshot.blocks[0].exercises[0].title)).toBe('Bench Press');
  await page.evaluate(() => {
    const workouts = JSON.parse(localStorage.getItem('th_workouts'));
    workouts['Upper A'].blocks = [{ exercises: [{ title: 'Deadlift', sets: [{ reps: 5, weight: 100, unit: 'kg' }] }] }];
    localStorage.setItem('th_workouts', JSON.stringify(workouts));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByText('Bench Press', { exact: true })).toBeVisible();
  await expect(page.getByText('Deadlift', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Finish (0/1 sets)' })).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
  await captureVisualEvidence(page, testInfo, 'coach-pinned-prescription-after-offline-recovery');
});
