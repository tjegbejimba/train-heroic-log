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

  // --- Parse reps ---
  // Strip trailing "rep", "reps", "repetition(s)"
  const repsClean = repsPart.replace(/\s*(reps?|repetitions?)\s*$/i, '').trim();
  const repTokens = repsClean
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  if (repTokens.length === 0) return [];

  const repsArr = repTokens.map((t) => {
    if (t === 'amrap' || t === 'max' || t === 'max reps') return null;
    const n = parseFloat(t);
    return isNaN(n) ? null : n;
  });

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
      // Detect unit
      if (/\bkg\b|kilogram/.test(weightPart)) unit = 'kg';
      else if (/%/.test(weightPart)) unit = '%';
      else unit = 'lb'; // default

      const weightClean = weightPart
        .replace(/\s*(pounds?|lbs?|kg|kilograms?|%)\s*/gi, '')
        .trim();
      const weightTokens = weightClean
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      weightsArr = weightTokens.map((t) => {
        const n = parseFloat(t);
        return isNaN(n) ? null : n;
      });
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
 * Format a Set for display
 * @param {Object} set - {reps, weight, unit, ...}
 * @returns {string} e.g. "6 reps x 40 lb" or "5 reps x BW"
 */
export function formatSet(set) {
  if (!set) return '';

  const repsStr = set.reps === null ? 'AMRAP' : `${set.reps}`;
  const weightStr = set.weight === null
    ? set.unit === 'bw' ? 'BW' : 'BW'
    : `${set.weight}${set.unit}`;

  return `${repsStr} × ${weightStr}`;
}
