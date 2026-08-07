// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExerciseHistoryView from './ExerciseHistoryView.jsx';

function makeLog(date, weight, reps = 8) {
  return {
    date,
    completedAt: `${date}T09:00:00`,
    workoutTitle: 'Upper A',
    exercises: {
      'Bench Press': [
        { completed: true, actualReps: reps, actualWeight: weight, unit: 'lb' },
      ],
    },
  };
}

describe('ExerciseHistoryView — progress chart baseline vs PR', () => {
  it('never marks the first-ever session as a personal record (it is a baseline)', () => {
    // Weight only goes up across three sessions, so if the first were
    // (incorrectly) compared against -Infinity it would wrongly earn a PR
    // marker too — the fix must treat it as a baseline with nothing to beat.
    const allLogs = [makeLog('2026-01-08', 100), makeLog('2026-01-15', 110)];
    render(<ExerciseHistoryView exerciseTitle="Bench Press" allLogs={allLogs} navigate={() => {}} />);

    const points = screen.getAllByRole('button', { name: /reps @/ });
    expect(points).toHaveLength(2);
    expect(points[0].getAttribute('aria-label')).not.toMatch(/personal record/);
    expect(points[1].getAttribute('aria-label')).toMatch(/personal record/);
  });

  it('does not mark a session that fails to beat the running best as a PR', () => {
    const allLogs = [
      makeLog('2026-01-08', 100),
      makeLog('2026-01-15', 110),
      makeLog('2026-01-22', 105),
    ];
    render(<ExerciseHistoryView exerciseTitle="Bench Press" allLogs={allLogs} navigate={() => {}} />);

    const points = screen.getAllByRole('button', { name: /reps @/ });
    expect(points).toHaveLength(3);
    expect(points[0].getAttribute('aria-label')).not.toMatch(/personal record/); // baseline
    expect(points[1].getAttribute('aria-label')).toMatch(/personal record/); // genuine PR
    expect(points[2].getAttribute('aria-label')).not.toMatch(/personal record/); // below running best
  });
});
