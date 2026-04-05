import { parseLogKey } from '../constants';
import { secondsToMmss } from './formatters';
import { getUnitLabel } from './setMeta';

/**
 * Find the most recent logged sets for an exercise before a given date.
 * Call once per exercise (not per set) and memoize in the parent.
 *
 * @param {Object} allLogs - Map of logKey → log objects
 * @param {string} workoutTitle
 * @param {string} exerciseTitle
 * @param {Object} [options]
 * @param {string} [options.before] - ISO date string, defaults to today
 * @returns {Array|null} Array of logged set objects, or null
 */
export function findPreviousSets(allLogs, workoutTitle, exerciseTitle, options = {}) {
  if (!allLogs || !workoutTitle || !exerciseTitle) return null;

  const before = options.before || new Date().toISOString().slice(0, 10);
  let bestLog = null;

  for (const log of Object.values(allLogs)) {
    if (!log?.date || !log?.exercises) continue;
    if (log.date >= before) continue;

    const logKey = log.key || log.logKey;
    if (!logKey) continue;

    const parsed = parseLogKey(logKey);
    if (parsed.workoutTitle !== workoutTitle) continue;
    if (!log.exercises[exerciseTitle]) continue;

    if (!bestLog || log.date > bestLog.date) {
      bestLog = log;
    }
  }

  return bestLog?.exercises[exerciseTitle] || null;
}

/**
 * Format a previous set into a display hint string.
 *
 * @param {Object|null} prevSet - { actualReps, actualWeight, unit }
 * @param {Object} meta - from getSetMeta(): { isBodyweight, isTimeReps }
 * @returns {string|null}
 */
export function formatLastHint(prevSet, meta) {
  if (!prevSet) return null;

  const { actualReps, actualWeight, unit } = prevSet;
  const { isBodyweight, isTimeReps } = meta;

  if (actualReps === '' && actualWeight === '') return null;

  if (actualReps !== '' && actualWeight !== '' && !isBodyweight) {
    const isTimeW = unit === 'sec' || unit === 'time';
    const wDisplay = isTimeW
      ? secondsToMmss(Number(actualWeight))
      : `${actualWeight} ${getUnitLabel(unit)}`;
    return `Last: ${actualReps} × ${wDisplay}`.trim();
  }

  if (actualReps !== '' && isBodyweight) {
    return isTimeReps
      ? `Last: ${secondsToMmss(Number(actualReps))}`
      : `Last: ${actualReps} reps`;
  }

  return null;
}
