import { describe, it, expect } from 'vitest';
import { makeLogKey, parseLogKey, makeExerciseKey } from './constants.js';

// ── makeLogKey ──────────────────────────────────────────────────────

describe('makeLogKey', () => {
  it('joins date and workout title with `::`', () => {
    expect(makeLogKey('2026-03-29', 'Upper A')).toBe('2026-03-29::Upper A');
  });

  it('handles workout titles with spaces and special characters', () => {
    expect(makeLogKey('2026-01-01', 'Push/Pull Day #1'))
      .toBe('2026-01-01::Push/Pull Day #1');
  });

  it('handles empty date string', () => {
    expect(makeLogKey('', 'Upper A')).toBe('::Upper A');
  });

  it('handles empty workout title', () => {
    expect(makeLogKey('2026-03-29', '')).toBe('2026-03-29::');
  });

  it('handles both empty strings', () => {
    expect(makeLogKey('', '')).toBe('::');
  });

  it('handles workout title containing `::`', () => {
    expect(makeLogKey('2026-03-29', 'Workout::Special'))
      .toBe('2026-03-29::Workout::Special');
  });
});

// ── parseLogKey ─────────────────────────────────────────────────────

describe('parseLogKey', () => {
  it('parses a standard log key into date and workoutTitle', () => {
    expect(parseLogKey('2026-03-29::Upper A')).toEqual({
      date: '2026-03-29',
      workoutTitle: 'Upper A',
    });
  });

  it('handles workout title with special characters', () => {
    expect(parseLogKey('2026-01-01::Push/Pull Day #1')).toEqual({
      date: '2026-01-01',
      workoutTitle: 'Push/Pull Day #1',
    });
  });

  it('handles workout title that contains `::`', () => {
    // The title "Workout::Special" has :: inside it
    expect(parseLogKey('2026-03-29::Workout::Special')).toEqual({
      date: '2026-03-29',
      workoutTitle: 'Workout::Special',
    });
  });

  it('handles key with empty date', () => {
    expect(parseLogKey('::Upper A')).toEqual({
      date: '',
      workoutTitle: 'Upper A',
    });
  });

  it('handles key with empty workout title', () => {
    expect(parseLogKey('2026-03-29::')).toEqual({
      date: '2026-03-29',
      workoutTitle: '',
    });
  });

  it('handles key with both parts empty', () => {
    expect(parseLogKey('::')).toEqual({
      date: '',
      workoutTitle: '',
    });
  });
});

// ── round-trip: makeLogKey → parseLogKey ────────────────────────────

describe('makeLogKey / parseLogKey round-trip', () => {
  it('recovers original date and title from a generated key', () => {
    const date = '2026-03-29';
    const title = 'Lower B';
    const parsed = parseLogKey(makeLogKey(date, title));
    expect(parsed.date).toBe(date);
    expect(parsed.workoutTitle).toBe(title);
  });

  it('round-trips when title contains `::`', () => {
    const date = '2025-12-31';
    const title = 'A::B::C';
    const parsed = parseLogKey(makeLogKey(date, title));
    expect(parsed.date).toBe(date);
    expect(parsed.workoutTitle).toBe(title);
  });

  it('round-trips with empty title', () => {
    const parsed = parseLogKey(makeLogKey('2026-03-29', ''));
    expect(parsed.date).toBe('2026-03-29');
    expect(parsed.workoutTitle).toBe('');
  });
});

// ── makeExerciseKey ─────────────────────────────────────────────────

describe('makeExerciseKey', () => {
  it('returns the exercise title as-is', () => {
    expect(makeExerciseKey('Bench Press')).toBe('Bench Press');
  });

  it('returns empty string for empty input', () => {
    expect(makeExerciseKey('')).toBe('');
  });

  it('preserves special characters', () => {
    expect(makeExerciseKey('Pull-Up (Weighted)')).toBe('Pull-Up (Weighted)');
  });

  it('returns undefined when called with undefined', () => {
    expect(makeExerciseKey(undefined)).toBeUndefined();
  });

  it('returns null when called with null', () => {
    expect(makeExerciseKey(null)).toBeNull();
  });
});
