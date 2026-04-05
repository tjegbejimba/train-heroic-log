/**
 * Data Orchestration Layer — public API.
 *
 * All cross-entity operations are pure functions:
 *   operationName(args) → (snapshot) → changeset
 *
 * Use with `dispatch()` from useDataLayer:
 *   const result = dispatch(deleteTemplate(id));
 *
 * @module operations
 */

// Core primitives
export { compose, applyChangeset, ENTITY_KEYS } from './core.js';

// Orphan detection
export { removeOrphanWorkout, isReferencedByLog, isScheduled } from './orphans.js';

// Schedule operations
export {
  removeFromSchedule,
  renameInSchedule,
  ensureWorkoutFromTemplate,
  setWorkoutDate,
  applyPlan,
} from './scheduleOps.js';

// Template operations
export {
  deleteTemplate,
  renameTemplate,
  saveTemplateAndSync,
  createTemplateFromWorkout,
} from './templateOps.js';

// Exercise note operations
export {
  mapExerciseInBlocks,
  updateExerciseNotesForWorkout,
  updateExerciseNotesGlobal,
  syncWorkoutBlocks,
} from './exerciseOps.js';

// Import operations
export { importWorkouts, mergeWorkoutNotes } from './importOps.js';
