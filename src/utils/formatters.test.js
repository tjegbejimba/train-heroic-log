import { describe, it, expect } from 'vitest';
import { formatSet, groupSets, formatSetPrescription, secondsToMmss, mmssToSeconds } from './formatters.js';

describe('formatSet', () => {
  it('formats a single weighted set as "reps × weight unit"', () => {
    expect(formatSet({ reps: 8, weight: 135, unit: 'lb' })).toBe('8 × 135 lb');
  });

  it('formats a grouped weighted set as "count × reps @ weight unit"', () => {
    expect(formatSet({ reps: 8, weight: 135, unit: 'lb' }, 4)).toBe('4 × 8 @ 135 lb');
  });

  it('formats bodyweight sets without a weight figure', () => {
    expect(formatSet({ reps: 8, weight: null, unit: 'bw' }, 3)).toBe('3 × 8');
  });

  it('formats AMRAP sets', () => {
    expect(formatSet({ reps: null, weight: 135, unit: 'lb' }, 2)).toBe('2 × AMRAP @ 135 lb');
  });
});

describe('formatSetPrescription', () => {
  it('returns null for an empty or missing set list', () => {
    expect(formatSetPrescription([])).toBeNull();
    expect(formatSetPrescription(null)).toBeNull();
  });

  it('uses the multiplication shorthand with the canonical "×" glyph and spacing when sets are uniform', () => {
    const sets = [
      { reps: 8, weight: 135, unit: 'lb' },
      { reps: 8, weight: 135, unit: 'lb' },
      { reps: 8, weight: 135, unit: 'lb' },
      { reps: 8, weight: 135, unit: 'lb' },
    ];
    // Must match the same "N × R @ W unit" convention used everywhere else
    // in the app (HistoryView, ActiveWorkoutView, ExerciseRow) — not an
    // ad hoc "4x8 @ 135lb" format.
    expect(formatSetPrescription(sets)).toBe('4 × 8 @ 135 lb');
  });

  it('uses the shorthand for uniform bodyweight sets too', () => {
    const sets = [
      { reps: 12, weight: null, unit: 'bw' },
      { reps: 12, weight: null, unit: 'bw' },
      { reps: 12, weight: null, unit: 'bw' },
    ];
    expect(formatSetPrescription(sets)).toBe('3 × 12');
  });

  it('falls back to a spelled-out count when reps/weight vary per set', () => {
    const sets = [
      { reps: 8, weight: 135, unit: 'lb' },
      { reps: 6, weight: 155, unit: 'lb' },
    ];
    expect(formatSetPrescription(sets)).toBe('2 sets');
  });

  it('falls back to the singular single-set format (no count prefix) for one set', () => {
    const sets = [{ reps: 8, weight: 135, unit: 'lb' }];
    expect(formatSetPrescription(sets)).toBe('8 × 135 lb');
  });

  it('falls back to "N sets" when reps are missing entirely', () => {
    const sets = [{ reps: null, weight: null, unit: 'lb' }, { reps: null, weight: null, unit: 'lb' }];
    expect(formatSetPrescription(sets)).toBe('2 sets');
  });
});

describe('groupSets', () => {
  it('groups consecutive identical sets', () => {
    const sets = [
      { reps: 8, weight: 135, unit: 'lb', repsUnit: 'reps' },
      { reps: 8, weight: 135, unit: 'lb', repsUnit: 'reps' },
      { reps: 6, weight: 145, unit: 'lb', repsUnit: 'reps' },
    ];
    const groups = groupSets(sets);
    expect(groups).toHaveLength(2);
    expect(groups[0].count).toBe(2);
    expect(groups[1].count).toBe(1);
  });
});

describe('secondsToMmss / mmssToSeconds', () => {
  it('round-trips seconds through MM:SS', () => {
    expect(secondsToMmss(90)).toBe('01:30');
    expect(mmssToSeconds('01:30')).toBe(90);
  });
});
