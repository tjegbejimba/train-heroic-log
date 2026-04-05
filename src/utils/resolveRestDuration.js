/**
 * Resolve the rest duration for an exercise.
 * @param {object} exercise - The exercise object (may have restDuration)
 * @param {boolean} isSuperset - Whether the exercise is in a superset block
 * @param {number} globalDefault - The global rest duration from settings
 * @returns {number|null} - Seconds to rest, or null for no timer
 */
export function resolveRestDuration(exercise, isSuperset, globalDefault) {
  if (exercise.restDuration != null && exercise.restDuration > 0) {
    return exercise.restDuration;
  }
  if (!isSuperset) {
    return globalDefault;
  }
  return null;
}
