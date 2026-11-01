// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TrainingView from './TrainingView.jsx';

const COMPLETED_REASON = 'This day already has a completed workout. Schedule this template for another day.';

const template = {
  id: 'tpl_full_body',
  name: 'Full Body Template',
  blocks: [
    {
      value: 'A',
      exercises: [
        {
          title: 'Bench Press',
          sets: [{ reps: 5, weight: 135, unit: 'lb' }],
        },
      ],
    },
  ],
};

function renderTrainingView(overrides = {}) {
  const props = {
    currentDate: '2026-07-04',
    onDateChange: vi.fn(),
    workouts: {},
    schedule: {},
    completedDates: new Set(),
    getWorkoutForDate: vi.fn(() => null),
    getLog: vi.fn(() => null),
    onStartWorkout: vi.fn(),
    onScheduleTemplate: vi.fn(),
    templateList: [template],
    navigate: vi.fn(),
    ...overrides,
  };

  return { ...render(<TrainingView {...props} />), props };
}

describe('TrainingView', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('blocks Quick Start on a completed date even when no workout is scheduled', () => {
    const { props } = renderTrainingView({
      completedDates: new Set(['2026-07-04']),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Preview Full Body Template' }));

    const startNow = screen.getByRole('button', { name: /start now/i });
    expect(startNow.disabled).toBe(true);
    expect(screen.getByText(COMPLETED_REASON)).toBeTruthy();

    fireEvent.click(startNow);
    expect(props.onScheduleTemplate).not.toHaveBeenCalled();
    expect(props.onStartWorkout).not.toHaveBeenCalled();
  });

  it('shows the completed offline session rather than offering to start a coach replacement on the same date', () => {
    const actual = { title: 'Original Upper A', blocks: template.blocks };
    renderTrainingView({
      workouts: { 'Coach Upper A v2': { title: 'Coach Upper A v2', blocks: template.blocks } },
      schedule: { '2026-07-04': 'Coach Upper A v2' },
      getWorkoutForDate: () => 'Coach Upper A v2',
      completedDates: new Set(['2026-07-04']),
      completedLogForDate: {
        workoutTitle: actual.title, workoutSnapshot: actual,
        startedAt: '2026-07-04T10:00:00Z', completedAt: '2026-07-04T11:00:00Z', exercises: {},
      },
    });
    expect(screen.getByText('Workout Complete')).toBeTruthy();
    expect(screen.getByText('Original Upper A')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start Workout' })).toBeNull();
  });
});
