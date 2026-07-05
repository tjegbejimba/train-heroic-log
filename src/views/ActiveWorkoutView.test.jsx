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
});
