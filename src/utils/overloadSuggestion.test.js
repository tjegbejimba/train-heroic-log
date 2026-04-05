import { describe, it, expect } from 'vitest';
import { computeSuggestion, formatOverloadHint } from './overloadSuggestion';

describe('computeSuggestion', () => {
  it('weighted lb, hit target → +5 lb', () => {
    const lastSet = { actualReps: 10, actualWeight: 135, unit: 'lb' };
    expect(computeSuggestion(lastSet, 10, 'lb', 'reps'))
      .toEqual({ reps: 10, weight: 140, unit: 'lb', didProgress: true });
  });

  it('weighted kg, hit target → +2.5 kg', () => {
    const lastSet = { actualReps: 8, actualWeight: 60, unit: 'kg' };
    expect(computeSuggestion(lastSet, 8, 'kg', 'reps'))
      .toEqual({ reps: 8, weight: 62.5, unit: 'kg', didProgress: true });
  });

  it('weighted, below target → same weight with target reps', () => {
    const lastSet = { actualReps: 8, actualWeight: 135, unit: 'lb' };
    expect(computeSuggestion(lastSet, 10, 'lb', 'reps'))
      .toEqual({ reps: 10, weight: 135, unit: 'lb', didProgress: false });
  });

  it('weighted, no target reps → +5 lb with same reps', () => {
    const lastSet = { actualReps: 8, actualWeight: 135, unit: 'lb' };
    expect(computeSuggestion(lastSet, null, 'lb', 'reps'))
      .toEqual({ reps: 8, weight: 140, unit: 'lb', didProgress: true });
  });

  it('exceeded target → uses target reps with weight bump', () => {
    const lastSet = { actualReps: 12, actualWeight: 135, unit: 'lb' };
    expect(computeSuggestion(lastSet, 10, 'lb', 'reps'))
      .toEqual({ reps: 10, weight: 140, unit: 'lb', didProgress: true });
  });

  it('bodyweight (unit=bw) → +1 rep', () => {
    const lastSet = { actualReps: 8, actualWeight: 0, unit: 'bw' };
    expect(computeSuggestion(lastSet, null, 'bw', 'reps'))
      .toEqual({ reps: 9, weight: 0, unit: 'bw', didProgress: true });
  });

  it('bodyweight (unit=reps) → +1 rep', () => {
    const lastSet = { actualReps: 12, actualWeight: 0, unit: 'reps' };
    expect(computeSuggestion(lastSet, null, 'reps', 'reps'))
      .toEqual({ reps: 13, weight: 0, unit: 'reps', didProgress: true });
  });

  it('time-based (repsUnit=sec) → +5 seconds', () => {
    const lastSet = { actualReps: 45, actualWeight: 0, unit: 'lb' };
    expect(computeSuggestion(lastSet, null, 'lb', 'sec'))
      .toEqual({ reps: 50, weight: 0, unit: 'lb', didProgress: true });
  });

  it('time-based (repsUnit=time) → +5 seconds', () => {
    const lastSet = { actualReps: 30, actualWeight: 0, unit: 'bw' };
    expect(computeSuggestion(lastSet, null, 'bw', 'time'))
      .toEqual({ reps: 35, weight: 0, unit: 'bw', didProgress: true });
  });

  it('null lastSet → returns null', () => {
    expect(computeSuggestion(null, 10, 'lb', 'reps')).toBeNull();
  });

  it('lastSet missing actualReps → returns null', () => {
    expect(computeSuggestion({ actualWeight: 135, unit: 'lb' }, 10, 'lb', 'reps')).toBeNull();
  });

  it('lastSet with empty string actualReps → returns null', () => {
    expect(computeSuggestion({ actualReps: '', actualWeight: 135, unit: 'lb' }, 10, 'lb', 'reps')).toBeNull();
  });

  it('0 weight, non-BW unit → treated as weighted, bumps to increment', () => {
    const lastSet = { actualReps: 10, actualWeight: 0, unit: 'lb' };
    expect(computeSuggestion(lastSet, 10, 'lb', 'reps'))
      .toEqual({ reps: 10, weight: 5, unit: 'lb', didProgress: true });
  });
});

describe('formatOverloadHint', () => {
  it('weighted with progression → "10×135 → 10×140"', () => {
    const lastSet = { actualReps: 10, actualWeight: 135 };
    const suggestion = { reps: 10, weight: 140, didProgress: true };
    expect(formatOverloadHint(lastSet, suggestion, 'lb', 'reps')).toBe('10×135 → 10×140');
  });

  it('weighted below target → "8×135 → 10×135"', () => {
    const lastSet = { actualReps: 8, actualWeight: 135 };
    const suggestion = { reps: 10, weight: 135, didProgress: false };
    expect(formatOverloadHint(lastSet, suggestion, 'lb', 'reps')).toBe('8×135 → 10×135');
  });

  it('bodyweight → "8 reps → 9 reps"', () => {
    const lastSet = { actualReps: 8, actualWeight: 0 };
    const suggestion = { reps: 9, weight: 0, didProgress: true };
    expect(formatOverloadHint(lastSet, suggestion, 'bw', 'reps')).toBe('8 reps → 9 reps');
  });

  it('time-based → "00:45 → 00:50"', () => {
    const lastSet = { actualReps: 45, actualWeight: 0 };
    const suggestion = { reps: 50, weight: 0, didProgress: true };
    expect(formatOverloadHint(lastSet, suggestion, 'lb', 'sec')).toBe('00:45 → 00:50');
  });

  it('null suggestion → just "8×135"', () => {
    const lastSet = { actualReps: 8, actualWeight: 135 };
    expect(formatOverloadHint(lastSet, null, 'lb', 'reps')).toBe('8×135');
  });

  it('null lastSet → returns null', () => {
    expect(formatOverloadHint(null, null, 'lb', 'reps')).toBeNull();
  });

  it('bodyweight, no suggestion → "8 reps"', () => {
    const lastSet = { actualReps: 8, actualWeight: 0 };
    expect(formatOverloadHint(lastSet, null, 'bw', 'reps')).toBe('8 reps');
  });

  it('time-based, no suggestion → "00:45"', () => {
    const lastSet = { actualReps: 45, actualWeight: 0 };
    expect(formatOverloadHint(lastSet, null, 'lb', 'sec')).toBe('00:45');
  });
});
