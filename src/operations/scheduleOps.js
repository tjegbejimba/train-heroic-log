/**
 * Schedule-related operations.
 *
 * @module operations/scheduleOps
 */

import { compose } from './core.js';
import { removeOrphanWorkout } from './orphans.js';

/**
 * Remove all schedule entries that point to a given workout name.
 *
 * @param {string} workoutName
 * @returns {function(import('./core').DataSnapshot): import('./core').Changeset}
 */
export function removeFromSchedule(workoutName) {
  return (state) => {
    const schedule = { ...state.schedule };
    let changed = false;
    for (const [date, title] of Object.entries(schedule)) {
      if (title === workoutName) {
        delete schedule[date];
        changed = true;
      }
    }
    return changed ? { schedule } : {};
  };
}

/**
 * Rename a workout title in all schedule entries.
 *
 * @param {string} oldName
 * @param {string} newName
 * @returns {function(import('./core').DataSnapshot): import('./core').Changeset}
 */
export function renameInSchedule(oldName, newName) {
  return (state) => {
    const schedule = { ...state.schedule };
    let changed = false;
    for (const [date, title] of Object.entries(schedule)) {
      if (title === oldName) {
        schedule[date] = newName;
        changed = true;
      }
    }
    return changed ? { schedule } : {};
  };
}

/**
 * Ensure a workout definition exists (create from template if needed).
 *
 * @param {string} workoutName
 * @returns {function(import('./core').DataSnapshot): import('./core').Changeset}
 */
export function ensureWorkoutFromTemplate(workoutName) {
  return (state) => {
    if (state.workouts[workoutName]) return {};
    const tpl = Object.values(state.templates).find((t) => t.name === workoutName);
    if (!tpl) return {};
    return {
      workouts: {
        ...state.workouts,
        [workoutName]: { title: workoutName, blocks: tpl.blocks, notes: tpl.notes || '' },
      },
    };
  };
}

/**
 * Set or clear a single schedule date.
 *
 * When setting: ensures the workout exists (materializes from template).
 * When clearing (title=null): removes the evicted workout if orphaned.
 *
 * @param {string} dateStr  - YYYY-MM-DD
 * @param {string|null} workoutTitle - null to clear
 * @returns {function(import('./core').DataSnapshot): import('./core').Changeset}
 */
export function setWorkoutDate(dateStr, workoutTitle) {
  return (state) => {
    if (workoutTitle) {
      // Setting a date — ensure workout exists, then write schedule
      const setSchedule = (s) => {
        const schedule = { ...s.schedule, [dateStr]: workoutTitle };
        return { schedule };
      };
      return compose(
        ensureWorkoutFromTemplate(workoutTitle),
        setSchedule,
      )(state);
    }

    // Clearing a date — update schedule, then clean orphan
    const evictedTitle = state.schedule[dateStr];
    const clearDate = (s) => {
      const schedule = { ...s.schedule };
      delete schedule[dateStr];
      return { schedule };
    };

    if (evictedTitle) {
      return compose(
        clearDate,
        removeOrphanWorkout(evictedTitle),
      )(state);
    }

    return clearDate(state);
  };
}

/**
 * Batch-apply a week plan: { [date]: workoutTitle | null }.
 *
 * Single-pass: builds final schedule, creates missing workouts, removes
 * orphans.  Produces at most one changeset per entity (no stale-closure
 * overwrites).
 *
 * @param {Object<string, string|null>} dateMap
 * @returns {function(import('./core').DataSnapshot): import('./core').Changeset}
 */
export function applyPlan(dateMap) {
  return (state) => {
    // 1. Build the final schedule
    const newSchedule = { ...state.schedule };
    const evictedTitles = [];

    for (const [date, title] of Object.entries(dateMap)) {
      if (title === null) {
        const evicted = newSchedule[date];
        if (evicted) evictedTitles.push(evicted);
        delete newSchedule[date];
      } else {
        newSchedule[date] = title;
      }
    }

    // 2. Build the final workouts: create missing, remove orphans
    let newWorkouts = { ...state.workouts };
    let workoutsChanged = false;

    // Create missing workouts from templates
    for (const [, title] of Object.entries(dateMap)) {
      if (title !== null && !newWorkouts[title]) {
        const tpl = Object.values(state.templates).find((t) => t.name === title);
        if (tpl) {
          newWorkouts[title] = { title, blocks: tpl.blocks, notes: tpl.notes || '' };
          workoutsChanged = true;
        }
      }
    }

    // Remove orphaned workouts (evicted and no longer scheduled or logged)
    for (const evicted of evictedTitles) {
      if (!newWorkouts[evicted]) continue;
      const stillUsed = Object.values(newSchedule).includes(evicted);
      const hasLog = Object.keys(state.logs).some((k) => k.endsWith(`::${evicted}`));
      if (!stillUsed && !hasLog) {
        delete newWorkouts[evicted];
        workoutsChanged = true;
      }
    }

    const changeset = { schedule: newSchedule };
    if (workoutsChanged) changeset.workouts = newWorkouts;
    return changeset;
  };
}
