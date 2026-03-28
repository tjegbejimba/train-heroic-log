import { describe, it, expect } from 'vitest';
import { parseCSV, normalizeDate } from './parser';

describe('normalizeDate', () => {
  it('parses M/D/YYYY format', () => {
    expect(normalizeDate('3/5/2026')).toBe('2026-03-05');
  });

  it('parses MM/DD/YYYY format', () => {
    expect(normalizeDate('12/25/2026')).toBe('2026-12-25');
  });

  it('passes through YYYY-MM-DD format', () => {
    expect(normalizeDate('2026-03-22')).toBe('2026-03-22');
  });

  it('returns invalid-date for empty string', () => {
    expect(normalizeDate('')).toBe('invalid-date');
  });

  it('returns invalid-date for null', () => {
    expect(normalizeDate(null)).toBe('invalid-date');
  });

  it('returns invalid-date for undefined', () => {
    expect(normalizeDate(undefined)).toBe('invalid-date');
  });

  it('trims whitespace', () => {
    expect(normalizeDate('  3/5/2026  ')).toBe('2026-03-05');
  });

  it('pads single digit month and day', () => {
    expect(normalizeDate('1/2/2026')).toBe('2026-01-02');
  });
});

describe('parseCSV', () => {
  const makeCSV = (rows) => {
    return rows.map((row) => row.join(',')).join('\n');
  };

  it('parses a simple CSV with one workout', () => {
    // ExerciseData with commas must be quoted in CSV
    const csv = [
      'WorkoutTitle,ScheduledDate,ExerciseTitle,ExerciseData,BlockValue,BlockUnits',
      'Push Day,3/22/2026,Bench Press,"6, 6, 6 rep x 135 lb",3,min',
    ].join('\n');
    const { workoutMap, scheduleMap, parseErrors } = parseCSV(csv);

    expect(parseErrors).toHaveLength(0);
    expect(workoutMap).toHaveProperty('Push Day');
    expect(workoutMap['Push Day'].title).toBe('Push Day');
    expect(workoutMap['Push Day'].blocks).toHaveLength(1);
    expect(workoutMap['Push Day'].blocks[0].exercises).toHaveLength(1);
    expect(workoutMap['Push Day'].blocks[0].exercises[0].title).toBe('Bench Press');
    expect(workoutMap['Push Day'].blocks[0].exercises[0].sets).toHaveLength(3);
    expect(scheduleMap['2026-03-22']).toBe('Push Day');
  });

  it('gives each exercise its own block', () => {
    const csv = makeCSV([
      ['WorkoutTitle', 'ScheduledDate', 'ExerciseTitle', 'ExerciseData', 'BlockValue', 'BlockUnits'],
      ['Push Day', '3/22/2026', 'Bench Press', '6 rep x 135 lb', '3', 'min'],
      ['Push Day', '3/22/2026', 'Overhead Press', '8 rep x 95 lb', '3', 'min'],
    ]);
    const { workoutMap } = parseCSV(csv);

    expect(workoutMap['Push Day'].blocks).toHaveLength(2);
    expect(workoutMap['Push Day'].blocks[0].exercises[0].title).toBe('Bench Press');
    expect(workoutMap['Push Day'].blocks[1].exercises[0].title).toBe('Overhead Press');
  });

  it('separates different workouts', () => {
    const csv = makeCSV([
      ['WorkoutTitle', 'ScheduledDate', 'ExerciseTitle', 'ExerciseData', 'BlockValue', 'BlockUnits'],
      ['Push Day', '3/22/2026', 'Bench Press', '6 rep x 135 lb', '3', 'min'],
      ['Pull Day', '3/23/2026', 'Pull Ups', '8 rep x Bodyweight', '3', 'min'],
    ]);
    const { workoutMap, scheduleMap } = parseCSV(csv);

    expect(Object.keys(workoutMap)).toHaveLength(2);
    expect(workoutMap).toHaveProperty('Push Day');
    expect(workoutMap).toHaveProperty('Pull Day');
    expect(scheduleMap['2026-03-22']).toBe('Push Day');
    expect(scheduleMap['2026-03-23']).toBe('Pull Day');
  });

  it('returns error for missing required columns', () => {
    const csv = makeCSV([
      ['SomeColumn', 'OtherColumn'],
      ['data', 'more data'],
    ]);
    const { parseErrors } = parseCSV(csv);
    expect(parseErrors.length).toBeGreaterThan(0);
    expect(parseErrors[0]).toContain('Missing required columns');
  });

  it('returns error for empty CSV', () => {
    const { parseErrors } = parseCSV('');
    expect(parseErrors.length).toBeGreaterThan(0);
  });

  it('handles quoted fields with commas', () => {
    const csv = [
      'WorkoutTitle,ScheduledDate,ExerciseTitle,ExerciseData,BlockValue,BlockUnits',
      '"Push, Pull Day",3/22/2026,Bench Press,6 rep x 135 lb,3,min',
    ].join('\n');
    const { workoutMap } = parseCSV(csv);
    expect(workoutMap).toHaveProperty('Push, Pull Day');
  });

  it('prefers RescheduledDate over ScheduledDate', () => {
    const csv = makeCSV([
      ['WorkoutTitle', 'ScheduledDate', 'RescheduledDate', 'ExerciseTitle', 'ExerciseData', 'BlockValue', 'BlockUnits'],
      ['Push Day', '3/22/2026', '3/25/2026', 'Bench Press', '6 rep x 135 lb', '3', 'min'],
    ]);
    const { scheduleMap } = parseCSV(csv);
    expect(scheduleMap['2026-03-25']).toBe('Push Day');
    expect(scheduleMap['2026-03-22']).toBeUndefined();
  });

  it('separates exercises into different blocks', () => {
    const csv = makeCSV([
      ['WorkoutTitle', 'ScheduledDate', 'ExerciseTitle', 'ExerciseData', 'BlockValue', 'BlockUnits'],
      ['Full Body', '3/22/2026', 'Squat', '5 rep x 225 lb', '5', 'min'],
      ['Full Body', '3/22/2026', 'Pull Ups', '8 rep x Bodyweight', '2', 'min'],
    ]);
    const { workoutMap } = parseCSV(csv);
    expect(workoutMap['Full Body'].blocks).toHaveLength(2);
  });

  it('deduplicates exercises across multiple dates of the same workout', () => {
    const csv = makeCSV([
      ['WorkoutTitle', 'ScheduledDate', 'ExerciseTitle', 'ExerciseData', 'BlockValue', 'BlockUnits'],
      ['Push Day', '3/1/2026', 'Bench Press', '"3, 3, 3 rep x 135 lb"', '3', 'min'],
      ['Push Day', '3/8/2026', 'Bench Press', '"3, 3, 3 rep x 140 lb"', '3', 'min'],
      ['Push Day', '3/15/2026', 'Bench Press', '"3, 3, 3 rep x 145 lb"', '3', 'min'],
    ]);
    const { workoutMap, scheduleMap } = parseCSV(csv);

    // Should use only one date's sets, not concatenate all 9
    const sets = workoutMap['Push Day'].blocks[0].exercises[0].sets;
    expect(sets).toHaveLength(3);

    // All three dates should still appear in the schedule
    expect(scheduleMap['2026-03-01']).toBe('Push Day');
    expect(scheduleMap['2026-03-08']).toBe('Push Day');
    expect(scheduleMap['2026-03-15']).toBe('Push Day');

    // Should use the most recent date's data (145 lb)
    expect(sets[0].weight).toBe(145);
  });
});
