import { parseLogKey } from '../constants';
import { shouldStartRestTimer } from '../utils/shouldStartRestTimer';
import { resolveRestDuration } from '../utils/resolveRestDuration';
import { resolveManualTimerDuration } from '../utils/resolveManualTimerDuration';

/**
 * Session logging module — owns the deterministic parts of starting and
 * recovering an active Workout Session. These functions are pure so the
 * Session state machine can be exercised without rendering the view.
 *
 * Domain vocabulary (see CLAUDE.md):
 *  - Session/Log: a completed or in-progress instance of a Workout on a date.
 *  - Set: one prescribed round of an Exercise (target reps + weight + unit).
 *  - Part (`block` in code): a section of a Workout holding one or more Exercises.
 */

// Active Sessions older than this many days are treated as stale and discarded.
export const SESSION_MAX_AGE_DAYS = 7;

/**
 * Named Session intentions. Editing interactions describe *what* changed as one
 * of these intentions and hand it to {@link applySessionIntent}, which returns a
 * new Session Log. Views never mutate persisted note state directly.
 */
export const SESSION_INTENT = {
  SET_EXERCISE_NOTE: 'session/set-exercise-note',
  SET_WORKOUT_NOTE: 'session/set-workout-note',
};

/**
 * Intention: set the Session note scoped to a single Exercise. This is distinct
 * from the Exercise's form notes (`exercise.notes`) and its workout-specific
 * notes (`exercise.workoutNotes`), which live on the Workout definition, not the
 * Session Log.
 */
export function setExerciseNoteIntent(exerciseTitle, note) {
  return { type: SESSION_INTENT.SET_EXERCISE_NOTE, exerciseTitle, note };
}

/** Intention: set the overall Session Workout note on the current Session. */
export function setWorkoutNoteIntent(note) {
  return { type: SESSION_INTENT.SET_WORKOUT_NOTE, note };
}

/**
 * Apply a Session intention to a Session Log, returning a new Log. Pure and
 * immutable: the input Log is never mutated, so recovered/persisted state stays
 * intact. Unknown intentions and null Logs are returned unchanged.
 */
export function applySessionIntent(log, intent) {
  if (!log || !intent) return log;

  switch (intent.type) {
    case SESSION_INTENT.SET_EXERCISE_NOTE: {
      if (!intent.exerciseTitle) return log;
      return {
        ...log,
        exerciseNotes: {
          ...(log.exerciseNotes || {}),
          [intent.exerciseTitle]: intent.note,
        },
      };
    }
    case SESSION_INTENT.SET_WORKOUT_NOTE:
      return { ...log, workoutNote: intent.note };
    default:
      return log;
  }
}

/**
 * Build the prescribed Set targets map for a Workout: exerciseTitle -> Set[].
 * Each entry mirrors the prescribed reps/weight/unit and starts uncompleted.
 */
export function buildSessionExercises(workout) {
  const exercises = {};
  if (!workout || !Array.isArray(workout.blocks)) return exercises;

  for (const block of workout.blocks) {
    if (!block || !Array.isArray(block.exercises)) continue;
    for (const exercise of block.exercises) {
      const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
      exercises[exercise.title] = sets.map((set, setIdx) => ({
        setIndex: setIdx,
        targetReps: set.reps,
        targetWeight: set.weight,
        unit: set.unit || exercise.unit || 'lb',
        actualReps: '',
        actualWeight: '',
        completed: false,
      }));
    }
  }

  return exercises;
}

/**
 * Build the initial Session Log for a freshly started Workout: correct identity
 * (logKey/workoutTitle/date), an open completion state, the original start time,
 * and every prescribed Set initialized with its target reps, weight, and unit.
 */
export function buildInitialSessionLog({ logKey, workout, startedAt }) {
  const { date, workoutTitle } = parseLogKey(logKey);
  return {
    logKey,
    workoutTitle,
    date,
    completedAt: null,
    startedAt: startedAt || new Date().toISOString(),
    exercises: buildSessionExercises(workout),
    exerciseNotes: {},
    workoutNote: '',
  };
}

/**
 * Whether a Log already holds athlete-entered performance (a completed Set or a
 * non-empty actual reps/weight). Used to avoid re-initializing prescribed
 * targets over recovered crash data.
 */
export function hasLoggedData(log) {
  if (!log || !log.exercises || typeof log.exercises !== 'object') return false;
  return Object.values(log.exercises).some(
    (sets) =>
      Array.isArray(sets) &&
      sets.some(
        (s) =>
          s.completed ||
          (s.actualReps !== undefined && s.actualReps !== '') ||
          (s.actualWeight !== undefined && s.actualWeight !== '')
      )
  );
}

/**
 * A Workout is valid (resumable) when it has at least one Part containing at
 * least one Exercise.
 */
export function isValidWorkout(workout) {
  return !!(
    workout &&
    Array.isArray(workout.blocks) &&
    workout.blocks.length > 0 &&
    workout.blocks.some((b) => b && Array.isArray(b.exercises) && b.exercises.length > 0)
  );
}

/**
 * Decide whether a persisted active Session should be resumed or silently
 * discarded. Discards stale (> maxAgeDays), unparseable, already-completed, and
 * invalid-Workout Sessions without prompting the athlete.
 *
 * @returns {{ action: 'resume'|'discard', reason?: string, workoutTitle?: string, date?: string }}
 */
export function evaluateSessionRecovery({
  session,
  workout,
  existingLog,
  now = Date.now(),
  maxAgeDays = SESSION_MAX_AGE_DAYS,
}) {
  if (!session || !session.logKey) {
    return { action: 'discard', reason: 'no-session' };
  }

  let date;
  let workoutTitle;
  try {
    ({ date, workoutTitle } = parseLogKey(session.logKey));
  } catch {
    return { action: 'discard', reason: 'unparseable' };
  }

  const sessionDate = new Date(`${date}T00:00:00`);
  const diffDays = (now - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
  if (Number.isNaN(diffDays) || diffDays > maxAgeDays) {
    return { action: 'discard', reason: 'stale' };
  }

  if (existingLog && existingLog.completedAt) {
    return { action: 'discard', reason: 'completed' };
  }

  if (!isValidWorkout(workout)) {
    return { action: 'discard', reason: 'invalid-workout' };
  }

  return { action: 'resume', workoutTitle, date };
}

// ─── Target-edit mode ───────────────────────────────────

// Editable target fields on a prescribed Set. Editing is limited to the
// prescription (reps/weight); the Exercise identity and unit stay fixed.
const EDITABLE_TARGET_FIELDS = new Set(['reps', 'weight']);

// Reference-free copy so a pending draft shares no nested Parts/Exercises/Sets
// with the source Workout — pending edits stay Session state until confirmed.
function cloneBlocks(blocks) {
  if (typeof structuredClone === 'function') return structuredClone(blocks);
  return JSON.parse(JSON.stringify(blocks));
}

/**
 * Open a target-edit draft for a Workout. Returns a deep clone of the Workout's
 * Parts so edits accumulate in Session state without mutating the persisted
 * Workout. Returns null for an invalid Workout, so no edit mode opens.
 */
export function beginTargetEdit(workout) {
  if (!isValidWorkout(workout)) return null;
  return cloneBlocks(workout.blocks);
}

// Locate the Set array for a draft coordinate, or null when out of range.
function draftSets(draft, blockIndex, exerciseIndex) {
  const exercise = draft?.[blockIndex]?.exercises?.[exerciseIndex];
  return Array.isArray(exercise?.sets) ? exercise.sets : null;
}

// A valid, in-range Set position: a non-negative integer within the array.
function isSetPosition(setIndex, sets) {
  return Number.isInteger(setIndex) && setIndex >= 0 && setIndex < sets.length;
}

/**
 * Edit a prescribed target (reps or weight) on a draft Set, returning a new
 * draft. Non-editable fields and out-of-range coordinates are ignored (the
 * input draft is returned unchanged).
 */
export function editTargetSet(draft, { blockIndex, exerciseIndex, setIndex, field, value }) {
  if (!draft) return draft;
  if (!EDITABLE_TARGET_FIELDS.has(field)) return draft;
  const sets = draftSets(draft, blockIndex, exerciseIndex);
  if (!sets || !isSetPosition(setIndex, sets)) return draft;

  const next = cloneBlocks(draft);
  next[blockIndex].exercises[exerciseIndex].sets[setIndex][field] = value;
  return next;
}

/**
 * Append a Set to a draft Exercise, copying the last prescribed Set's targets.
 * Out-of-range coordinates return the input draft unchanged.
 */
export function addTargetSet(draft, { blockIndex, exerciseIndex }) {
  if (!draft) return draft;
  const sets = draftSets(draft, blockIndex, exerciseIndex);
  if (!sets) return draft;

  const next = cloneBlocks(draft);
  const nextSets = next[blockIndex].exercises[exerciseIndex].sets;
  const base = nextSets[nextSets.length - 1] || { reps: null, weight: null, unit: 'lb' };
  nextSets.push({ ...base });
  return next;
}

/**
 * Remove a Set from a draft Exercise, returning a new draft. Refuses to remove
 * an Exercise's final Set (returns the input draft unchanged), so every
 * Exercise always keeps at least one prescribed Set.
 */
export function removeTargetSet(draft, { blockIndex, exerciseIndex, setIndex }) {
  if (!draft) return draft;
  const sets = draftSets(draft, blockIndex, exerciseIndex);
  if (!sets || !isSetPosition(setIndex, sets)) return draft;
  if (sets.length <= 1) return draft;

  const next = cloneBlocks(draft);
  next[blockIndex].exercises[exerciseIndex].sets.splice(setIndex, 1);
  return next;
}

/**
 * Confirm a target-edit draft. Returns a Training Plan lifecycle change
 * (`syncBlocks`) that, applied via the lifecycle authority (`applyTemplateChange`),
 * updates the matching Workout and Template. Returns null when there is no
 * draft to confirm.
 */
export function confirmTargetEdit(draft, workoutTitle) {
  if (!draft) return null;
  return { type: 'syncBlocks', workoutTitle, blocks: draft };
}

/**
 * Discard a target-edit draft. Produces no lifecycle change, so neither the
 * Workout nor the Template is touched.
 */
export function discardTargetEdit() {
  return null;
}

// ─── Set performance, next-Set, and rest decisions ─────────

/**
 * Record athlete performance for one prescribed Set, returning a new Session
 * Log. Pure and immutable: the input Log and every sibling Set are shared by
 * reference, so sequential edits chain from the latest Log without a stale
 * snapshot overwriting an earlier one. Unknown Exercises and out-of-range Set
 * positions return the input Log unchanged.
 */
export function logSet(log, { exerciseTitle, setIndex, setData }) {
  if (!log || !log.exercises) return log;
  const sets = log.exercises[exerciseTitle];
  if (!Array.isArray(sets) || setIndex < 0 || setIndex >= sets.length) return log;

  return {
    ...log,
    exercises: {
      ...log.exercises,
      [exerciseTitle]: [
        ...sets.slice(0, setIndex),
        setData,
        ...sets.slice(setIndex + 1),
      ],
    },
  };
}

/**
 * Locate an Exercise within a Workout by title, along with the superset context
 * a rest decision needs: whether its Part is a superset and whether the movement
 * is the last of its superset round. Returns null when the Exercise is absent.
 *
 * @returns {{ exercise: object, isSuperset: boolean, isLastInSuperset: boolean }|null}
 */
export function findExerciseByTitle(workout, exerciseTitle) {
  if (!workout || !Array.isArray(workout.blocks)) return null;
  for (const block of workout.blocks) {
    if (!block || !Array.isArray(block.exercises)) continue;
    const idx = block.exercises.findIndex((ex) => ex.title === exerciseTitle);
    if (idx !== -1) {
      return {
        exercise: block.exercises[idx],
        isSuperset: block.exercises.length > 1,
        isLastInSuperset: idx === block.exercises.length - 1,
      };
    }
  }
  return null;
}

/**
 * Identify the next incomplete Set in performance order. Solo Parts are scanned
 * Set-by-Set; superset Parts are interleaved round-by-round so the athlete
 * cycles through every movement before advancing. Returns null when the Session
 * is fully logged.
 *
 * @returns {{ exerciseTitle: string, setIndex: number }|null}
 */
export function findNextSet(workout, log) {
  if (!workout?.blocks || !log?.exercises) return null;

  for (const block of workout.blocks) {
    if (!block || !Array.isArray(block.exercises)) continue;

    if (block.exercises.length > 1) {
      const maxSets = Math.max(
        0,
        ...block.exercises.map((exercise) => log.exercises[exercise.title]?.length ?? 0)
      );
      for (let setIdx = 0; setIdx < maxSets; setIdx++) {
        for (const exercise of block.exercises) {
          const loggedSet = log.exercises[exercise.title]?.[setIdx];
          if (loggedSet && !loggedSet.completed) {
            return { exerciseTitle: exercise.title, setIndex: setIdx };
          }
        }
      }
      continue;
    }

    for (const exercise of block.exercises) {
      const loggedSets = log.exercises[exercise.title];
      if (!loggedSets) continue;
      const setIndex = loggedSets.findIndex((set) => !set.completed);
      if (setIndex !== -1) return { exerciseTitle: exercise.title, setIndex };
    }
  }

  return null;
}

/**
 * Decide whether a rest timer should start when a Set's completion changes, and
 * for how long. Owns the whole rest-eligibility policy so the view never decides
 * it: re-fire prevention (a Set only fires once), the superset rule (rest fires
 * only after the final movement of a round), and duration precedence
 * (Exercise override, else global default).
 *
 * `firedSets` is a mutable Set of already-fired Set keys, shared with the view so
 * unchecking then re-checking a Set does not restart rest.
 *
 * @returns {{ shouldStart: boolean, duration: number|null }}
 */
export function evaluateRest({
  workout,
  exerciseTitle,
  setIndex,
  wasCompleted,
  isNowCompleted,
  firedSets,
  globalDefault,
}) {
  if (!shouldStartRestTimer(exerciseTitle, setIndex, wasCompleted, isNowCompleted, firedSets)) {
    return { shouldStart: false, duration: null };
  }

  const context = findExerciseByTitle(workout, exerciseTitle);
  const exercise = context?.exercise || {};
  const isSuperset = context?.isSuperset || false;
  const isLastInSuperset = context ? context.isLastInSuperset : true;

  const duration = resolveRestDuration(exercise, isSuperset, globalDefault, isLastInSuperset);
  if (duration == null) {
    return { shouldStart: false, duration: null };
  }
  return { shouldStart: true, duration };
}

/**
 * Resolve the duration for the manual rest button. Ignores superset status —
 * the manual timer always honours the current Exercise's override, falling back
 * to the global default.
 */
export function resolveManualRest(exercise, globalDefault) {
  return resolveManualTimerDuration(exercise, globalDefault);
}
