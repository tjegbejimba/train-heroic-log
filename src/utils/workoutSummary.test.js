import { describe, it, expect } from 'vitest';
import { buildSummary, findRecords, classifyAgainstBest, markRunningRecords } from './workoutSummary.js';

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

describe('classifyAgainstBest', () => {
  it('returns "baseline" when there is no previous best', () => {
    expect(classifyAgainstBest(undefined, 100)).toBe('baseline');
    expect(classifyAgainstBest(null, 100)).toBe('baseline');
  });

  it('returns "pr" when the value beats the previous best', () => {
    expect(classifyAgainstBest(95, 100)).toBe('pr');
  });

  it('returns null when the value matches or falls short of the previous best', () => {
    expect(classifyAgainstBest(100, 100)).toBeNull();
    expect(classifyAgainstBest(100, 90)).toBeNull();
  });

  it('treats a previous best of 0 as an established best, not absence of history', () => {
    // 0 is a legitimate (if unusual) recorded value — must not be confused with "no history".
    expect(classifyAgainstBest(0, 5)).toBe('pr');
  });
});

describe('findRecords', () => {
  const makePrevLog = (date, exercises) => ({ date, exercises, key: `${date}::Test` });

  it('classifies a genuine PR when current weight exceeds previous best', () => {
    const log = {
      exercises: {
        'Bench': [{ completed: true, actualReps: 8, actualWeight: 185, unit: 'lb' }],
      },
    };
    const allLogs = [
      makePrevLog('2026-01-10', { 'Bench': [{ completed: true, actualReps: 8, actualWeight: 175 }] }),
    ];
    const records = findRecords(log, allLogs, '2026-01-15');
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({ exTitle: 'Bench', reps: 8, weight: 185, unit: 'lb', kind: 'pr' });
  });

  it('classifies a first-ever exercise (no history) as a baseline, not a PR', () => {
    const log = {
      exercises: {
        'OHP': [{ completed: true, actualReps: 5, actualWeight: 95, unit: 'lb' }],
      },
    };
    const records = findRecords(log, [], '2026-01-15');
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe('baseline');
  });

  it('does not detect any record when matching previous best', () => {
    const log = {
      exercises: {
        'Bench': [{ completed: true, actualReps: 8, actualWeight: 175, unit: 'lb' }],
      },
    };
    const allLogs = [
      makePrevLog('2026-01-10', { 'Bench': [{ completed: true, actualReps: 8, actualWeight: 175 }] }),
    ];
    expect(findRecords(log, allLogs, '2026-01-15')).toHaveLength(0);
  });

  it('ignores incomplete sets', () => {
    const log = {
      exercises: {
        'Bench': [{ completed: false, actualReps: 8, actualWeight: 300, unit: 'lb' }],
      },
    };
    expect(findRecords(log, [], '2026-01-15')).toHaveLength(0);
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
    expect(findRecords(log, [], '2026-01-15')).toHaveLength(1);
  });

  it('excludes same-day logs from history, classifying as baseline (no prior)', () => {
    const log = {
      exercises: {
        'Bench': [{ completed: true, actualReps: 8, actualWeight: 185, unit: 'lb' }],
      },
    };
    const allLogs = [
      makePrevLog('2026-01-15', { 'Bench': [{ completed: true, actualReps: 8, actualWeight: 200 }] }),
    ];
    const records = findRecords(log, allLogs, '2026-01-15');
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe('baseline');
  });

  it('returns empty for null log', () => {
    expect(findRecords(null, [], '2026-01-15')).toEqual([]);
  });
});

describe('markRunningRecords', () => {
  it('marks the first item as a baseline, never a PR', () => {
    const items = [{ weight: 135 }];
    const [first] = markRunningRecords(items, (i) => i.weight);
    expect(first.kind).toBe('baseline');
  });

  it('marks subsequent higher values as PRs', () => {
    const items = [{ weight: 135 }, { weight: 145 }, { weight: 140 }, { weight: 150 }];
    const marked = markRunningRecords(items, (i) => i.weight);
    expect(marked.map((m) => m.kind)).toEqual(['baseline', 'pr', null, 'pr']);
  });

  it('does not mark a tie as a PR', () => {
    const items = [{ weight: 100 }, { weight: 100 }];
    const marked = markRunningRecords(items, (i) => i.weight);
    expect(marked.map((m) => m.kind)).toEqual(['baseline', null]);
  });
});
