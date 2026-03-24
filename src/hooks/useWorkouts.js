import { useState, useEffect } from 'react';
import { LS_WORKOUTS } from '../constants';
import { readLS, writeLS } from '../storage/index';

/**
 * Hook for managing parsed workouts from localStorage
 * @returns {{ workouts: Object, saveWorkouts: Function }}
 */
export function useWorkouts() {
  const [workouts, setWorkouts] = useState(() => {
    return readLS(LS_WORKOUTS, {});
  });

  function saveWorkouts(workoutMap) {
    writeLS(LS_WORKOUTS, workoutMap);
    setWorkouts(workoutMap);
  }

  function updateExerciseNotes(workoutTitle, exerciseTitle, notes) {
    const workout = workouts[workoutTitle];
    if (!workout) return;

    const updatedBlocks = workout.blocks.map((block) => ({
      ...block,
      exercises: block.exercises.map((ex) =>
        ex.title === exerciseTitle ? { ...ex, notes } : ex
      ),
    }));

    saveWorkouts({
      ...workouts,
      [workoutTitle]: { ...workout, blocks: updatedBlocks },
    });
  }

  return { workouts, saveWorkouts, updateExerciseNotes };
}
