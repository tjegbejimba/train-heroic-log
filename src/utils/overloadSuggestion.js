import { secondsToMmss } from './formatters';

const WEIGHT_INCREMENT = { lb: 5, kg: 2.5 };
const DEFAULT_INCREMENT = 5;

function isBodyweight(unit, repsUnit) {
  return (unit === 'bw' || unit === 'reps') && (!repsUnit || repsUnit === 'reps');
}

function isTimeBased(repsUnit) {
  return repsUnit === 'sec' || repsUnit === 'time';
}

/**
 * Compute a progressive overload suggestion.
 * @param {object|null} lastSet - { actualReps, actualWeight, unit }
 * @param {number|null} targetReps - prescribed target reps
 * @param {string} unit - weight unit ('lb','kg','bw','reps','sec','time', etc.)
 * @param {string} repsUnit - reps unit ('reps','sec','time','RPE','%')
 * @returns {{ reps: number, weight: number, unit: string, didProgress: boolean }|null}
 */
export function computeSuggestion(lastSet, targetReps, unit, repsUnit) {
  if (!lastSet) return null;

  const reps = Number(lastSet.actualReps);
  if (lastSet.actualReps === '' || lastSet.actualReps == null || isNaN(reps)) return null;

  const weight = Number(lastSet.actualWeight) || 0;

  // Time-based: +5 seconds (check before bodyweight since BW planks are time-based)
  if (isTimeBased(repsUnit)) {
    return { reps: reps + 5, weight: 0, unit, didProgress: true };
  }

  // Bodyweight: +1 rep
  if (isBodyweight(unit, repsUnit)) {
    return { reps: reps + 1, weight: 0, unit, didProgress: true };
  }

  // Weighted exercise
  const increment = WEIGHT_INCREMENT[unit] || DEFAULT_INCREMENT;
  const hitTarget = targetReps == null || reps >= targetReps;
  const suggestedReps = targetReps || reps;

  if (hitTarget) {
    return { reps: suggestedReps, weight: weight + increment, unit, didProgress: true };
  }
  return { reps: suggestedReps, weight, unit, didProgress: false };
}

/**
 * Format the compact overload hint string.
 * @param {object|null} lastSet - { actualReps, actualWeight }
 * @param {object|null} suggestion - from computeSuggestion
 * @param {string} unit - weight unit
 * @param {string} repsUnit - reps unit
 * @returns {string|null}
 */
export function formatOverloadHint(lastSet, suggestion, unit, repsUnit) {
  if (!lastSet) return null;

  const reps = Number(lastSet.actualReps);
  const weight = Number(lastSet.actualWeight) || 0;
  const bw = isBodyweight(unit, repsUnit);
  const time = isTimeBased(repsUnit);

  const lastPart = time
    ? secondsToMmss(reps)
    : bw
      ? `${reps} reps`
      : `${reps}×${weight}`;

  if (!suggestion) return lastPart;

  const suggPart = time
    ? secondsToMmss(suggestion.reps)
    : bw
      ? `${suggestion.reps} reps`
      : `${suggestion.reps}×${suggestion.weight}`;

  return `${lastPart} → ${suggPart}`;
}
