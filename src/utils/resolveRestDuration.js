/**
 * Resolve the rest duration for an exercise.
 *
 * Rest fires after every set of a solo exercise. In a superset, only the LAST
 * movement of the round rests — completing an earlier movement flows straight
 * into the next exercise with no timer.
 *
 * @param {object} exercise - The exercise object (may have restDuration)
 * @param {boolean} isSuperset - Whether the exercise is in a superset block
 * @param {number} globalDefault - The global rest duration from settings
 * @param {boolean} [isLastInSuperset=true] - Whether this movement is the last
 *   in its superset round (ignored for solo exercises). Defaults to true so a
 *   missing position is treated as the round boundary (rest fires).
 * @returns {number|null} - Seconds to rest, or null for no timer
 */
export function resolveRestDuration(exercise, isSuperset, globalDefault, isLastInSuperset = true) {
  // Mid-round in a superset: no rest, move straight to the next movement.
  if (isSuperset && !isLastInSuperset) {
    return null;
  }
  if (exercise.restDuration != null && exercise.restDuration > 0) {
    return exercise.restDuration;
  }
  return globalDefault;
}
