import { describe, it, expect } from 'vitest';
import { findPreviousSets, formatLastHint } from './exerciseHistory';

describe('findPreviousSets', () => {
  it('returns null when allLogs is empty', () => {
    expect(findPreviousSets({}, 'Upper A', 'Bench Press')).toBeNull();
  });

  it('returns null when allLogs is null', () => {
    expect(findPreviousSets(null, 'Upper A', 'Bench Press')).toBeNull();
  });

  it('returns null when no matching workout', () => {
    const logs = {
      '2026-03-01::Lower A': {
        key: '2026-03-01::Lower A',
        date: '2026-03-01',
        exercises: { 'Squat': [{ actualReps: 5, actualWeight: 225, completed: true }] },
      },
    };
    expect(findPreviousSets(logs, 'Upper A', 'Bench Press')).toBeNull();
  });

  it('returns sets from most recent matching log', () => {
    const logs = {
      '2026-03-01::Upper A': {
        key: '2026-03-01::Upper A',
        date: '2026-03-01',
        exercises: { 'Bench Press': [{ actualReps: 8, actualWeight: 135 }] },
      },
      '2026-03-08::Upper A': {
        key: '2026-03-08::Upper A',
        date: '2026-03-08',
        exercises: { 'Bench Press': [{ actualReps: 8, actualWeight: 145 }] },
      },
    };
    const result = findPreviousSets(logs, 'Upper A', 'Bench Press', { before: '2026-03-15' });
    expect(result).toEqual([{ actualReps: 8, actualWeight: 145 }]);
  });

  it('filters out logs on or after the before date', () => {
    const logs = {
      '2026-03-08::Upper A': {
        key: '2026-03-08::Upper A',
        date: '2026-03-08',
        exercises: { 'Bench Press': [{ actualReps: 8, actualWeight: 145 }] },
      },
      '2026-03-01::Upper A': {
        key: '2026-03-01::Upper A',
        date: '2026-03-01',
        exercises: { 'Bench Press': [{ actualReps: 8, actualWeight: 135 }] },
      },
    };
    const result = findPreviousSets(logs, 'Upper A', 'Bench Press', { before: '2026-03-08' });
    expect(result).toEqual([{ actualReps: 8, actualWeight: 135 }]);
  });

  it('returns null when exercise not in matching workout', () => {
    const logs = {
      '2026-03-01::Upper A': {
        key: '2026-03-01::Upper A',
        date: '2026-03-01',
        exercises: { 'Overhead Press': [{ actualReps: 5, actualWeight: 95 }] },
      },
    };
    expect(findPreviousSets(logs, 'Upper A', 'Bench Press', { before: '2026-03-15' })).toBeNull();
  });

  it('uses logKey field when key is absent', () => {
    const logs = {
      '2026-03-01::Upper A': {
        logKey: '2026-03-01::Upper A',
        date: '2026-03-01',
        exercises: { 'Bench Press': [{ actualReps: 10, actualWeight: 115 }] },
      },
    };
    const result = findPreviousSets(logs, 'Upper A', 'Bench Press', { before: '2026-03-15' });
    expect(result).toEqual([{ actualReps: 10, actualWeight: 115 }]);
  });
});

describe('formatLastHint', () => {
  it('returns null for null prevSet', () => {
    expect(formatLastHint(null, { isBodyweight: false, isTimeReps: false })).toBeNull();
  });

  it('returns null when both reps and weight are empty', () => {
    expect(formatLastHint(
      { actualReps: '', actualWeight: '' },
      { isBodyweight: false, isTimeReps: false }
    )).toBeNull();
  });

  it('formats weight + reps hint', () => {
    const hint = formatLastHint(
      { actualReps: 8, actualWeight: 185, unit: 'lb' },
      { isBodyweight: false, isTimeReps: false }
    );
    expect(hint).toBe('Last: 8 × 185 lb');
  });

  it('formats bodyweight reps hint', () => {
    const hint = formatLastHint(
      { actualReps: 12, actualWeight: '', unit: 'bw' },
      { isBodyweight: true, isTimeReps: false }
    );
    expect(hint).toBe('Last: 12 reps');
  });

  it('formats timed reps hint', () => {
    const hint = formatLastHint(
      { actualReps: 90, actualWeight: '', unit: 'bw' },
      { isBodyweight: true, isTimeReps: true }
    );
    expect(hint).toBe('Last: 01:30');
  });

  it('formats timed weight hint', () => {
    const hint = formatLastHint(
      { actualReps: 3, actualWeight: 120, unit: 'sec' },
      { isBodyweight: false, isTimeReps: false }
    );
    expect(hint).toBe('Last: 3 × 02:00');
  });
});
