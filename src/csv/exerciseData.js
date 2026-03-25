/**
 * Parse ExerciseData strings like "6, 6, 6 rep x 40, 40, 40 pound" into Set arrays
 * @param {string} raw - Raw ExerciseData string from CSV
 * @returns {Array} Array of {reps, weight, unit, rawReps, rawWeight}
 */
export function parseExerciseData(raw) {
  if (!raw || typeof raw !== 'string') return [];

  const s = raw.trim().toLowerCase();
  if (s.length === 0) return [];

  // Split on " x " separator between reps and weight
  const xMatch = s.match(/ x /i);
  let repsPart = s;
  let weightPart = '';

  if (xMatch) {
    const xIndex = xMatch.index;
    repsPart = s.slice(0, xIndex).trim();
    weightPart = s.slice(xIndex + 3).trim();
  }

  // Detect reps-side unit (normally "rep", but can be "time", "yard", "second", "pound")
  const repsSideUnit = detectUnit(repsPart);

  // --- Parse reps ---
  const repsClean = repsPart.replace(/\s*(reps?|repetitions?|times?|yards?|seconds?|pounds?|lbs?|max\s*reps?)\s*$/i, '').trim();
  const repTokens = repsClean
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  if (repTokens.length === 0) return [];

  const repsArr = repTokens.map((t) => {
    if (t === 'amrap' || t === 'max' || t === 'max reps') return null;
    const n = parseTime(t);
    return isNaN(n) ? null : n;
  });

  // If all rep tokens resolved to null and none were AMRAP keywords, nothing useful
  const hasAmrap = repTokens.some((t) => t === 'amrap' || t === 'max' || t === 'max reps');
  if (repsArr.every((r) => r === null) && !hasAmrap) return [];

  // --- Parse weight ---
  let weightsArr = [];
  let unit = 'lb'; // default

  if (!weightPart || weightPart === '') {
    weightsArr = repsArr.map(() => null);
    unit = 'bw';
  } else {
    const bwPhrases = ['bodyweight', 'body weight', 'bw'];
    if (bwPhrases.some((p) => weightPart.includes(p))) {
      weightsArr = repsArr.map(() => null);
      unit = 'bw';
    } else {
      // Detect weight-side unit
      unit = detectWeightUnit(weightPart);

      // "rep" on weight side with no numbers means bodyweight
      if (unit === 'rep') {
        const weightClean = weightPart.replace(/\s*(reps?)\s*/gi, '').trim();
        const weightTokens = weightClean.split(',').map((t) => t.trim()).filter(Boolean);
        const nums = weightTokens.map((t) => parseFloat(t)).filter((n) => !isNaN(n));

        if (nums.length === 0) {
          // "rep x rep" — pure bodyweight
          weightsArr = repsArr.map(() => null);
          unit = 'bw';
        } else if (repsArr.every((r) => r === 0) && nums.some((n) => n > 0)) {
          // "0, 0, 0 rep x 20, 15, 17 rep" — actual reps on weight side, bodyweight exercise
          return nums.map((reps, i) => ({
            reps,
            weight: null,
            unit: 'bw',
            rawReps: String(reps),
            rawWeight: 'bw',
          }));
        } else {
          // "10, 10, 10 rep x 10, 10, 10 rep" — mirrored reps, bodyweight
          weightsArr = repsArr.map(() => null);
          unit = 'bw';
        }
      } else {
        const unitPattern = /\s*(pounds?|lbs?|kg|kilograms?|%|percent|yards?|yd|meters?|rpe|inches?|in|feet|foot|ft|seconds?|sec|times?)\s*/gi;
        const weightClean = weightPart.replace(unitPattern, '').trim();
        const weightTokens = weightClean
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);

        weightsArr = weightTokens.map((t) => {
          const n = parseTime(t);
          return isNaN(n) ? null : n;
        });
      }
    }
  }

  // Handle reversed columns: weight unit on reps side (e.g., "135 pound x 40 time")
  if (repsSideUnit === 'lb' || repsSideUnit === 'kg') {
    const weightSideUnit = detectWeightUnit(weightPart);
    if (weightSideUnit === 'time' || weightSideUnit === 'sec' || weightSideUnit === 'rep') {
      // Swap: reps side has the weight, weight side has the reps/time
      return weightsArr.map((reps, i) => ({
        reps,
        weight: repsArr[i] ?? null,
        unit: repsSideUnit,
        rawReps: String(reps ?? ''),
        rawWeight: String(repsArr[i] ?? 'bw'),
      }));
    }
  }

  // Broadcast last weight if fewer tokens than reps
  const lastWeight = weightsArr[weightsArr.length - 1] ?? null;
  while (weightsArr.length < repsArr.length) {
    weightsArr.push(lastWeight);
  }

  // Zip into Set[]
  return repsArr.map((reps, i) => ({
    reps,
    weight: weightsArr[i] ?? null,
    unit,
    rawReps: repTokens[i] || '',
    rawWeight: String(weightsArr[i] ?? 'bw'),
  }));
}

/**
 * Detect the unit from a reps-side string
 */
function detectUnit(str) {
  if (/\bpounds?\b|\blbs?\b/.test(str)) return 'lb';
  if (/\bkg\b|\bkilograms?\b/.test(str)) return 'kg';
  if (/\byards?\b|\byd\b/.test(str)) return 'yd';
  if (/\bseconds?\b|\bsec\b/.test(str)) return 'sec';
  if (/\btimes?\b/.test(str)) return 'time';
  if (/\breps?\b/.test(str)) return 'rep';
  return 'rep';
}

/**
 * Detect the unit from a weight-side string
 */
function detectWeightUnit(str) {
  if (/\bkg\b|\bkilograms?\b/.test(str)) return 'kg';
  if (/%/.test(str) || /\bpercent\b/.test(str)) return '%';
  if (/\byards?\b|\byd\b/.test(str)) return 'yd';
  if (/\bmeters?\b/.test(str)) return 'm';
  if (/\brpe\b/.test(str)) return 'RPE';
  if (/\binches?\b|\binch\b/.test(str)) return 'in';
  if (/\bfeet\b|\bfoot\b|\bft\b/.test(str)) return 'ft';
  if (/\bseconds?\b|\bsec\b/.test(str)) return 'sec';
  if (/\btimes?\b/.test(str)) return 'time';
  if (/\breps?\b/.test(str)) return 'rep';
  if (/\bpounds?\b|\blbs?\b/.test(str)) return 'lb';
  return 'lb'; // default
}

/**
 * Parse a time-like string (HH:MM:SS or HH:MM) into total seconds, or a plain number
 */
function parseTime(str) {
  const trimmed = str.trim();
  // Match HH:MM:SS or MM:SS or HH:MM
  const timeMatch = trimmed.match(/^(\d+):(\d+)(?::(\d+))?$/);
  if (timeMatch) {
    const parts = [timeMatch[1], timeMatch[2], timeMatch[3]].filter(Boolean).map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  return parseFloat(trimmed);
}

const UNIT_LABELS = {
  lb: 'lb', kg: 'kg', '%': '%', yd: 'yd', m: 'm', bw: 'BW',
  RPE: 'RPE', in: 'in', ft: 'ft', sec: 'sec', time: 'sec',
};

/**
 * Format a Set for display.
 * When count > 1, shows grouped format: "3 × 8 @ 135 lb"
 * When count = 1, shows single format: "8 × 135 lb"
 * @param {Object} set - {reps, weight, unit, ...}
 * @param {number} count - number of identical sets (default 1)
 * @returns {string}
 */
export function formatSet(set, count = 1) {
  if (!set) return '';

  const repsStr = set.reps === null ? 'AMRAP' : `${set.reps}`;
  const unitLabel = UNIT_LABELS[set.unit] || set.unit;
  const isBodyweight = set.weight === null || set.unit === 'bw';

  if (count > 1) {
    if (isBodyweight) return `${count} × ${repsStr}`;
    return `${count} × ${repsStr} @ ${set.weight} ${unitLabel}`;
  }

  const weightStr = isBodyweight ? 'BW' : `${set.weight} ${unitLabel}`;
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
      last.set.unit === set.unit
    ) {
      last.count++;
    } else {
      groups.push({ set, count: 1 });
    }
  }
  return groups;
}
