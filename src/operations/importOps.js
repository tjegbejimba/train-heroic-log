/**
 * CSV import operation.
 *
 * Merges imported workouts into the template/workout/schedule stores,
 * preserving workoutNotes that were added via the template editor.
 *
 * @module operations/importOps
 */

/**
 * Merge exercises' workoutNotes from existing template blocks into
 * new blocks.  Returns new blocks with workoutNotes preserved.
 *
 * @param {Array} newBlocks      - blocks from CSV import
 * @param {Array} existingBlocks - blocks from existing template
 * @returns {Array}
 */
export function mergeWorkoutNotes(newBlocks, existingBlocks) {
  const savedNotes = {};
  for (const block of existingBlocks) {
    for (const ex of block.exercises) {
      if (ex.workoutNotes) savedNotes[ex.title] = ex.workoutNotes;
    }
  }
  if (Object.keys(savedNotes).length === 0) return newBlocks;

  return newBlocks.map((block) => ({
    ...block,
    exercises: block.exercises.map((ex) =>
      savedNotes[ex.title] ? { ...ex, workoutNotes: savedNotes[ex.title] } : ex,
    ),
  }));
}

/**
 * Import workouts from CSV data.
 *
 * - Saves workouts map and schedule map directly
 * - Auto-creates or updates templates for each workout title
 * - Preserves existing workoutNotes from templates
 *
 * @param {Object<string, Object>} workoutMap  - title → workout
 * @param {Object<string, string>} scheduleMap - date → title
 * @returns {function(import('./core').DataSnapshot): import('./core').Changeset}
 */
export function importWorkouts(workoutMap, scheduleMap) {
  return (state) => {
    // Index existing templates by name for fast lookup
    const existingByName = {};
    for (const [id, tpl] of Object.entries(state.templates)) {
      existingByName[tpl.name] = id;
    }

    const templates = { ...state.templates };
    let idx = 0;

    for (const workout of Object.values(workoutMap)) {
      const existingId = existingByName[workout.title];

      if (existingId) {
        // Update existing template, preserving workoutNotes
        const existing = templates[existingId];
        const mergedBlocks = mergeWorkoutNotes(workout.blocks, existing.blocks);
        templates[existingId] = {
          ...existing,
          blocks: mergedBlocks,
          notes: workout.notes || existing.notes || '',
        };
      } else {
        // Create new template
        const id = `tpl_${Date.now()}_${idx}`;
        templates[id] = {
          id,
          name: workout.title,
          createdDate: new Date().toISOString(),
          blocks: workout.blocks,
          notes: workout.notes || '',
        };
        idx++;
      }
    }

    return {
      workouts: workoutMap,
      schedule: scheduleMap,
      templates,
    };
  };
}
