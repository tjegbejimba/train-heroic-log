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
 * Detect personal records by comparing current log against all previous logs.
 * A PR is when a completed set's weight exceeds the best previous weight for the same exercise+reps.
 * @param {Object} log - current workout log
 * @param {Array} allLogs - all historical logs (with date, exercises fields)
 * @param {string} today - YYYY-MM-DD date string to exclude same-day logs
 * @returns {Array<{exTitle, reps, weight, unit}>}
 */
export function findPRs(log, allLogs, today) {
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
          if (!isNaN(w) && (prevBest[exTitle][s.actualReps] === undefined || w > prevBest[exTitle][s.actualReps])) {
            prevBest[exTitle][s.actualReps] = w;
          }
        });
      });
    });
  }

  // Check current sets against previous bests
  const prs = [];
  const seen = new Set();
  Object.entries(log.exercises).forEach(([exTitle, sets]) => {
    sets.forEach((s) => {
      if (!s.completed || s.actualReps === '' || s.actualWeight === '') return;
      const w = parseFloat(s.actualWeight);
      if (isNaN(w)) return;
      const best = prevBest[exTitle]?.[s.actualReps];
      const key = `${exTitle}:${s.actualReps}:${s.actualWeight}`;
      if ((best === undefined || w > best) && !seen.has(key)) {
        seen.add(key);
        prs.push({ exTitle, reps: s.actualReps, weight: w, unit: s.unit || 'lb' });
      }
    });
  });

  return prs;
}
