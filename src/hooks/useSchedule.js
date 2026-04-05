import { useCallback } from 'react';
import { LS_SCHEDULE } from '../constants';
import { createEntityHook } from './createEntityHook';

const useScheduleBase = createEntityHook(LS_SCHEDULE, {});

/**
 * Hook for managing workout schedule (date -> workoutTitle mapping)
 */
export function useSchedule() {
  const { data: schedule, save: saveSchedule } = useScheduleBase();

  const getWorkoutForDate = useCallback((date) => schedule[date] || null, [schedule]);

  const setWorkoutDate = useCallback((date, workoutTitle) => {
    const updated = { ...schedule };
    if (workoutTitle === null) {
      delete updated[date];
    } else {
      updated[date] = workoutTitle;
    }
    saveSchedule(updated);
  }, [schedule, saveSchedule]);

  return { schedule, saveSchedule, getWorkoutForDate, setWorkoutDate };
}
