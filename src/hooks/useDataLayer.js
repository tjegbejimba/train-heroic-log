/**
 * React bridge between pure operations and the hook-based data stores.
 *
 * Centralizes all 7 hooks and exposes a `dispatch(operation)` function
 * that applies an operation's changeset to the correct stores.
 *
 * Uses a ref to track the latest committed state so that multiple
 * dispatches within the same event handler see each other's writes
 * (fixes the stale-snapshot problem).
 *
 * @module hooks/useDataLayer
 */

import { useRef, useCallback } from 'react';
import { useWorkouts } from './useWorkouts.js';
import { useSchedule } from './useSchedule.js';
import { useTemplates } from './useTemplates.js';
import { useWorkoutLogs } from './useWorkoutLogs.js';
import { useActiveWorkout } from './useActiveWorkout.js';
import { useYouTubeLinks } from './useYouTubeLinks.js';
import { ENTITY_KEYS, applyChangeset } from '../operations/core.js';

/**
 * @returns {Object} data   - all state + dispatch
 * @returns {function} data.dispatch - (operation) => DispatchResult
 */
export function useDataLayer() {
  const { workouts, saveWorkouts } = useWorkouts();
  const { schedule, saveSchedule } = useSchedule();
  const { templates, templateList, saveTemplates, saveTemplate, duplicateTemplate } =
    useTemplates();
  const { logs, saveLog, getLog, deleteLog, completedDates, allLogs } = useWorkoutLogs();
  const { session, createSession, updateSession, clearSession } = useActiveWorkout();
  const { links, setLink, setManyLinks, getLink } = useYouTubeLinks();

  // Writers: one per entity key, called with full replacement map.
  const writers = {
    templates: saveTemplates,
    workouts: saveWorkouts,
    schedule: saveSchedule,
    // logs: bulk-write is rarely needed; individual ops use saveLog.
    // Add here if a future operation needs to bulk-replace logs.
  };

  // Ref tracks the latest committed snapshot so sequential dispatches
  // in the same event handler don't read stale React state.
  const latestRef = useRef(null);
  latestRef.current = { templates, workouts, schedule, logs };

  /**
   * Execute a pure operation against the current data snapshot.
   *
   * @param {function(import('../operations/core').DataSnapshot): import('../operations/core').Changeset} operation
   * @returns {import('../operations/core').DispatchResult}
   *
   * @example
   *   import { deleteTemplate } from '../operations/templateOps';
   *   const result = dispatch(deleteTemplate(templateId));
   *   if (!result.ok) showToast(result.error, 'error');
   */
  const dispatch = useCallback(
    (operation) => {
      const snapshot = latestRef.current;
      const changeset = operation(snapshot);
      const result = applyChangeset(changeset, writers);

      // Update ref so the *next* dispatch in this tick sees fresh state
      if (result.ok && result.changes) {
        const updated = { ...latestRef.current };
        for (const key of ENTITY_KEYS) {
          if (result.changes[key] !== undefined) {
            updated[key] = result.changes[key];
          }
        }
        latestRef.current = updated;
      }

      return result;
    },
    // Writers are stable (from hooks that use useState setters)
    [writers.templates, writers.workouts, writers.schedule],
  );

  return {
    // ── Orchestrated state (read-only for views) ───────────────
    templates,
    templateList,
    workouts,
    schedule,
    logs,
    completedDates,
    allLogs,

    // ── Dispatch for composed operations ───────────────────────
    dispatch,

    // ── Passthrough for non-orchestrated operations ────────────
    // These are single-entity writes that don't need cross-entity
    // coordination and can stay as direct calls.
    getLog,
    saveLog,
    deleteLog,
    saveTemplate,
    duplicateTemplate,

    // Active workout session (single-entity, not in operations)
    session,
    createSession,
    updateSession,
    clearSession,

    // YouTube links (single-entity, not in operations)
    links,
    setLink,
    setManyLinks,
    getLink,
  };
}
