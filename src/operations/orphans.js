/**
 * Orphan detection and cleanup — single source of truth for "is this
 * workout still referenced?" logic.
 *
 * Previously duplicated in 3 places in App.jsx with slight variations.
 *
 * @module operations/orphans
 */

/**
 * True when a workout title appears in at least one log key.
 *
 * @param {Object<string, Object>} logs
 * @param {string} workoutName
 * @returns {boolean}
 */
export function isReferencedByLog(logs, workoutName) {
  return Object.keys(logs).some((k) => k.endsWith(`::${workoutName}`));
}

/**
 * True when a workout title appears in at least one schedule entry.
 *
 * @param {Object<string, string>} schedule
 * @param {string} workoutName
 * @returns {boolean}
 */
export function isScheduled(schedule, workoutName) {
  return Object.values(schedule).includes(workoutName);
}

/**
 * Remove a workout from state if it is orphaned — i.e. not referenced
 * by any schedule entry or any log.
 *
 * @param {string} workoutName
 * @returns {function(import('./core').DataSnapshot): import('./core').Changeset}
 */
export function removeOrphanWorkout(workoutName) {
  return (state) => {
    if (!state.workouts[workoutName]) return {};
    if (isScheduled(state.schedule, workoutName)) return {};
    if (isReferencedByLog(state.logs, workoutName)) return {};

    const workouts = { ...state.workouts };
    delete workouts[workoutName];
    return { workouts };
  };
}
