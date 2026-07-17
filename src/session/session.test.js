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
  completeSessionIntent,
  cancelSessionIntent,
  applySessionIntent,
  beginTargetEdit,
  editTargetSet,
  addTargetSet,
  removeTargetSet,
  confirmTargetEdit,
  discardTargetEdit,
  logSet,
  findExerciseByTitle,
  findNextSet,
  evaluateRest,
  resolveManualRest,
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
      expect(SESSION_INTENT.COMPLETE).toBeTruthy();
      expect(SESSION_INTENT.CANCEL).toBeTruthy();
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

describe('Session completion & cancellation intentions', () => {
  const baseLog = () => buildInitialSessionLog({ logKey: '2026-07-17::Upper A', workout });
  const FIXED_TS = '2026-07-17T18:30:00.000Z';

  describe('completeSessionIntent + applySessionIntent', () => {
    it('stamps exactly one completion timestamp', () => {
      const log = baseLog();
      const completed = applySessionIntent(log, completeSessionIntent({ completedAt: FIXED_TS }));
      expect(completed.completedAt).toBe(FIXED_TS);
      // The completed Log carries a single completedAt field, not an array/duplicate.
      const stamps = Object.keys(completed).filter((k) => k === 'completedAt');
      expect(stamps).toHaveLength(1);
    });

    it('generates a completion timestamp when none is supplied', () => {
      const log = baseLog();
      const completed = applySessionIntent(log, completeSessionIntent());
      expect(typeof completed.completedAt).toBe('string');
      expect(completed.completedAt.length).toBeGreaterThan(0);
    });

    it('incorporates a pending Workout note before deriving the final Log', () => {
      // The athlete typed a final note that was never folded into the Log yet.
      const log = baseLog();
      expect(log.workoutNote).toBe('');
      const completed = applySessionIntent(
        log,
        completeSessionIntent({ completedAt: FIXED_TS, workoutNote: 'great session' })
      );
      expect(completed.workoutNote).toBe('great session');
      expect(completed.completedAt).toBe(FIXED_TS);
    });

    it('does not mutate the original Log (immutable intention)', () => {
      const log = baseLog();
      const completed = applySessionIntent(
        log,
        completeSessionIntent({ completedAt: FIXED_TS, workoutNote: 'x' })
      );
      expect(log.completedAt).toBeNull();
      expect(log.workoutNote).toBe('');
      expect(completed).not.toBe(log);
    });

    it('preserves logged Sets and Exercise notes in the final Log', () => {
      let log = baseLog();
      log = applySessionIntent(log, setExerciseNoteIntent('Back Squat', 'RPE 9'));
      log = logSet(log, {
        exerciseTitle: 'Back Squat',
        setIndex: 0,
        setData: { setIndex: 0, targetReps: 5, actualReps: 5, actualWeight: 135, completed: true, unit: 'lb' },
      });
      const completed = applySessionIntent(log, completeSessionIntent({ completedAt: FIXED_TS }));
      expect(completed.exercises['Back Squat'][0].completed).toBe(true);
      expect(completed.exerciseNotes['Back Squat']).toBe('RPE 9');
    });

    it('races a pending Workout note with completion: note is neither lost nor duplicated', () => {
      // Simulate the race: the Log still holds a stale/empty note while the view
      // holds the athlete's latest keystrokes as a pending note. Completion must
      // fold the pending note in exactly once — not drop it, not concatenate it.
      const stale = applySessionIntent(baseLog(), setWorkoutNoteIntent('felt ok'));
      const pending = 'felt great, big PRs';
      const completed = applySessionIntent(
        stale,
        completeSessionIntent({ completedAt: FIXED_TS, workoutNote: pending })
      );
      // Not lost: the final pending value wins.
      expect(completed.workoutNote).toBe(pending);
      // Not duplicated: no concatenation of stale + pending.
      expect(completed.workoutNote).not.toContain('felt ok');
      // Idempotent re-derivation from the completed Log keeps a single note.
      const again = applySessionIntent(completed, setWorkoutNoteIntent(completed.workoutNote));
      expect(again.workoutNote).toBe(pending);
    });

    it('leaves the Log unchanged when the pending note matches the current note', () => {
      const log = applySessionIntent(baseLog(), setWorkoutNoteIntent('steady'));
      const completed = applySessionIntent(
        log,
        completeSessionIntent({ completedAt: FIXED_TS, workoutNote: 'steady' })
      );
      expect(completed.workoutNote).toBe('steady');
      expect(completed.completedAt).toBe(FIXED_TS);
    });
  });

  describe('cancelSessionIntent + applySessionIntent', () => {
    it('never stamps a completion timestamp', () => {
      const log = baseLog();
      const cancelled = applySessionIntent(log, cancelSessionIntent());
      expect(cancelled.completedAt).toBeNull();
    });

    it('preserves in-progress Sets and notes so saved progress is not lost', () => {
      let log = baseLog();
      log = applySessionIntent(log, setWorkoutNoteIntent('halfway'));
      log = logSet(log, {
        exerciseTitle: 'Back Squat',
        setIndex: 0,
        setData: { setIndex: 0, actualReps: 5, actualWeight: 135, completed: true, unit: 'lb' },
      });
      const cancelled = applySessionIntent(log, cancelSessionIntent());
      expect(cancelled.completedAt).toBeNull();
      expect(cancelled.workoutNote).toBe('halfway');
      expect(cancelled.exercises['Back Squat'][0].completed).toBe(true);
    });

    it('does not turn an open Session into completed History', () => {
      const cancelled = applySessionIntent(baseLog(), cancelSessionIntent());
      // A completed History entry requires a completedAt; cancellation must not add one.
      expect(cancelled.completedAt).toBeFalsy();
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

    it('ignores non-integer Set coordinates instead of throwing', () => {
      const draft = beginTargetEdit(targetWorkout());
      for (const setIndex of [undefined, null, NaN, 1.5, '0']) {
        expect(editTargetSet(draft, { blockIndex: 0, exerciseIndex: 0, setIndex, field: 'reps', value: 1 })).toBe(draft);
      }
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

    it('ignores non-integer Set coordinates instead of removing the first Set', () => {
      const draft = beginTargetEdit(targetWorkout());
      for (const setIndex of [undefined, null, NaN, 1.5, '0']) {
        const next = removeTargetSet(draft, { blockIndex: 0, exerciseIndex: 0, setIndex });
        expect(next).toBe(draft);
        expect(next[0].exercises[0].sets).toHaveLength(2);
      }
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

// ─── Set performance, next-Set, and rest decisions ─────────

// A Workout with one solo Part and one two-movement superset Part.
function restWorkout() {
  return {
    title: 'Upper A',
    blocks: [
      {
        exercises: [
          { title: 'Bench Press', unit: 'lb', restDuration: 120, sets: [{ reps: 5, weight: 135 }, { reps: 5, weight: 135 }] },
        ],
      },
      {
        exercises: [
          { title: 'Pull-Up', sets: [{ reps: 8, weight: 'BW', unit: 'reps' }] },
          { title: 'Dip', sets: [{ reps: 10, weight: 0 }] },
        ],
      },
    ],
  };
}

function restLog() {
  return buildInitialSessionLog({ logKey: '2026-07-04::Upper A', workout: restWorkout() });
}

describe('logSet', () => {
  it('replaces one Set immutably, persisting actual reps and weight', () => {
    const log = restLog();
    const next = logSet(log, {
      exerciseTitle: 'Bench Press',
      setIndex: 1,
      setData: { setIndex: 1, targetReps: 5, targetWeight: 135, unit: 'lb', actualReps: 6, actualWeight: 140, completed: true },
    });

    expect(next).not.toBe(log);
    expect(log.exercises['Bench Press'][1].completed).toBe(false); // input untouched
    expect(next.exercises['Bench Press'][1]).toMatchObject({ actualReps: 6, actualWeight: 140, completed: true });
    expect(next.exercises['Bench Press'][0]).toBe(log.exercises['Bench Press'][0]); // sibling Set shared
  });

  it('chains sequential edits without overwriting earlier ones', () => {
    const log = restLog();
    const afterFirst = logSet(log, {
      exerciseTitle: 'Bench Press',
      setIndex: 0,
      setData: { ...log.exercises['Bench Press'][0], actualReps: 5, completed: true },
    });
    const afterSecond = logSet(afterFirst, {
      exerciseTitle: 'Bench Press',
      setIndex: 1,
      setData: { ...afterFirst.exercises['Bench Press'][1], actualReps: 5, completed: true },
    });

    expect(afterSecond.exercises['Bench Press'][0].completed).toBe(true);
    expect(afterSecond.exercises['Bench Press'][1].completed).toBe(true);
  });

  it('appends a Set when setIndex equals the current length (post target-edit)', () => {
    const log = restLog();
    const beforeLen = log.exercises['Bench Press'].length;
    const appended = { setIndex: beforeLen, targetReps: 5, targetWeight: 135, unit: 'lb', actualReps: 5, actualWeight: 135, completed: true };
    const next = logSet(log, { exerciseTitle: 'Bench Press', setIndex: beforeLen, setData: appended });

    expect(next.exercises['Bench Press']).toHaveLength(beforeLen + 1);
    expect(next.exercises['Bench Press'][beforeLen]).toMatchObject({ completed: true, actualReps: 5 });
  });

  it('returns the input Log unchanged for an unknown Exercise or beyond-append Set', () => {
    const log = restLog();
    expect(logSet(log, { exerciseTitle: 'Nope', setIndex: 0, setData: {} })).toBe(log);
    expect(logSet(log, { exerciseTitle: 'Bench Press', setIndex: 9, setData: {} })).toBe(log);
    expect(logSet(log, { exerciseTitle: 'Bench Press', setIndex: -1, setData: {} })).toBe(log);
    expect(logSet(null, { exerciseTitle: 'Bench Press', setIndex: 0, setData: {} })).toBeNull();
  });
});

describe('findExerciseByTitle', () => {
  it('locates a solo Exercise with its superset context', () => {
    const found = findExerciseByTitle(restWorkout(), 'Bench Press');
    expect(found).toMatchObject({ isSuperset: false, isLastInSuperset: true });
    expect(found.exercise.title).toBe('Bench Press');
  });

  it('flags a non-final superset movement as not last in its round', () => {
    const found = findExerciseByTitle(restWorkout(), 'Pull-Up');
    expect(found).toMatchObject({ isSuperset: true, isLastInSuperset: false });
  });

  it('flags the final superset movement as last in its round', () => {
    const found = findExerciseByTitle(restWorkout(), 'Dip');
    expect(found).toMatchObject({ isSuperset: true, isLastInSuperset: true });
  });

  it('returns null when the Exercise is absent', () => {
    expect(findExerciseByTitle(restWorkout(), 'Nope')).toBeNull();
  });
});

describe('findNextSet', () => {
  it('finds the first incomplete Set in Workout order', () => {
    const log = restLog();
    expect(findNextSet(restWorkout(), log)).toEqual({ exerciseTitle: 'Bench Press', setIndex: 0 });
  });

  it('interleaves superset movements round-by-round', () => {
    const workout = restWorkout();
    let log = restLog();
    // Complete both Bench Press Sets so the next incomplete lands in the superset.
    log = logSet(log, { exerciseTitle: 'Bench Press', setIndex: 0, setData: { ...log.exercises['Bench Press'][0], completed: true } });
    log = logSet(log, { exerciseTitle: 'Bench Press', setIndex: 1, setData: { ...log.exercises['Bench Press'][1], completed: true } });
    // Now complete the first superset movement's only Set.
    log = logSet(log, { exerciseTitle: 'Pull-Up', setIndex: 0, setData: { ...log.exercises['Pull-Up'][0], completed: true } });

    expect(findNextSet(workout, log)).toEqual({ exerciseTitle: 'Dip', setIndex: 0 });
  });

  it('returns null once every Set is complete', () => {
    const workout = restWorkout();
    let log = restLog();
    for (const title of ['Bench Press', 'Pull-Up', 'Dip']) {
      log.exercises[title].forEach((s) => { s.completed = true; });
    }
    expect(findNextSet(workout, log)).toBeNull();
  });

  it('advances within an Exercise before moving on', () => {
    const workout = restWorkout();
    const log = restLog();
    log.exercises['Bench Press'][0].completed = true;
    expect(findNextSet(workout, log)).toEqual({ exerciseTitle: 'Bench Press', setIndex: 1 });
  });

  it('skips Exercises with no logged Sets', () => {
    const workout = restWorkout();
    const log = restLog();
    delete log.exercises['Bench Press'];
    expect(findNextSet(workout, log)).toEqual({ exerciseTitle: 'Pull-Up', setIndex: 0 });
  });

  it('returns null when the Workout is missing', () => {
    expect(findNextSet(null, restLog())).toBeNull();
  });

  it('returns null when the Log is missing', () => {
    expect(findNextSet(restWorkout(), null)).toBeNull();
  });
});

describe('evaluateRest', () => {
  it('starts rest once for a completed solo Set, using the Exercise override', () => {
    const firedSets = new Set();
    const decision = evaluateRest({
      workout: restWorkout(),
      exerciseTitle: 'Bench Press',
      setIndex: 0,
      wasCompleted: false,
      isNowCompleted: true,
      firedSets,
      globalDefault: 90,
    });
    expect(decision).toEqual({ shouldStart: true, duration: 120 });
  });

  it('does not re-fire when the same Set toggles completed again', () => {
    const firedSets = new Set();
    const args = {
      workout: restWorkout(),
      exerciseTitle: 'Bench Press',
      setIndex: 0,
      wasCompleted: false,
      isNowCompleted: true,
      firedSets,
      globalDefault: 90,
    };
    expect(evaluateRest(args).shouldStart).toBe(true);
    expect(evaluateRest(args).shouldStart).toBe(false);
  });

  it('does not start rest when a Set becomes incomplete', () => {
    const decision = evaluateRest({
      workout: restWorkout(),
      exerciseTitle: 'Bench Press',
      setIndex: 0,
      wasCompleted: true,
      isNowCompleted: false,
      firedSets: new Set(),
      globalDefault: 90,
    });
    expect(decision.shouldStart).toBe(false);
  });

  it('skips rest mid-superset but rests after the final movement', () => {
    const midRound = evaluateRest({
      workout: restWorkout(),
      exerciseTitle: 'Pull-Up',
      setIndex: 0,
      wasCompleted: false,
      isNowCompleted: true,
      firedSets: new Set(),
      globalDefault: 90,
    });
    expect(midRound).toEqual({ shouldStart: false, duration: null });

    const roundEnd = evaluateRest({
      workout: restWorkout(),
      exerciseTitle: 'Dip',
      setIndex: 0,
      wasCompleted: false,
      isNowCompleted: true,
      firedSets: new Set(),
      globalDefault: 90,
    });
    expect(roundEnd).toEqual({ shouldStart: true, duration: 90 });
  });
});

describe('resolveManualRest', () => {
  it('prefers the current Exercise override over the global default', () => {
    expect(resolveManualRest({ restDuration: 150 }, 90)).toBe(150);
  });

  it('falls back to the global default without an Exercise or override', () => {
    expect(resolveManualRest(null, 90)).toBe(90);
    expect(resolveManualRest({}, 90)).toBe(90);
    expect(resolveManualRest({ restDuration: 0 }, 90)).toBe(90);
  });
});
