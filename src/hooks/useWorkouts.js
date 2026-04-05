import { LS_WORKOUTS } from '../constants';
import { createEntityHook } from './createEntityHook';

const useWorkoutsBase = createEntityHook(LS_WORKOUTS, {});

/**
 * Hook for managing parsed workouts from localStorage
 */
export function useWorkouts() {
  const { data: workouts, save: saveWorkouts } = useWorkoutsBase();

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
