import { useMemo, useCallback } from 'react';
import { LS_WORKOUT_LOGS } from '../constants';
import { createEntityHook } from './createEntityHook';

const useLogsBase = createEntityHook(LS_WORKOUT_LOGS, {});

/**
 * Hook for managing completed/in-progress workout logs
 * LogKey format: "YYYY-MM-DD::WorkoutTitle"
 */
export function useWorkoutLogs() {
  const { data: logs, save: saveLogs } = useLogsBase();

  // Functional update to avoid stale closures in rapid-fire saves
  const saveLog = useCallback((logKey, logData) => {
    saveLogs((prev) => ({ ...prev, [logKey]: logData }));
  }, [saveLogs]);

  const getLog = useCallback((logKey) => logs[logKey] || null, [logs]);

  const deleteLog = useCallback((logKey) => {
    const updated = { ...logs };
    delete updated[logKey];
    saveLogs(updated);
  }, [logs, saveLogs]);

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

  const allLogs = useMemo(() => {
    return Object.entries(logs)
      .map(([key, log]) => ({ key, ...log }))
      .sort((a, b) => {
        const dateA = a.key.split('::')[0];
        const dateB = b.key.split('::')[0];
        return dateB.localeCompare(dateA);
      });
  }, [logs]);

  return { logs, saveLog, getLog, deleteLog, completedDates, allLogs };
}
