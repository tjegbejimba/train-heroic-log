/**
 * Core orchestration primitives.
 *
 * An "operation" is a factory that returns (snapshot) => changeset.
 * A "changeset" is a plain object with optional entity keys whose values
 * are the complete new state for that entity.  Keys absent from the
 * changeset are left untouched.
 *
 * Error convention: return { error: 'message' } to signal a business-
 * rule failure.  compose() short-circuits on the first error.
 *
 * @module operations/core
 */

/**
 * @typedef {Object} DataSnapshot
 * @property {Object<string, Object>} templates  - id → template
 * @property {Object<string, Object>} workouts   - name → workout
 * @property {Object<string, string>} schedule   - YYYY-MM-DD → workoutTitle
 * @property {Object<string, Object>} logs       - logKey → log
 */

/**
 * @typedef {Object} Changeset
 * Partial map of entity keys to their full replacement values.
 * Only keys present are written; missing keys are untouched.
 * If `error` is present the changeset is treated as a failure.
 *
 * @property {Object} [templates]
 * @property {Object} [workouts]
 * @property {Object} [schedule]
 * @property {Object} [logs]
 * @property {string} [error]
 */

/**
 * @typedef {Object} DispatchResult
 * @property {boolean} ok
 * @property {string}  [error]    - present when ok=false
 * @property {Changeset} [changes] - present when ok=true
 */

/** Entity keys the system manages. Extend this array to add new entities. */
export const ENTITY_KEYS = ['templates', 'workouts', 'schedule', 'logs'];

/**
 * Compose multiple operations into a single operation.
 *
 * Each operation in the chain receives the *cumulative* state — i.e. the
 * original snapshot overlaid with all preceding changesets.  This means
 * later operations "see" earlier ones' writes.
 *
 * Short-circuits on the first operation that returns `{ error }`.
 *
 * @param  {...function(DataSnapshot): Changeset} ops
 * @returns {function(DataSnapshot): Changeset}
 *
 * @example
 *   const deleteAndClean = compose(
 *     removeTemplate(id),
 *     removeFromSchedule(name),
 *     removeOrphanWorkout(name),
 *   );
 *   const changeset = deleteAndClean(snapshot);
 */
export function compose(...ops) {
  return (snapshot) => {
    let state = snapshot;
    const merged = {};

    for (const op of ops) {
      const result = op(state);
      if (result.error) return result;

      for (const key of ENTITY_KEYS) {
        if (result[key] !== undefined) {
          merged[key] = result[key];
          state = { ...state, [key]: result[key] };
        }
      }
    }

    return merged;
  };
}

/**
 * Apply a changeset to a set of writer functions.
 *
 * Writers are keyed by entity name and called with the full replacement
 * value.  Only keys present in the changeset trigger a write.
 *
 * @param {Changeset} changeset
 * @param {Object<string, function>} writers - e.g. { templates: saveTemplates }
 * @returns {DispatchResult}
 */
export function applyChangeset(changeset, writers) {
  if (changeset.error) {
    return { ok: false, error: changeset.error };
  }

  for (const key of ENTITY_KEYS) {
    if (changeset[key] !== undefined && writers[key]) {
      writers[key](changeset[key]);
    }
  }

  return { ok: true, changes: changeset };
}
