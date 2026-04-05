/**
 * Exercise-note operations.
 *
 * Two distinct scopes:
 * - Per-workout: update notes in one workout + its matching template
 * - Global (Library): update notes across ALL workouts and ALL templates
 *
 * @module operations/exerciseOps
 */

import { compose } from './core.js';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Map over every exercise in every block, applying `fn` to exercises
 * whose title matches.  Returns new blocks array (or the original if
 * nothing changed).
 *
 * @param {Array} blocks
 * @param {string} exerciseTitle
 * @param {function(Object): Object} fn - receives exercise, returns updated
 * @returns {{ blocks: Array, changed: boolean }}
 */
export function mapExerciseInBlocks(blocks, exerciseTitle, fn) {
  let changed = false;
  const newBlocks = blocks.map((block) => ({
    ...block,
    exercises: block.exercises.map((ex) => {
      if (ex.title === exerciseTitle) {
        changed = true;
        return fn(ex);
      }
      return ex;
    }),
  }));
  return { blocks: newBlocks, changed };
}

// ── Operations ───────────────────────────────────────────────────────

/**
 * Update `notes` for one exercise in a single workout AND its matching
 * template.  Used from TrainingView / ActiveWorkoutView.
 *
 * @param {string} workoutTitle
 * @param {string} exerciseTitle
 * @param {string} notes
 * @returns {function(import('./core').DataSnapshot): import('./core').Changeset}
 */
export function updateExerciseNotesForWorkout(workoutTitle, exerciseTitle, notes) {
  return (state) => {
    const updateWorkout = (s) => {
      const workout = s.workouts[workoutTitle];
      if (!workout) return {};
      const { blocks, changed } = mapExerciseInBlocks(
        workout.blocks,
        exerciseTitle,
        (ex) => ({ ...ex, notes }),
      );
      if (!changed) return {};
      return {
        workouts: {
          ...s.workouts,
          [workoutTitle]: { ...workout, blocks },
        },
      };
    };

    const updateTemplate = (s) => {
      const tpl = Object.values(s.templates).find((t) => t.name === workoutTitle);
      if (!tpl) return {};
      const { blocks, changed } = mapExerciseInBlocks(
        tpl.blocks,
        exerciseTitle,
        (ex) => ({ ...ex, notes }),
      );
      if (!changed) return {};
      return {
        templates: {
          ...s.templates,
          [tpl.id]: { ...tpl, blocks },
        },
      };
    };

    return compose(updateWorkout, updateTemplate)(state);
  };
}

/**
 * Update `notes` for an exercise across ALL workouts and ALL templates.
 * Used from LibraryView.
 *
 * @param {string} exerciseTitle
 * @param {string} notes
 * @returns {function(import('./core').DataSnapshot): import('./core').Changeset}
 */
export function updateExerciseNotesGlobal(exerciseTitle, notes) {
  return (state) => {
    const updateAllWorkouts = (s) => {
      const workouts = {};
      let changed = false;
      for (const [title, workout] of Object.entries(s.workouts)) {
        const result = mapExerciseInBlocks(workout.blocks, exerciseTitle, (ex) => ({
          ...ex,
          notes,
        }));
        workouts[title] = result.changed ? { ...workout, blocks: result.blocks } : workout;
        if (result.changed) changed = true;
      }
      return changed ? { workouts } : {};
    };

    const updateAllTemplates = (s) => {
      const templates = {};
      let changed = false;
      for (const [id, tpl] of Object.entries(s.templates)) {
        const result = mapExerciseInBlocks(tpl.blocks, exerciseTitle, (ex) => ({
          ...ex,
          notes,
        }));
        templates[id] = result.changed ? { ...tpl, blocks: result.blocks } : tpl;
        if (result.changed) changed = true;
      }
      return changed ? { templates } : {};
    };

    return compose(updateAllWorkouts, updateAllTemplates)(state);
  };
}

/**
 * Sync workout blocks back to the matching template (and vice versa).
 * Used when the user edits sets/order in ActiveWorkoutView.
 *
 * @param {string} workoutTitle
 * @param {Array} updatedBlocks
 * @returns {function(import('./core').DataSnapshot): import('./core').Changeset}
 */
export function syncWorkoutBlocks(workoutTitle, updatedBlocks) {
  return (state) => {
    const workout = state.workouts[workoutTitle];
    if (!workout) return {};

    const workouts = {
      ...state.workouts,
      [workoutTitle]: { ...workout, blocks: updatedBlocks },
    };

    const tpl = Object.values(state.templates).find((t) => t.name === workoutTitle);
    if (!tpl) return { workouts };

    const templates = {
      ...state.templates,
      [tpl.id]: { ...tpl, blocks: updatedBlocks },
    };

    return { workouts, templates };
  };
}
