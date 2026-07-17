import { describe, it, expect } from 'vitest';
import {
  SESSION_MAX_AGE_DAYS,
  buildSessionExercises,
  buildInitialSessionLog,
  hasLoggedData,
  isValidWorkout,
  evaluateSessionRecovery,
} from './session.js';

const workout = {
  blocks: [
    {
      exercises: [
        {
          title: 'Back Squat',
          unit: 'lb',
          sets: [
            { reps: 5, weight: 135 },
            { reps: 5, weight: 155 },
          ],
        },
      ],
    },
    {
      exercises: [
        {
          title: 'Pull-Up',
          sets: [{ reps: 8, weight: 'BW', unit: 'reps' }],
        },
        {
          title: 'Dip',
          sets: [{ reps: 10, weight: 0 }],
        },
      ],
    },
  ],
};

describe('buildSessionExercises', () => {
  it('creates one prescribed-target entry per set with reps, weight, and unit', () => {
    const exercises = buildSessionExercises(workout);

    expect(Object.keys(exercises)).toEqual(['Back Squat', 'Pull-Up', 'Dip']);
    expect(exercises['Back Squat']).toEqual([
      { setIndex: 0, targetReps: 5, targetWeight: 135, unit: 'lb', actualReps: '', actualWeight: '', completed: false },
      { setIndex: 1, targetReps: 5, targetWeight: 155, unit: 'lb', actualReps: '', actualWeight: '', completed: false },
    ]);
  });

  it('prefers the set unit, then the exercise unit, then defaults to lb', () => {
    const exercises = buildSessionExercises(workout);
    expect(exercises['Pull-Up'][0].unit).toBe('reps'); // set-level unit wins
    expect(exercises['Dip'][0].unit).toBe('lb'); // no unit anywhere -> default
  });

  it('returns an empty object for a workout with no blocks', () => {
    expect(buildSessionExercises(undefined)).toEqual({});
    expect(buildSessionExercises({})).toEqual({});
  });
});

describe('buildInitialSessionLog', () => {
  it('creates Session state with the correct identity and prescribed Set targets', () => {
    const startedAt = '2026-07-17T10:00:00.000Z';
    const log = buildInitialSessionLog({
      logKey: '2026-07-17::Upper A',
      workout,
      startedAt,
    });

    expect(log.logKey).toBe('2026-07-17::Upper A');
    expect(log.workoutTitle).toBe('Upper A');
    expect(log.date).toBe('2026-07-17');
    expect(log.completedAt).toBeNull();
    expect(log.startedAt).toBe(startedAt);
    expect(log.exerciseNotes).toEqual({});
    expect(log.workoutNote).toBe('');
    expect(log.exercises['Back Squat']).toHaveLength(2);
    expect(log.exercises['Back Squat'][0].targetWeight).toBe(135);
  });

  it('defaults startedAt to now when not provided', () => {
    const before = Date.now();
    const log = buildInitialSessionLog({ logKey: '2026-07-17::Upper A', workout });
    const after = Date.now();
    const ts = new Date(log.startedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('preserves workout titles that contain the :: separator', () => {
    const log = buildInitialSessionLog({ logKey: '2026-07-17::Leg::Day', workout });
    expect(log.workoutTitle).toBe('Leg::Day');
  });
});

describe('hasLoggedData', () => {
  it('is false for a freshly initialized log', () => {
    const log = buildInitialSessionLog({ logKey: '2026-07-17::Upper A', workout });
    expect(hasLoggedData(log)).toBe(false);
  });

  it('is true when any set is completed', () => {
    const log = buildInitialSessionLog({ logKey: '2026-07-17::Upper A', workout });
    log.exercises['Back Squat'][0].completed = true;
    expect(hasLoggedData(log)).toBe(true);
  });

  it('is true when actual reps or weight has been entered', () => {
    const log = buildInitialSessionLog({ logKey: '2026-07-17::Upper A', workout });
    log.exercises['Back Squat'][0].actualReps = 5;
    expect(hasLoggedData(log)).toBe(true);

    const log2 = buildInitialSessionLog({ logKey: '2026-07-17::Upper A', workout });
    log2.exercises['Back Squat'][0].actualWeight = 135;
    expect(hasLoggedData(log2)).toBe(true);
  });

  it('is false for null / malformed logs', () => {
    expect(hasLoggedData(null)).toBe(false);
    expect(hasLoggedData({})).toBe(false);
    expect(hasLoggedData({ exercises: null })).toBe(false);
  });
});

describe('isValidWorkout', () => {
  it('accepts a workout with at least one block that has exercises', () => {
    expect(isValidWorkout(workout)).toBe(true);
  });

  it('rejects missing / empty / exercise-less workouts', () => {
    expect(isValidWorkout(undefined)).toBe(false);
    expect(isValidWorkout({ blocks: [] })).toBe(false);
    expect(isValidWorkout({ blocks: [{ exercises: [] }] })).toBe(false);
    expect(isValidWorkout({ blocks: 'nope' })).toBe(false);
  });
});

describe('evaluateSessionRecovery', () => {
  const now = new Date('2026-07-17T12:00:00.000Z').getTime();

  it('resumes a valid unfinished Session', () => {
    const result = evaluateSessionRecovery({
      session: { logKey: '2026-07-17::Upper A', startedAt: '2026-07-17T10:00:00.000Z' },
      workout,
      existingLog: { completedAt: null, exercises: {} },
      now,
    });
    expect(result.action).toBe('resume');
    expect(result.workoutTitle).toBe('Upper A');
  });

  it('discards a Session older than the max age without prompting', () => {
    const result = evaluateSessionRecovery({
      session: { logKey: '2026-07-01::Upper A' },
      workout,
      existingLog: null,
      now,
    });
    expect(result.action).toBe('discard');
    expect(result.reason).toBe('stale');
  });

  it('keeps a Session that is exactly at the age boundary', () => {
    const boundaryDate = '2026-07-10';
    // Evaluate exactly 7 days (to the millisecond) after local midnight of the
    // Session date, so diffDays === 7 and the Session is not yet stale.
    const boundaryNow = new Date(`${boundaryDate}T00:00:00`).getTime() + 7 * 24 * 60 * 60 * 1000;
    const result = evaluateSessionRecovery({
      session: { logKey: `${boundaryDate}::Upper A` },
      workout,
      existingLog: null,
      now: boundaryNow,
    });
    expect(result.action).toBe('resume');
  });

  it('discards once past the age boundary by any amount', () => {
    const boundaryDate = '2026-07-10';
    const justPast = new Date(`${boundaryDate}T00:00:00`).getTime() + 7 * 24 * 60 * 60 * 1000 + 1;
    const result = evaluateSessionRecovery({
      session: { logKey: `${boundaryDate}::Upper A` },
      workout,
      existingLog: null,
      now: justPast,
    });
    expect(result.action).toBe('discard');
    expect(result.reason).toBe('stale');
  });

  it('discards a Session whose Log is already completed', () => {
    const result = evaluateSessionRecovery({
      session: { logKey: '2026-07-17::Upper A' },
      workout,
      existingLog: { completedAt: '2026-07-17T11:00:00.000Z' },
      now,
    });
    expect(result.action).toBe('discard');
    expect(result.reason).toBe('completed');
  });

  it('discards a Session whose Workout is missing or malformed', () => {
    const result = evaluateSessionRecovery({
      session: { logKey: '2026-07-17::Deleted' },
      workout: undefined,
      existingLog: null,
      now,
    });
    expect(result.action).toBe('discard');
    expect(result.reason).toBe('invalid-workout');
  });

  it('discards a Session with an unparseable / non-string logKey', () => {
    const result = evaluateSessionRecovery({
      session: { logKey: 12345 },
      workout,
      existingLog: null,
      now,
    });
    expect(result.action).toBe('discard');
  });

  it('discards when there is no session', () => {
    expect(evaluateSessionRecovery({ session: null, workout, existingLog: null, now }).action).toBe('discard');
  });

  it('discards a Session with a garbage date component', () => {
    const result = evaluateSessionRecovery({
      session: { logKey: 'not-a-date::Upper A' },
      workout,
      existingLog: null,
      now,
    });
    expect(result.action).toBe('discard');
    expect(result.reason).toBe('stale');
  });

  it('exposes the default max age constant', () => {
    expect(SESSION_MAX_AGE_DAYS).toBe(7);
  });
});
