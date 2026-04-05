/**
 * Set display formatting utilities.
 * Extracted from csv/exerciseData.js — these are view utilities, not parsing.
 */

import { UNIT_LABELS } from './unitLabels';

/** Convert total seconds to "MM:SS" string */
export function secondsToMmss(secs) {
  const n = Math.max(0, Math.round(Number(secs)));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Parse "MM:SS" (or plain seconds integer) to total seconds, or null if unparseable */
export function mmssToSeconds(str) {
  if (str === '' || str == null) return null;
  const parts = String(str).split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
  }
  const n = parseInt(str, 10);
  return isNaN(n) ? null : n;
}

/**
 * Format a Set for display.
 * When count > 1, shows grouped format: "3 × 8 @ 135 lb"
 * When count = 1, shows single format: "8 × 135 lb"
 * Time units (sec/time) display as MM:SS instead of raw seconds.
 */
export function formatSet(set, count = 1) {
  if (!set) return '';

  const isTimeWeight = set.unit === 'sec' || set.unit === 'time';
  const isTimeReps = set.repsUnit === 'sec' || set.repsUnit === 'time';

  let repsStr;
  if (set.reps === null) {
    repsStr = 'AMRAP';
  } else if (isTimeReps) {
    repsStr = secondsToMmss(set.reps);
  } else {
    const repsUnitLabel = set.repsUnit && set.repsUnit !== 'reps' ? ` ${UNIT_LABELS[set.repsUnit] || set.repsUnit}` : '';
    repsStr = `${set.reps}${repsUnitLabel}`;
  }

  const unitLabel = UNIT_LABELS[set.unit] || set.unit;
  const noWeight = set.unit === 'reps';
  const isBodyweight = set.weight === null || set.unit === 'bw';

  if (count > 1) {
    if (noWeight || isBodyweight) return `${count} × ${repsStr}`;
    const wStr = isTimeWeight ? secondsToMmss(set.weight) : `${set.weight} ${unitLabel}`;
    return `${count} × ${repsStr} @ ${wStr}`;
  }

  if (noWeight) return repsStr;
  let weightStr;
  if (isBodyweight) {
    weightStr = 'BW';
  } else if (isTimeWeight) {
    weightStr = secondsToMmss(set.weight);
  } else {
    weightStr = `${set.weight} ${unitLabel}`;
  }
  return `${repsStr} × ${weightStr}`;
}

/**
 * Group consecutive identical sets together.
 * @param {Array} sets
 * @returns {Array<{set, count}>}
 */
export function groupSets(sets) {
  if (!sets || sets.length === 0) return [];
  const groups = [];
  for (const set of sets) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.set.reps === set.reps &&
      last.set.weight === set.weight &&
      last.set.unit === set.unit &&
      last.set.repsUnit === set.repsUnit
    ) {
      last.count++;
    } else {
      groups.push({ set, count: 1 });
    }
  }
  return groups;
}
