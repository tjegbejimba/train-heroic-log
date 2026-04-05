/**
 * Resolve the rest timer duration for the manual timer button.
 * Uses the exercise's restDuration override if set, otherwise falls back to globalDefault.
 * Unlike resolveRestDuration, this ignores superset status — manual timer always uses
 * the exercise override or global default.
 */
export function resolveManualTimerDuration(exercise, globalDefault) {
  if (exercise && exercise.restDuration != null && exercise.restDuration > 0) {
    return exercise.restDuration;
  }
  return globalDefault;
}
