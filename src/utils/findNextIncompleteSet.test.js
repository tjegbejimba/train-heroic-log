import { describe, it, expect } from 'vitest';
import { findNextIncompleteSet } from './findNextIncompleteSet';

describe('findNextIncompleteSet', () => {
  const makeWorkout = (blocks) => ({ blocks });
  const makeBlock = (exercises) => ({ exercises });
  const makeExercise = (title, setCount) => ({
    title,
    sets: Array.from({ length: setCount }, () => ({ reps: 10, weight: 100 })),
  });

  it('returns first incomplete set when all are incomplete', () => {
    const workout = makeWorkout([
      makeBlock([makeExercise('Bench Press', 3)]),
    ]);
    const currentLog = {
      exercises: {
        'Bench Press': [
          { completed: false },
          { completed: false },
          { completed: false },
        ],
      },
    };
    expect(findNextIncompleteSet(workout, currentLog)).toEqual({
      exerciseTitle: 'Bench Press',
      setIndex: 0,
    });
  });

  it('returns second set when first is complete', () => {
    const workout = makeWorkout([
      makeBlock([makeExercise('Bench Press', 3)]),
    ]);
    const currentLog = {
      exercises: {
        'Bench Press': [
          { completed: true },
          { completed: false },
          { completed: false },
        ],
      },
    };
    expect(findNextIncompleteSet(workout, currentLog)).toEqual({
      exerciseTitle: 'Bench Press',
      setIndex: 1,
    });
  });

  it('skips to next exercise when all sets of first exercise are complete', () => {
    const workout = makeWorkout([
      makeBlock([makeExercise('Bench Press', 2)]),
      makeBlock([makeExercise('Squat', 2)]),
    ]);
    const currentLog = {
      exercises: {
        'Bench Press': [{ completed: true }, { completed: true }],
        'Squat': [{ completed: false }, { completed: false }],
      },
    };
    expect(findNextIncompleteSet(workout, currentLog)).toEqual({
      exerciseTitle: 'Squat',
      setIndex: 0,
    });
  });

  it('returns null when all sets are complete', () => {
    const workout = makeWorkout([
      makeBlock([makeExercise('Bench Press', 2)]),
    ]);
    const currentLog = {
      exercises: {
        'Bench Press': [{ completed: true }, { completed: true }],
      },
    };
    expect(findNextIncompleteSet(workout, currentLog)).toBeNull();
  });

  it('returns null when workout is null', () => {
    expect(findNextIncompleteSet(null, { exercises: {} })).toBeNull();
  });

  it('returns null when currentLog is null', () => {
    const workout = makeWorkout([
      makeBlock([makeExercise('Bench Press', 2)]),
    ]);
    expect(findNextIncompleteSet(workout, null)).toBeNull();
  });

  it('handles exercises with no logged sets (skips them)', () => {
    const workout = makeWorkout([
      makeBlock([makeExercise('Bench Press', 2)]),
      makeBlock([makeExercise('Squat', 2)]),
    ]);
    const currentLog = {
      exercises: {
        // No entry for Bench Press — skipped
        'Squat': [{ completed: false }, { completed: false }],
      },
    };
    expect(findNextIncompleteSet(workout, currentLog)).toEqual({
      exerciseTitle: 'Squat',
      setIndex: 0,
    });
  });

  it('respects block/exercise order (first block first, then second)', () => {
    const workout = makeWorkout([
      makeBlock([makeExercise('Overhead Press', 3)]),
      makeBlock([makeExercise('Deadlift', 3)]),
    ]);
    const currentLog = {
      exercises: {
        'Overhead Press': [
          { completed: true },
          { completed: false },
          { completed: false },
        ],
        'Deadlift': [
          { completed: false },
          { completed: false },
          { completed: false },
        ],
      },
    };
    expect(findNextIncompleteSet(workout, currentLog)).toEqual({
      exerciseTitle: 'Overhead Press',
      setIndex: 1,
    });
  });

  it('works with superset blocks (multiple exercises in same block)', () => {
    const workout = makeWorkout([
      makeBlock([
        makeExercise('Curl', 2),
        makeExercise('Tricep Extension', 2),
      ]),
    ]);
    const currentLog = {
      exercises: {
        'Curl': [{ completed: true }, { completed: true }],
        'Tricep Extension': [{ completed: false }, { completed: false }],
      },
    };
    expect(findNextIncompleteSet(workout, currentLog)).toEqual({
      exerciseTitle: 'Tricep Extension',
      setIndex: 0,
    });
  });
});
