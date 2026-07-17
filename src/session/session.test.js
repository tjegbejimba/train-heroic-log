import { describe, it, expect } from 'vitest';
import {
  SESSION_MAX_AGE_DAYS,
  SESSION_INTENT,
  buildSessionExercises,
  buildInitialSessionLog,
  hasLoggedData,
  isValidWorkout,
  evaluateSessionRecovery,
  setExerciseNoteIntent,
  setWorkoutNoteIntent,
  applySessionIntent,
  beginTargetEdit,
  editTargetSet,
  addTargetSet,
  removeTargetSet,
  confirmTargetEdit,
  discardTargetEdit,
} from './session.js';
import { applyTemplateChange } from '../orchestrator.js';

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

describe('Session note intentions', () => {
  const baseLog = () => buildInitialSessionLog({ logKey: '2026-07-17::Upper A', workout });

  describe('setExerciseNoteIntent + applySessionIntent', () => {
    it('scopes an Exercise Session note to that Exercise only', () => {
      const log = baseLog();
      const next = applySessionIntent(log, setExerciseNoteIntent('Back Squat', 'RPE 8, felt strong'));

      expect(next.exerciseNotes['Back Squat']).toBe('RPE 8, felt strong');
      expect(next.exerciseNotes['Pull-Up']).toBeUndefined();
    });

    it('does not mutate the original Log (immutable intention)', () => {
      const log = baseLog();
      const next = applySessionIntent(log, setExerciseNoteIntent('Back Squat', 'hi'));

      expect(log.exerciseNotes['Back Squat']).toBeUndefined();
      expect(next).not.toBe(log);
      expect(next.exerciseNotes).not.toBe(log.exerciseNotes);
    });

    it('leaves prescribed Sets and the Session Workout note untouched', () => {
      const log = baseLog();
      log.workoutNote = 'overall note';
      const next = applySessionIntent(log, setExerciseNoteIntent('Back Squat', 'note'));

      expect(next.workoutNote).toBe('overall note');
      expect(next.exercises).toEqual(log.exercises);
    });

    it('updates an existing Exercise note without disturbing sibling notes', () => {
      const log = baseLog();
      const withTwo = applySessionIntent(
        applySessionIntent(log, setExerciseNoteIntent('Back Squat', 'first')),
        setExerciseNoteIntent('Pull-Up', 'second')
      );
      const updated = applySessionIntent(withTwo, setExerciseNoteIntent('Back Squat', 'edited'));

      expect(updated.exerciseNotes['Back Squat']).toBe('edited');
      expect(updated.exerciseNotes['Pull-Up']).toBe('second');
    });

    it('ignores an intention with no Exercise title', () => {
      const log = baseLog();
      const next = applySessionIntent(log, setExerciseNoteIntent('', 'orphan'));
      expect(next).toBe(log);
    });
  });

  describe('setWorkoutNoteIntent + applySessionIntent', () => {
    it('persists the Session Workout note on the current Session', () => {
      const log = baseLog();
      const next = applySessionIntent(log, setWorkoutNoteIntent('great pump'));
      expect(next.workoutNote).toBe('great pump');
    });

    it('does not mutate the original Log', () => {
      const log = baseLog();
      const next = applySessionIntent(log, setWorkoutNoteIntent('tired today'));
      expect(log.workoutNote).toBe('');
      expect(next).not.toBe(log);
    });

    it('leaves Exercise Session notes untouched', () => {
      const log = applySessionIntent(baseLog(), setExerciseNoteIntent('Back Squat', 'ex note'));
      const next = applySessionIntent(log, setWorkoutNoteIntent('session note'));
      expect(next.exerciseNotes['Back Squat']).toBe('ex note');
      expect(next.workoutNote).toBe('session note');
    });
  });

  describe('applySessionIntent guards', () => {
    it('exposes the Session intent type constants', () => {
      expect(SESSION_INTENT.SET_EXERCISE_NOTE).toBeTruthy();
      expect(SESSION_INTENT.SET_WORKOUT_NOTE).toBeTruthy();
    });

    it('returns the Log unchanged for a null log or unknown intent', () => {
      const log = baseLog();
      expect(applySessionIntent(null, setWorkoutNoteIntent('x'))).toBeNull();
      expect(applySessionIntent(log, null)).toBe(log);
      expect(applySessionIntent(log, { type: 'nope' })).toBe(log);
    });

    it('survives crash recovery: notes on a persisted Log round-trip through recovery', () => {
      // A persisted (crashed) Session Log carrying both note types.
      let recovered = buildInitialSessionLog({ logKey: '2026-07-17::Upper A', workout });
      recovered = applySessionIntent(recovered, setExerciseNoteIntent('Back Squat', 'elbow twinge'));
      recovered = applySessionIntent(recovered, setWorkoutNoteIntent('low energy'));

      // Simulate reload: JSON round-trip through localStorage.
      const reloaded = JSON.parse(JSON.stringify(recovered));

      const decision = evaluateSessionRecovery({
        session: { logKey: reloaded.logKey, startedAt: reloaded.startedAt },
        workout,
        existingLog: reloaded,
        now: new Date('2026-07-17T12:00:00.000Z').getTime(),
      });

      expect(decision.action).toBe('resume');
      expect(reloaded.exerciseNotes['Back Squat']).toBe('elbow twinge');
      expect(reloaded.workoutNote).toBe('low energy');
    });
  });
});

describe('target-edit mode', () => {
  // A Workout whose prescribed Set targets (reps/weight) the athlete may edit
  // mid-Session before confirming back to the Training Plan.
  const targetWorkout = () => ({
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
          { title: 'Pull-Up', sets: [{ reps: 8, weight: 'BW', unit: 'reps' }] },
          { title: 'Dip', sets: [{ reps: 10, weight: 0 }] },
        ],
      },
    ],
  });

  describe('beginTargetEdit', () => {
    it('opens a pending draft that deep-clones the Workout Parts and Sets', () => {
      const workout = targetWorkout();
      const draft = beginTargetEdit(workout);

      expect(draft).toEqual(workout.blocks);
      // Draft is a reference-free copy: mutating it never touches the Workout.
      draft[0].exercises[0].sets[0].reps = 999;
      expect(workout.blocks[0].exercises[0].sets[0].reps).toBe(5);
    });

    it('returns null for an invalid Workout so no edit mode opens', () => {
      expect(beginTargetEdit(null)).toBeNull();
      expect(beginTargetEdit({ blocks: [] })).toBeNull();
      expect(beginTargetEdit({ blocks: [{ exercises: [] }] })).toBeNull();
    });
  });

  describe('editTargetSet', () => {
    it('edits reps on a Set immutably, leaving the prior draft untouched', () => {
      const draft = beginTargetEdit(targetWorkout());
      const next = editTargetSet(draft, {
        blockIndex: 0,
        exerciseIndex: 0,
        setIndex: 1,
        field: 'reps',
        value: 3,
      });

      expect(next[0].exercises[0].sets[1].reps).toBe(3);
      expect(draft[0].exercises[0].sets[1].reps).toBe(5);
      expect(next).not.toBe(draft);
    });

    it('edits weight on a Set', () => {
      const draft = beginTargetEdit(targetWorkout());
      const next = editTargetSet(draft, {
        blockIndex: 0,
        exerciseIndex: 0,
        setIndex: 0,
        field: 'weight',
        value: 185,
      });
      expect(next[0].exercises[0].sets[0].weight).toBe(185);
    });

    it('ignores fields other than reps/weight and out-of-range coordinates', () => {
      const draft = beginTargetEdit(targetWorkout());
      expect(
        editTargetSet(draft, { blockIndex: 0, exerciseIndex: 0, setIndex: 0, field: 'title', value: 'x' })
      ).toBe(draft);
      expect(
        editTargetSet(draft, { blockIndex: 9, exerciseIndex: 0, setIndex: 0, field: 'reps', value: 1 })
      ).toBe(draft);
      expect(
        editTargetSet(draft, { blockIndex: 0, exerciseIndex: 0, setIndex: 9, field: 'reps', value: 1 })
      ).toBe(draft);
      expect(editTargetSet(null, { blockIndex: 0, exerciseIndex: 0, setIndex: 0, field: 'reps', value: 1 })).toBeNull();
    });
  });

  describe('addTargetSet', () => {
    it('appends a copy of the last prescribed Set immutably', () => {
      const draft = beginTargetEdit(targetWorkout());
      const next = addTargetSet(draft, { blockIndex: 0, exerciseIndex: 0 });

      expect(next[0].exercises[0].sets).toHaveLength(3);
      expect(next[0].exercises[0].sets[2]).toEqual({ reps: 5, weight: 155 });
      // Appended Set is a copy, not shared with the source Set.
      expect(next[0].exercises[0].sets[2]).not.toBe(next[0].exercises[0].sets[1]);
      expect(draft[0].exercises[0].sets).toHaveLength(2);
    });

    it('returns the draft unchanged for out-of-range coordinates', () => {
      const draft = beginTargetEdit(targetWorkout());
      expect(addTargetSet(draft, { blockIndex: 9, exerciseIndex: 0 })).toBe(draft);
      expect(addTargetSet(null, { blockIndex: 0, exerciseIndex: 0 })).toBeNull();
    });
  });

  describe('removeTargetSet', () => {
    it('removes the targeted Set immutably', () => {
      const draft = beginTargetEdit(targetWorkout());
      const next = removeTargetSet(draft, { blockIndex: 0, exerciseIndex: 0, setIndex: 0 });

      expect(next[0].exercises[0].sets).toHaveLength(1);
      expect(next[0].exercises[0].sets[0]).toEqual({ reps: 5, weight: 155 });
      expect(draft[0].exercises[0].sets).toHaveLength(2);
    });

    it("refuses to remove an Exercise's final Set", () => {
      const draft = beginTargetEdit(targetWorkout());
      // Pull-Up (block 1, exercise 0) has a single Set — removal must be a no-op.
      const next = removeTargetSet(draft, { blockIndex: 1, exerciseIndex: 0, setIndex: 0 });
      expect(next).toBe(draft);
      expect(next[1].exercises[0].sets).toHaveLength(1);
    });
  });

  describe('confirmTargetEdit', () => {
    it('routes edited targets through the Training Plan lifecycle authority to Workout and Template', () => {
      const draft = beginTargetEdit(targetWorkout());
      const edited = editTargetSet(draft, {
        blockIndex: 0,
        exerciseIndex: 0,
        setIndex: 0,
        field: 'reps',
        value: 3,
      });

      const change = confirmTargetEdit(edited, 'Upper A');
      expect(change).toEqual({ type: 'syncBlocks', workoutTitle: 'Upper A', blocks: edited });

      // Feed the change to the lifecycle authority and prove both sides update.
      const snapshot = {
        workouts: { 'Upper A': { title: 'Upper A', blocks: targetWorkout().blocks } },
        templates: { t1: { id: 't1', name: 'Upper A', blocks: targetWorkout().blocks } },
        schedule: {},
        logs: {},
      };
      const result = applyTemplateChange(snapshot, change);
      expect(result.workouts['Upper A'].blocks[0].exercises[0].sets[0].reps).toBe(3);
      expect(result.templates.t1.blocks[0].exercises[0].sets[0].reps).toBe(3);
    });

    it('returns null when there is no draft to confirm', () => {
      expect(confirmTargetEdit(null, 'Upper A')).toBeNull();
    });
  });

  describe('discardTargetEdit', () => {
    it('yields no change so neither Workout nor Template is touched', () => {
      const draft = beginTargetEdit(targetWorkout());
      editTargetSet(draft, { blockIndex: 0, exerciseIndex: 0, setIndex: 0, field: 'reps', value: 3 });

      // Discarding produces no lifecycle change...
      expect(discardTargetEdit()).toBeNull();

      // ...and the source Workout blocks remain exactly as prescribed.
      const workout = targetWorkout();
      expect(draft).toEqual(workout.blocks);
    });
  });
});
