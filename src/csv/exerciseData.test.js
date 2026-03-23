import { describe, it, expect } from 'vitest';
import { parseExerciseData, formatSet } from './exerciseData';

describe('parseExerciseData', () => {
  it('parses standard reps x weight', () => {
    const sets = parseExerciseData('6, 6, 6 rep x 40, 40, 40 pound');
    expect(sets).toHaveLength(3);
    expect(sets[0]).toMatchObject({ reps: 6, weight: 40, unit: 'lb' });
    expect(sets[2]).toMatchObject({ reps: 6, weight: 40, unit: 'lb' });
  });

  it('parses single set', () => {
    const sets = parseExerciseData('8 reps x 135 lbs');
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ reps: 8, weight: 135, unit: 'lb' });
  });

  it('parses bodyweight exercises', () => {
    const sets = parseExerciseData('5 rep x Bodyweight');
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ reps: 5, weight: null, unit: 'bw' });
  });

  it('parses AMRAP', () => {
    const sets = parseExerciseData('amrap');
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ reps: null, weight: null, unit: 'bw' });
  });

  it('parses percentage-based weights', () => {
    const sets = parseExerciseData('3 rep x 60%');
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ reps: 3, weight: 60, unit: '%' });
  });

  it('parses kg weights', () => {
    const sets = parseExerciseData('5 reps x 100 kg');
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ reps: 5, weight: 100, unit: 'kg' });
  });

  it('broadcasts last weight to all sets', () => {
    const sets = parseExerciseData('6, 6, 6 rep x 40 pound');
    expect(sets).toHaveLength(3);
    sets.forEach((s) => expect(s.weight).toBe(40));
  });

  it('handles empty string', () => {
    expect(parseExerciseData('')).toEqual([]);
  });

  it('handles null/undefined', () => {
    expect(parseExerciseData(null)).toEqual([]);
    expect(parseExerciseData(undefined)).toEqual([]);
  });

  it('handles no weight part (bodyweight default)', () => {
    const sets = parseExerciseData('10 reps');
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ reps: 10, unit: 'bw' });
  });

  it('parses multiple different rep counts', () => {
    const sets = parseExerciseData('8, 6, 4 rep x 100, 120, 140 lb');
    expect(sets).toHaveLength(3);
    expect(sets[0]).toMatchObject({ reps: 8, weight: 100 });
    expect(sets[1]).toMatchObject({ reps: 6, weight: 120 });
    expect(sets[2]).toMatchObject({ reps: 4, weight: 140 });
  });
});

describe('formatSet', () => {
  it('formats standard set', () => {
    expect(formatSet({ reps: 6, weight: 40, unit: 'lb' })).toBe('6 × 40lb');
  });

  it('formats AMRAP', () => {
    expect(formatSet({ reps: null, weight: null, unit: 'bw' })).toBe('AMRAP × BW');
  });

  it('formats bodyweight', () => {
    expect(formatSet({ reps: 10, weight: null, unit: 'bw' })).toBe('10 × BW');
  });

  it('handles null input', () => {
    expect(formatSet(null)).toBe('');
  });

  it('formats percentage set', () => {
    expect(formatSet({ reps: 3, weight: 60, unit: '%' })).toBe('3 × 60%');
  });
});
