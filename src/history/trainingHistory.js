/**
 * Training history — everything TrainLog reports about completed Sessions.
 *
 * Build once from the Logs (`th_logs` map, or the `allLogs` array whose items
 * carry `key`), then query. Only completed Logs are Training history. Sessions
 * are ordered by date, then completion time, and each is classified against
 * the Sessions before it, so a PR is an event that never un-happens.
 */
import { parseLogKey } from '../constants.js';

const VOLUME_UNITS = new Set(['lb', 'kg']);

function toNumber(value) {
  if (value === '' || value == null) return NaN;
  return Number(value);
}

function completedLoad(set) {
  if (!set?.completed) return null;
  const reps = toNumber(set.actualReps);
  const weight = toNumber(set.actualWeight);
  if (!Number.isInteger(reps) || reps <= 0 || !(weight > 0)) return null;
  return { reps, weight, unit: set.unit || 'lb' };
}

function setVolume(set) {
  const load = completedLoad(set);
  if (!load || !VOLUME_UNITS.has(load.unit)) return null;
  return { unit: load.unit, volume: load.reps * load.weight };
}

function normalizeLogs(logs) {
  const entries = Array.isArray(logs)
    ? logs.map((log) => [log?.key || log?.logKey, log])
    : Object.entries(logs || {});

  return entries
    .filter(([key, log]) => key && log?.completedAt)
    .map(([key, log]) => ({ key, date: parseLogKey(key).date || log.date, log }))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.log.completedAt).localeCompare(String(b.log.completedAt)));
}

// For one Session: the heaviest completed Set per Exercise + reps + unit.
function sessionTopSets(log) {
  const tops = new Map();
  for (const [exercise, sets] of Object.entries(log.exercises || {})) {
    (sets || []).forEach((set, setIndex) => {
      const load = completedLoad(set);
      if (!load) return;
      const id = `${exercise}\u0000${load.reps}\u0000${load.unit}`;
      const current = tops.get(id);
      if (!current || load.weight > current.weight) {
        tops.set(id, { exercise, setIndex, ...load });
      }
    });
  }
  return tops;
}

function classifySessions(sessions) {
  const bests = new Map();
  const recordsByKey = new Map();
  for (const { key, log } of sessions) {
    const records = [];
    for (const [id, top] of sessionTopSets(log)) {
      const previous = bests.get(id);
      if (previous === undefined) {
        records.push({ ...top, kind: 'baseline' });
      } else if (top.weight > previous) {
        records.push({ ...top, kind: 'pr' });
      }
    }
    for (const [id, top] of sessionTopSets(log)) {
      bests.set(id, Math.max(bests.get(id) ?? -Infinity, top.weight));
    }
    recordsByKey.set(key, records);
  }
  return recordsByKey;
}

function sessionVolume(log) {
  const volumeByUnit = {};
  for (const sets of Object.values(log.exercises || {})) {
    for (const set of sets || []) {
      const v = setVolume(set);
      if (v) volumeByUnit[v.unit] = (volumeByUnit[v.unit] || 0) + v.volume;
    }
  }
  return volumeByUnit;
}

const PRESET_DAYS = { '1W': 7, '4W': 28, '3M': 90 };

function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekStart(dateStr) {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return shiftDate(dateStr, day === 0 ? -6 : 1 - day);
}

function presetWindow(range, today) {
  const days = PRESET_DAYS[range];
  if (!days) return null;
  return { start: shiftDate(today, -days), end: today };
}

function durationMinutes(log) {
  if (!log.startedAt || !log.completedAt) return null;
  const ms = new Date(log.completedAt) - new Date(log.startedAt);
  return ms > 0 ? Math.round(ms / 60000) : null;
}

export function buildTrainingHistory(logs) {
  const sessions = normalizeLogs(logs);
  const byKey = new Map(sessions.map((s) => [s.key, s]));
  const recordsByKey = classifySessions(sessions);

  function sessionRecap(logKey) {
    const entry = byKey.get(logKey);
    if (!entry) return null;
    const { log } = entry;
    const allSets = Object.values(log.exercises || {}).flat();
    const records = recordsByKey.get(logKey) || [];
    return {
      totalCompleted: allSets.filter((s) => s?.completed).length,
      totalSets: allSets.length,
      durationMin: durationMinutes(log),
      volumeByUnit: sessionVolume(log),
      records,
      prs: records.filter((r) => r.kind === 'pr'),
      baselines: records.filter((r) => r.kind === 'baseline'),
    };
  }

  function rangeSummary(range = 'ALL', { today = new Date().toISOString().slice(0, 10) } = {}) {
    const window = presetWindow(range, today);
    const inRange = sessions.filter(
      ({ date }) => !window || (date >= window.start && date <= window.end)
    );

    const unitCounts = { lb: 0, kg: 0 };
    for (const { log } of inRange) {
      for (const sets of Object.values(log.exercises || {})) {
        for (const set of sets || []) {
          const unit = set?.unit || 'lb';
          if (set?.completed && VOLUME_UNITS.has(unit)) unitCounts[unit]++;
        }
      }
    }
    const unit = unitCounts.kg > unitCounts.lb ? 'kg' : 'lb';

    const weekVolume = {};
    const weekSessions = {};
    const exerciseVolume = {};
    let prCount = 0;
    for (const { key, date, log } of inRange) {
      const week = weekStart(date);
      weekSessions[week] = (weekSessions[week] || 0) + 1;
      for (const [exercise, sets] of Object.entries(log.exercises || {})) {
        for (const set of sets || []) {
          const v = setVolume(set);
          if (!v || v.unit !== unit) continue;
          weekVolume[week] = (weekVolume[week] || 0) + v.volume;
          exerciseVolume[exercise] = (exerciseVolume[exercise] || 0) + v.volume;
        }
      }
      prCount += (recordsByKey.get(key) || []).filter((r) => r.kind === 'pr').length;
    }

    const byWeek = (a, b) => a.weekStart.localeCompare(b.weekStart);
    return {
      dateRange: window,
      unit,
      volumeByWeek: Object.entries(weekVolume)
        .map(([ws, volume]) => ({ weekStart: ws, volume, unit }))
        .sort(byWeek),
      sessionsByWeek: Object.entries(weekSessions)
        .map(([ws, count]) => ({ weekStart: ws, count }))
        .sort(byWeek),
      prCount,
      volumeByExercise: Object.entries(exerciseVolume)
        .map(([exercise, volume]) => ({ exercise, volume, unit }))
        .sort((a, b) => b.volume - a.volume),
      workoutDates: new Set(inRange.map(({ date }) => date)),
    };
  }

  return { isEmpty: sessions.length === 0, sessionRecap, rangeSummary };
}
