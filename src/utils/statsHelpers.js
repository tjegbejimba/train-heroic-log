import { parseLogKey } from '../constants.js';

const VOLUME_UNITS = new Set(['lb', 'kg']);

function getISOWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

function setVolume(set, onlyUnit) {
  if (!set.completed) return 0;
  const reps = parseFloat(set.actualReps);
  const weight = parseFloat(set.actualWeight);
  const unit = set.unit || 'lb';
  if (!VOLUME_UNITS.has(unit) || isNaN(reps) || isNaN(weight) || reps <= 0 || weight <= 0) return 0;
  if (onlyUnit && unit !== onlyUnit) return 0;
  return reps * weight;
}

export function dominantUnit(logs, dateRange) {
  const filtered = filterLogsByRange(logs, dateRange);
  const counts = { lb: 0, kg: 0 };
  for (const log of Object.values(filtered)) {
    for (const sets of Object.values(log.exercises || {})) {
      for (const set of sets) {
        if (!set.completed) continue;
        const u = set.unit || 'lb';
        if (VOLUME_UNITS.has(u)) counts[u]++;
      }
    }
  }
  return counts.kg > counts.lb ? 'kg' : 'lb';
}

export function filterLogsByRange(logs, dateRange) {
  if (!dateRange) return { ...logs };
  const { start, end } = dateRange;
  const result = {};
  for (const [key, log] of Object.entries(logs)) {
    const { date } = parseLogKey(key);
    if (date >= start && date <= end) {
      result[key] = log;
    }
  }
  return result;
}

export function volumeByWeek(logs, dateRange, unit) {
  const filtered = filterLogsByRange(logs, dateRange);
  const resolvedUnit = unit || dominantUnit(logs, dateRange);
  const weekMap = {};

  for (const [, log] of Object.entries(filtered)) {
    const exercises = log.exercises || {};
    let logVolume = 0;
    for (const sets of Object.values(exercises)) {
      for (const set of sets) {
        logVolume += setVolume(set, resolvedUnit);
      }
    }
    if (logVolume === 0) continue;

    const { date } = parseLogKey(
      Object.keys(logs).find(k => logs[k] === log) || ''
    );
    const weekStart = getISOWeekStart(date || log.date);
    if (!weekMap[weekStart]) weekMap[weekStart] = 0;
    weekMap[weekStart] += logVolume;
  }

  return Object.entries(weekMap)
    .map(([weekStart, volume]) => ({ weekStart, volume, unit: resolvedUnit }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function sessionsByWeek(logs, dateRange) {
  const filtered = filterLogsByRange(logs, dateRange);
  const weekMap = {};

  for (const key of Object.keys(filtered)) {
    const { date } = parseLogKey(key);
    const weekStart = getISOWeekStart(date);
    weekMap[weekStart] = (weekMap[weekStart] || 0) + 1;
  }

  return Object.entries(weekMap)
    .map(([weekStart, count]) => ({ weekStart, count }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function prCountInRange(logs, dateRange, unit) {
  const resolvedUnit = unit || dominantUnit(logs, dateRange);

  // Sort all log keys chronologically
  const allKeys = Object.keys(logs).sort((a, b) => {
    const da = parseLogKey(a).date;
    const db = parseLogKey(b).date;
    return da.localeCompare(db);
  });

  const rangeFiltered = filterLogsByRange(logs, dateRange);
  const rangeKeys = new Set(Object.keys(rangeFiltered));

  // Walk chronologically, track bests, count PRs only for in-range logs
  const bests = {}; // bests[exercise][reps] = bestWeight
  let prCount = 0;

  for (const key of allKeys) {
    const log = logs[key];
    const inRange = rangeKeys.has(key);

    for (const [exName, sets] of Object.entries(log.exercises || {})) {
      for (const set of sets) {
        if (!set.completed) continue;
        const setUnit = set.unit || 'lb';
        if (setUnit !== resolvedUnit) continue;
        const w = parseFloat(set.actualWeight);
        const reps = parseInt(set.actualReps, 10);
        if (isNaN(w) || w <= 0 || isNaN(reps) || reps <= 0) continue;

        if (!bests[exName]) bests[exName] = {};
        const prev = bests[exName][reps];

        if (!prev || w > prev) {
          bests[exName][reps] = w;
          if (inRange) prCount++;
        }
      }
    }
  }

  return prCount;
}

function buildVolumeMap(logs, dateRange, onlyUnit) {
  const filtered = filterLogsByRange(logs, dateRange);
  const volMap = {};

  for (const log of Object.values(filtered)) {
    for (const [exName, sets] of Object.entries(log.exercises || {})) {
      for (const set of sets) {
        const v = setVolume(set, onlyUnit);
        if (v > 0) {
          volMap[exName] = (volMap[exName] || 0) + v;
        }
      }
    }
  }
  return volMap;
}

export function topExercisesByVolume(logs, dateRange, n = 3, unit) {
  const resolvedUnit = unit || dominantUnit(logs, dateRange);
  const volMap = buildVolumeMap(logs, dateRange, resolvedUnit);
  return Object.entries(volMap)
    .map(([exercise, volume]) => ({ exercise, volume, unit: resolvedUnit }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, n);
}

export function volumeByExercise(logs, dateRange, unit) {
  const resolvedUnit = unit || dominantUnit(logs, dateRange);
  const volMap = buildVolumeMap(logs, dateRange, resolvedUnit);
  return Object.entries(volMap)
    .map(([exercise, volume]) => ({ exercise, volume, unit: resolvedUnit }))
    .sort((a, b) => b.volume - a.volume);
}

export function workoutDates(logs, dateRange) {
  const filtered = filterLogsByRange(logs, dateRange);
  const dates = new Set();
  for (const key of Object.keys(filtered)) {
    dates.add(parseLogKey(key).date);
  }
  return dates;
}

export function dateRangeFromPreset(preset) {
  if (preset === 'ALL') return null;
  const now = new Date();
  const end = now.toISOString().slice(0, 10);

  const daysMap = { '1W': 7, '4W': 28, '3M': 90 };
  const days = daysMap[preset];
  if (!days) return null;

  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { start: start.toISOString().slice(0, 10), end };
}
