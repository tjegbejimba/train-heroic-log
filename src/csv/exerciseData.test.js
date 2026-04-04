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

  // --- Yards ---
  it('parses yard-based distances', () => {
    const sets = parseExerciseData('1 rep x 100 yards');
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ reps: 1, weight: 100, unit: 'yd' });
  });

  it('parses singular yard', () => {
    const sets = parseExerciseData('2, 2 rep x 50 yard');
    expect(sets).toHaveLength(2);
    expect(sets[0]).toMatchObject({ reps: 2, weight: 50, unit: 'yd' });
  });

  it('parses sprint yard data', () => {
    const sets = parseExerciseData('1, 1, 1, 1 rep x 10, 10, 10, 10 yard');
    expect(sets).toHaveLength(4);
    sets.forEach((s) => expect(s).toMatchObject({ reps: 1, weight: 10, unit: 'yd' }));
  });

  // --- Meters ---
  it('parses meter-based distances', () => {
    const sets = parseExerciseData('1 rep x 200 meters');
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ reps: 1, weight: 200, unit: 'm' });
  });

  // --- Percent word ---
  it('parses "percent" word (not just % symbol)', () => {
    const sets = parseExerciseData('480 time x 35 percent');
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ reps: 480, weight: 35, unit: '%' });
  });

  // --- RPE ---
  it('parses RPE-based data', () => {
    const sets = parseExerciseData('15, 15, 15 time x 6, 6, 6 RPE');
    expect(sets).toHaveLength(3);
    expect(sets[0]).toMatchObject({ reps: 15, weight: 6, unit: 'RPE' });
  });

  // --- Inches ---
  it('parses inch-based data (box heights)', () => {
    const sets = parseExerciseData('5, 5 rep x 24, 24 inch');
    expect(sets).toHaveLength(2);
    expect(sets[0]).toMatchObject({ reps: 5, weight: 24, unit: 'in' });
  });

  // --- Feet ---
  it('parses foot-based data (distance)', () => {
    const sets = parseExerciseData('5, 5 rep x 5, 5 foot');
    expect(sets).toHaveLength(2);
    expect(sets[0]).toMatchObject({ reps: 5, weight: 5, unit: 'ft' });
  });

  // --- Seconds ---
  it('parses second-based data', () => {
    const sets = parseExerciseData('30 second x 135 pound');
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ reps: 30, weight: 135, unit: 'lb' });
  });

  // --- Rep on weight side (bodyweight) ---
  it('parses mirrored rep x rep as bodyweight', () => {
    const sets = parseExerciseData('10, 10, 10 rep x 10, 10, 10 rep');
    expect(sets).toHaveLength(3);
    expect(sets[0]).toMatchObject({ reps: 10, weight: null, unit: 'bw' });
  });

  it('parses "rep x rep" (empty prescribed) as bodyweight', () => {
    const sets = parseExerciseData('rep x  rep');
    expect(sets).toHaveLength(0); // no actual reps data
  });

  // --- Zero reps with actual reps on weight side ---
  it('parses 0 reps with actual counts on weight side', () => {
    const sets = parseExerciseData('0, 0, 0 rep x 20, 15, 17 rep');
    expect(sets).toHaveLength(3);
    expect(sets[0]).toMatchObject({ reps: 20, weight: null, unit: 'bw' });
    expect(sets[1]).toMatchObject({ reps: 15, weight: null, unit: 'bw' });
    expect(sets[2]).toMatchObject({ reps: 17, weight: null, unit: 'bw' });
  });

  // --- Reversed columns ---
  it('handles reversed columns (weight on reps side)', () => {
    const sets = parseExerciseData('135, 135, 135 pound x 40, 40, 40 time');
    expect(sets).toHaveLength(3);
    expect(sets[0]).toMatchObject({ reps: 40, weight: 135, unit: 'lb' });
  });

  // --- HH:MM time format ---
  it('parses HH:MM time format as seconds', () => {
    const sets = parseExerciseData('00:20, 00:20, 00:20 time x 6, 6, 6 RPE');
    expect(sets).toHaveLength(3);
    expect(sets[0]).toMatchObject({ reps: 20, weight: 6, unit: 'RPE' });
  });

  it('parses MM:SS time format', () => {
    const sets = parseExerciseData('00:45, 00:45 time x 5, 5 RPE');
    expect(sets).toHaveLength(2);
    expect(sets[0]).toMatchObject({ reps: 45, weight: 5, unit: 'RPE' });
  });

  // --- Bare/minimal patterns ---
  it('handles bare "x" pattern', () => {
    const sets = parseExerciseData('x');
    expect(sets).toHaveLength(0);
  });

  it('handles "rep x" with no weight', () => {
    const sets = parseExerciseData('rep x');
    expect(sets).toHaveLength(0);
  });
});

describe('formatSet', () => {
  it('formats standard set', () => {
    expect(formatSet({ reps: 6, weight: 40, unit: 'lb' })).toBe('6 × 40 lb');
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
    expect(formatSet({ reps: 3, weight: 60, unit: '%' })).toBe('3 × 60 %');
  });

  it('formats yard set', () => {
    expect(formatSet({ reps: 1, weight: 100, unit: 'yd' })).toBe('1 × 100 yd');
  });

  it('formats meter set', () => {
    expect(formatSet({ reps: 1, weight: 200, unit: 'm' })).toBe('1 × 200 m');
  });

  it('formats RPE set', () => {
    expect(formatSet({ reps: 15, weight: 6, unit: 'RPE' })).toBe('15 × 6 RPE');
  });

  it('formats inch set', () => {
    expect(formatSet({ reps: 5, weight: 24, unit: 'in' })).toBe('5 × 24 in');
  });

  it('formats foot set', () => {
    expect(formatSet({ reps: 5, weight: 5, unit: 'ft' })).toBe('5 × 5 ft');
  });

  it('formats time/sec set', () => {
    expect(formatSet({ reps: 20, weight: 6, unit: 'time' })).toBe('20 × 00:06');
  });
});
