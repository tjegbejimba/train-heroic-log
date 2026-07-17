// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ActiveWorkoutView from './ActiveWorkoutView.jsx';

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({ settings: { restDuration: 90 } }),
}));

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

  it('does not overwrite an earlier logged Set when a later Set is completed', () => {
    const { saveLog } = renderActiveWorkout({
      workouts: { [twoSetWorkout.title]: twoSetWorkout },
      logs: { [logKey]: twoSetLog() },
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark complete' })[0]);
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
