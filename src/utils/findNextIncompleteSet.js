/**
 * Find the next incomplete set in workout order.
 * @param {Object} workout - The workout object with blocks[].exercises[]
 * @param {Object} currentLog - The current log with exercises[exerciseTitle][setIndex].completed
 * @returns {{ exerciseTitle: string, setIndex: number } | null}
 */
export function findNextIncompleteSet(workout, currentLog) {
  if (!workout?.blocks || !currentLog?.exercises) return null;

  for (const block of workout.blocks) {
    for (const exercise of block.exercises) {
      const loggedSets = currentLog.exercises[exercise.title];
      if (!loggedSets) continue;
      for (let i = 0; i < loggedSets.length; i++) {
        if (!loggedSets[i].completed) {
          return { exerciseTitle: exercise.title, setIndex: i };
        }
      }
    }
  }
  return null;
}
