// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ActiveWorkoutView from './ActiveWorkoutView.jsx';

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({ settings: { restDuration: 90 } }),
}));

// jsdom doesn't implement CSS.escape or Element.scrollIntoView; both are
// invoked by scrollToNextSet after the rest timer is skipped. Real browsers
// provide these natively.
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = { escape: (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&') };
} else if (typeof globalThis.CSS.escape !== 'function') {
  globalThis.CSS.escape = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {};
}

const logKey = '2026-07-04::Full-Body Express';

const workout = {
  title: 'Full-Body Express',
  blocks: [
    {
      value: 'A',
      units: 'strength',
      exercises: [
        {
          title: 'Back Squat',
          unit: 'lb',
          sets: [{ reps: 8, weight: 185, unit: 'lb' }],
        },
      ],
    },
  ],
};

const twoSetWorkout = {
  title: 'Full-Body Express',
  blocks: [
    {
      exercises: [
        {
          title: 'Back Squat',
          unit: 'lb',
          sets: [
            { reps: 8, weight: 185, unit: 'lb' },
            { reps: 8, weight: 185, unit: 'lb' },
          ],
        },
      ],
    },
  ],
};

function twoSetLog() {
  const set = (setIndex) => ({
    setIndex,
    targetReps: 8,
    targetWeight: 185,
    unit: 'lb',
    actualReps: '',
    actualWeight: '',
    completed: false,
  });
  return {
    logKey,
    workoutTitle: 'Full-Body Express',
    date: '2026-07-04',
    completedAt: null,
    startedAt: '2026-07-04T12:00:00.000Z',
    exercises: { 'Back Squat': [set(0), set(1)] },
    exerciseNotes: {},
    workoutNote: '',
  };
}

const existingLog = {
  logKey,
  workoutTitle: workout.title,
  date: '2026-07-04',
  completedAt: null,
  startedAt: '2026-07-04T12:00:00.000Z',
  exercises: {
    'Back Squat': [
      {
        setIndex: 0,
        targetReps: 8,
        targetWeight: 185,
        unit: 'lb',
        actualReps: 8,
        actualWeight: 185,
        completed: true,
      },
    ],
  },
  exerciseNotes: {},
  workoutNote: '',
};

function renderActiveWorkout(overrides = {}) {
  const saveLog = vi.fn();
  render(
    <ActiveWorkoutView
      logKey={logKey}
      workouts={{ [workout.title]: workout }}
      logs={{ [logKey]: existingLog }}
      allLogs={{}}
      saveLog={saveLog}
      getYouTubeLink={() => null}
      onComplete={() => {}}
      onCancel={() => {}}
      onUpdateWorkout={() => {}}
      {...overrides}
    />
  );
  return { saveLog };
}

describe('ActiveWorkoutView', () => {
  it('shows the last completed workout set with reps, weight, and units', () => {
    renderActiveWorkout({
      workouts: { [twoSetWorkout.title]: twoSetWorkout },
      logs: { [logKey]: twoSetLog() },
      allLogs: [{
        key: '2026-06-27::Full-Body Express',
        date: '2026-06-27',
        completedAt: '2026-06-27T12:00:00.000Z',
        exercises: {
          'Back Squat': [
            { actualReps: 7, actualWeight: 180, unit: 'lb', completed: true },
            { actualReps: 6, actualWeight: 175, unit: 'lb', completed: true },
          ],
        },
      }],
    });

    expect(screen.getByText('Last: 7 × 180 lb')).toBeTruthy();
    expect(screen.getByText('Last: 6 × 175 lb')).toBeTruthy();
  });

  it('ignores an unfinished newer workout when showing last session', () => {
    renderActiveWorkout({
      workouts: { [twoSetWorkout.title]: twoSetWorkout },
      logs: { [logKey]: twoSetLog() },
      allLogs: [
        {
          key: '2026-07-01::Full-Body Express',
          date: '2026-07-01',
          exercises: { 'Back Squat': [{ actualReps: 1, actualWeight: 50, completed: true }] },
        },
        {
          key: '2026-06-27::Full-Body Express',
          date: '2026-06-27',
          completedAt: '2026-06-27T12:00:00.000Z',
          exercises: { 'Back Squat': [{ actualReps: 7, actualWeight: 180, unit: 'lb', completed: true }] },
        },
      ],
    });
    expect(screen.getByText('Last: 7 × 180 lb')).toBeTruthy();
    expect(screen.queryByText('Last: 1 × 50 lb')).toBeNull();
  });

  it('persists workout notes immediately for crash recovery', () => {
    const { saveLog } = renderActiveWorkout();

    fireEvent.change(screen.getByPlaceholderText(/How did the session feel/i), {
      target: { value: 'Felt strong before leaving the gym.' },
    });

    expect(saveLog).toHaveBeenCalledWith(
      logKey,
      expect.objectContaining({
        workoutNote: 'Felt strong before leaving the gym.',
      })
    );
  });

  it('persists a completed Set with its actual reps and weight immediately', () => {
    const { saveLog } = renderActiveWorkout({
      workouts: { [twoSetWorkout.title]: twoSetWorkout },
      logs: { [logKey]: twoSetLog() },
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark complete' })[0]);

    const lastCall = saveLog.mock.calls.at(-1);
    expect(lastCall[0]).toBe(logKey);
    expect(lastCall[1].exercises['Back Squat'][0]).toMatchObject({
      completed: true,
      actualReps: 8,
      actualWeight: 185,
    });
  });

  it('starts rest without blocking the next set or taking focus away from logging', () => {
    renderActiveWorkout({
      workouts: { [twoSetWorkout.title]: twoSetWorkout },
      logs: { [logKey]: twoSetLog() },
    });
    const nextSet = screen.getAllByRole('button', { name: 'Mark complete' })[1];
    nextSet.focus();
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark complete' })[0]);

    expect(screen.getByRole('region', { name: 'Rest timer' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: /rest timer/i })).toBeNull();
    expect(nextSet.closest('[inert]')).toBeNull();
    expect(document.activeElement).toBe(nextSet);
  });

  it('stops rest when the workout is finished early', () => {
    renderActiveWorkout({
      workouts: { [twoSetWorkout.title]: twoSetWorkout },
      logs: { [logKey]: twoSetLog() },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark complete' })[0]);
    expect(screen.getByRole('region', { name: 'Rest timer' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Finish (1/2 sets)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish Anyway' }));
    expect(document.querySelector('.rest-timer')).toBeNull();
    expect(screen.getByText('Workout complete')).toBeTruthy();
  });

  it('does not overwrite an earlier logged Set when a later Set is completed', () => {
    const { saveLog } = renderActiveWorkout({
      workouts: { [twoSetWorkout.title]: twoSetWorkout },
      logs: { [logKey]: twoSetLog() },
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark complete' })[0]);
    // Skipping rest keeps this test focused on sequential set persistence.
    fireEvent.click(screen.getByLabelText('Skip rest'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark complete' })[0]);

    const finalLog = saveLog.mock.calls.at(-1)[1];
    expect(finalLog.exercises['Back Squat'][0].completed).toBe(true);
    expect(finalLog.exercises['Back Squat'][1].completed).toBe(true);
  });

  it('logs a newly added target Set even when the Log has fewer entries than the Workout', () => {
    // Reproduces the post target-edit state: the Workout gained a Set but the
    // active Log has not been reconciled, so its Set array is shorter.
    const shortLog = {
      logKey,
      workoutTitle: 'Full-Body Express',
      date: '2026-07-04',
      completedAt: null,
      startedAt: '2026-07-04T12:00:00.000Z',
      exercises: {
        'Back Squat': [
          { setIndex: 0, targetReps: 8, targetWeight: 185, unit: 'lb', actualReps: 8, actualWeight: 185, completed: true },
        ],
      },
      exerciseNotes: {},
      workoutNote: '',
    };
    const { saveLog } = renderActiveWorkout({
      workouts: { [twoSetWorkout.title]: twoSetWorkout },
      logs: { [logKey]: shortLog },
    });

    // The second (added) row has no logged entry yet; completing it must append.
    fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }));

    const finalLog = saveLog.mock.calls.at(-1)[1];
    expect(finalLog.exercises['Back Squat']).toHaveLength(2);
    expect(finalLog.exercises['Back Squat'][1].completed).toBe(true);
  });
});

describe('ActiveWorkoutView — completion summary', () => {
  it('reports a PR against earlier Sessions without comparing the Session to itself', () => {
    renderActiveWorkout({
      allLogs: [
        {
          key: '2026-07-04::Full-Body Express',
          ...existingLog,
          completedAt: '2026-07-04T13:00:00.000Z',
        },
        {
          key: '2026-06-27::Full-Body Express',
          date: '2026-06-27',
          workoutTitle: 'Full-Body Express',
          completedAt: '2026-06-27T12:00:00.000Z',
          exercises: { 'Back Squat': [{ actualReps: 8, actualWeight: 180, unit: 'lb', completed: true }] },
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Complete Workout' }));

    const dialog = screen.getByRole('dialog', { name: 'Workout complete' });
    expect(within(dialog).getByText('New PRs')).toBeTruthy();
    expect(within(dialog).getByText('Back Squat')).toBeTruthy();
    expect(within(dialog).getByText(/8 × 185 lb/)).toBeTruthy();
    expect(within(dialog).queryByText('New Baselines')).toBeNull();
  });
});
