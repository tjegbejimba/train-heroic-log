import { describe, it, expect } from 'vitest';
import { buildSummary, findPRs } from './workoutSummary.js';

describe('buildSummary', () => {
  it('counts completed vs total sets', () => {
    const log = {
      exercises: {
        'Bench Press': [
          { completed: true, actualReps: 8, actualWeight: 135, unit: 'lb' },
          { completed: true, actualReps: 8, actualWeight: 135, unit: 'lb' },
          { completed: false, actualReps: '', actualWeight: '' },
        ],
      },
    };
    const result = buildSummary(log);
    expect(result.totalCompleted).toBe(2);
    expect(result.totalSets).toBe(3);
  });

  it('calculates duration in minutes', () => {
    const log = {
      startedAt: '2026-01-15T10:00:00Z',
      completedAt: '2026-01-15T10:45:00Z',
      exercises: {},
    };
    expect(buildSummary(log).durationMin).toBe(45);
  });

  it('returns null duration when timestamps missing', () => {
    expect(buildSummary({ exercises: {} }).durationMin).toBeNull();
  });

  it('calculates volume grouped by unit', () => {
    const log = {
      exercises: {
        'Bench': [
          { completed: true, actualReps: 10, actualWeight: 135, unit: 'lb' },
          { completed: true, actualReps: 8, actualWeight: 60, unit: 'kg' },
        ],
      },
    };
    const result = buildSummary(log);
    expect(result.volumeByUnit['lb']).toBe(1350);
    expect(result.volumeByUnit['kg']).toBe(480);
  });

  it('skips incomplete sets in volume calculation', () => {
    const log = {
      exercises: {
        'Squat': [
          { completed: true, actualReps: 5, actualWeight: 225, unit: 'lb' },
          { completed: false, actualReps: 5, actualWeight: 225, unit: 'lb' },
        ],
      },
    };
    expect(buildSummary(log).volumeByUnit['lb']).toBe(1125);
  });

  it('returns null for null/undefined log', () => {
    expect(buildSummary(null)).toBeNull();
    expect(buildSummary(undefined)).toBeNull();
  });
});

describe('findPRs', () => {
  const makePrevLog = (date, exercises) => ({ date, exercises, key: `${date}::Test` });

  it('detects PR when current weight exceeds previous best', () => {
    const log = {
      exercises: {
        'Bench': [{ completed: true, actualReps: 8, actualWeight: 185, unit: 'lb' }],
      },
    };
    const allLogs = [
      makePrevLog('2026-01-10', { 'Bench': [{ completed: true, actualReps: 8, actualWeight: 175 }] }),
    ];
    const prs = findPRs(log, allLogs, '2026-01-15');
    expect(prs).toHaveLength(1);
    expect(prs[0]).toEqual({ exTitle: 'Bench', reps: 8, weight: 185, unit: 'lb' });
  });

  it('detects PR for first-ever exercise (no history)', () => {
    const log = {
      exercises: {
        'OHP': [{ completed: true, actualReps: 5, actualWeight: 95, unit: 'lb' }],
      },
    };
    const prs = findPRs(log, [], '2026-01-15');
    expect(prs).toHaveLength(1);
  });

  it('does not detect PR when matching previous best', () => {
    const log = {
      exercises: {
        'Bench': [{ completed: true, actualReps: 8, actualWeight: 175, unit: 'lb' }],
      },
    };
    const allLogs = [
      makePrevLog('2026-01-10', { 'Bench': [{ completed: true, actualReps: 8, actualWeight: 175 }] }),
    ];
    expect(findPRs(log, allLogs, '2026-01-15')).toHaveLength(0);
  });

  it('ignores incomplete sets', () => {
    const log = {
      exercises: {
        'Bench': [{ completed: false, actualReps: 8, actualWeight: 300, unit: 'lb' }],
      },
    };
    expect(findPRs(log, [], '2026-01-15')).toHaveLength(0);
  });

  it('deduplicates same exercise/reps/weight combo', () => {
    const log = {
      exercises: {
        'Bench': [
          { completed: true, actualReps: 8, actualWeight: 185, unit: 'lb' },
          { completed: true, actualReps: 8, actualWeight: 185, unit: 'lb' },
        ],
      },
    };
    expect(findPRs(log, [], '2026-01-15')).toHaveLength(1);
  });

  it('excludes same-day logs from history', () => {
    const log = {
      exercises: {
        'Bench': [{ completed: true, actualReps: 8, actualWeight: 185, unit: 'lb' }],
      },
    };
    const allLogs = [
      makePrevLog('2026-01-15', { 'Bench': [{ completed: true, actualReps: 8, actualWeight: 200 }] }),
    ];
    // Same day log should NOT count as history, so 185 is a PR (no prior)
    expect(findPRs(log, allLogs, '2026-01-15')).toHaveLength(1);
  });

  it('returns empty for null log', () => {
    expect(findPRs(null, [], '2026-01-15')).toEqual([]);
  });
});
