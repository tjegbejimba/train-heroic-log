import { parseLogKey } from '../constants';

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
