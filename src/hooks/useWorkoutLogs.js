import { useState, useMemo } from 'react';
import { LS_WORKOUT_LOGS } from '../constants';
import { readLS, writeLS } from '../storage/index';

/**
 * Hook for managing completed/in-progress workout logs
 * LogKey format: "YYYY-MM-DD::WorkoutTitle"
 * @returns {{ logs: Object, saveLog: Function, getLog: Function, completedDates: Set, allLogs: Array }}
 */
export function useWorkoutLogs() {
  const [logs, setLogs] = useState(() => {
    return readLS(LS_WORKOUT_LOGS, {});
  });

  function saveLogs(logsMap) {
    writeLS(LS_WORKOUT_LOGS, logsMap);
    setLogs(logsMap);
  }

  function saveLog(logKey, logData) {
    const updated = { ...logs };
    updated[logKey] = logData;
    saveLogs(updated);
  }

  function getLog(logKey) {
    return logs[logKey] || null;
  }

  function deleteLog(logKey) {
    const updated = { ...logs };
    delete updated[logKey];
    saveLogs(updated);
  }

  // Compute completed dates
  const completedDates = useMemo(() => {
    const dates = new Set();
    Object.keys(logs).forEach((logKey) => {
      const date = logKey.split('::')[0];
      const log = logs[logKey];
      if (log && log.completedAt) {
        dates.add(date);
      }
    });
    return dates;
  }, [logs]);

  // All logs as array sorted by date desc
  const allLogs = useMemo(() => {
    return Object.entries(logs)
      .map(([key, log]) => ({
        key,
        ...log,
      }))
      .sort((a, b) => {
        const dateA = a.key.split('::')[0];
        const dateB = b.key.split('::')[0];
        return dateB.localeCompare(dateA);
      });
  }, [logs]);

  return { logs, saveLog, getLog, deleteLog, completedDates, allLogs };
}
