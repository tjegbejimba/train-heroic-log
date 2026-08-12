/**
 * Workout summary and PR detection — pure functions, no React dependencies.
 */

/**
 * Build summary stats for a completed workout log.
 * @param {Object} log - { exercises, startedAt?, completedAt? }
 * @returns {{ totalCompleted, totalSets, durationMin, volumeByUnit }} | null
 */
export function buildSummary(log) {
  if (!log) return null;

  const allSetsFlat = Object.values(log.exercises || {}).flat();
  const doneSets = allSetsFlat.filter((s) => s.completed);

  let durationMin = null;
  if (log.startedAt && log.completedAt) {
    const ms = new Date(log.completedAt) - new Date(log.startedAt);
    if (ms > 0) durationMin = Math.round(ms / 60000);
  }

  const volumeByUnit = {};
  doneSets.forEach((s) => {
    if (s.actualReps && s.actualWeight) {
      const unit = s.unit || 'lb';
      volumeByUnit[unit] = (volumeByUnit[unit] || 0) + (s.actualReps * s.actualWeight);
    }
  });

  return {
    totalCompleted: doneSets.length,
    totalSets: allSetsFlat.length,
    durationMin,
    volumeByUnit,
  };
}

/**
 * Classify a value against the best value previously recorded for the same
 * thing (an exercise+reps combo, a session's top weight, etc.).
 *
 * A first-ever recording has nothing to beat — it is a **baseline**, not an
 * earned personal record. Only a value that genuinely beats an established
 * prior best is a **PR**. Matching or falling short of the prior best is
 * neither (returns null) and does not update the reference going forward.
 *
 * @param {number|null|undefined} previousBest - the best value on record before this one, or
 *   undefined/null when nothing has ever been recorded for this thing.
 * @param {number} value - the value being classified.
 * @returns {'baseline'|'pr'|null}
 */
export function classifyAgainstBest(previousBest, value) {
  if (previousBest === undefined || previousBest === null) return 'baseline';
  return value > previousBest ? 'pr' : null;
}

/**
 * Given a chronologically-ordered list of items, tag each with a `kind` of
 * 'baseline' (first-ever value), 'pr' (beats the running best so far), or
 * null (ties or falls short) — using classifyAgainstBest against a running
 * reference that only advances on a baseline or PR.
 * @param {Array} items - chronologically ordered items
 * @param {(item: any) => number} getValue - extracts the comparable numeric value from an item
 * @returns {Array} items with an added `kind` field
 */
export function markRunningRecords(items, getValue) {
  let runningBest = null;
  return items.map((item) => {
    const value = getValue(item);
    const kind = classifyAgainstBest(runningBest, value);
    if (kind) runningBest = value;
    return { ...item, kind };
  });
}

/**
 * Detect records by comparing current log against all previous logs: for
 * each completed set, classify it as a 'baseline' (no prior log ever had
 * this exercise+reps combo) or a genuine 'pr' (beats the best previous
 * weight for the same exercise+reps). Ties/regressions are omitted.
 * @param {Object} log - current workout log
 * @param {Array} allLogs - all historical logs (with date, exercises fields)
 * @param {string} today - YYYY-MM-DD date string to exclude same-day logs
 * @returns {Array<{exTitle, reps, weight, unit, kind: 'baseline'|'pr'}>}
 */
export function findRecords(log, allLogs, today) {
  if (!log || !log.exercises) return [];

  // Build previous best: { exerciseTitle: { reps: maxWeight } }
  const prevBest = {};
  if (Array.isArray(allLogs)) {
    allLogs.forEach((prevLog) => {
      if (!prevLog?.date || !prevLog.exercises || prevLog.date >= today) return;
      Object.entries(prevLog.exercises).forEach(([exTitle, sets]) => {
        sets.forEach((s) => {
          if (!s.completed || s.actualReps === '' || s.actualWeight === '') return;
          if (!prevBest[exTitle]) prevBest[exTitle] = {};
          const w = parseFloat(s.actualWeight);
          if (!isNaN(w) && classifyAgainstBest(prevBest[exTitle][s.actualReps], w)) {
            prevBest[exTitle][s.actualReps] = w;
          }
        });
      });
    });
  }

  // Check current sets against previous bests
  const records = [];
  const seen = new Set();
  Object.entries(log.exercises).forEach(([exTitle, sets]) => {
    sets.forEach((s) => {
      if (!s.completed || s.actualReps === '' || s.actualWeight === '') return;
      const w = parseFloat(s.actualWeight);
      if (isNaN(w)) return;
      const best = prevBest[exTitle]?.[s.actualReps];
      const kind = classifyAgainstBest(best, w);
      const key = `${exTitle}:${s.actualReps}:${s.actualWeight}`;
      if (kind && !seen.has(key)) {
        seen.add(key);
        records.push({ exTitle, reps: s.actualReps, weight: w, unit: s.unit || 'lb', kind });
      }
    });
  });

  return records;
}
