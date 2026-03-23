import { useState } from 'react';
import { LS_SCHEDULE } from '../constants';
import { readLS, writeLS } from '../storage/index';

/**
 * Hook for managing workout schedule (date -> workoutTitle mapping)
 * @returns {{ schedule: Object, saveSchedule: Function, getWorkoutForDate: Function, setWorkoutDate: Function }}
 */
export function useSchedule() {
  const [schedule, setSchedule] = useState(() => {
    return readLS(LS_SCHEDULE, {});
  });

  function saveSchedule(scheduleMap) {
    writeLS(LS_SCHEDULE, scheduleMap);
    setSchedule(scheduleMap);
  }

  function getWorkoutForDate(date) {
    return schedule[date] || null;
  }

  function setWorkoutDate(date, workoutTitle) {
    const updated = { ...schedule };
    if (workoutTitle === null) {
      delete updated[date];
    } else {
      updated[date] = workoutTitle;
    }
    saveSchedule(updated);
  }

  return { schedule, saveSchedule, getWorkoutForDate, setWorkoutDate };
}
