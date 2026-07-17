import { useRef } from 'react';

/**
 * Training Plan shell — owns the latest *committed* snapshot that lifecycle
 * actions read from, and dispatches orchestrator results to the entity writers.
 *
 * Why this exists: the orchestrator functions are pure `(snapshot, …) → result`,
 * but React render state lags behind synchronous writes. Two planning actions
 * fired back-to-back in one tick both read the same render-time snapshot, so the
 * second silently overwrites the first's committed change. This hook keeps a ref
 * to the latest committed snapshot and advances it immediately after every
 * successful write, so sequential actions build on prior committed state.
 *
 * @param {object}   args
 * @param {object}   args.state    Current render snapshot: { templates, workouts, schedule, logs }.
 * @param {object}   args.writers  { saveTemplates, saveWorkouts, saveSchedule } commit functions.
 * @param {function} [args.onError] Called with the error message when a result is rejected.
 * @returns {{ snap: () => object, applyWrites: (result: object) => boolean }}
 */
export function useTrainingPlanShell({ state, writers, onError }) {
  const { templates, workouts, schedule, logs } = state;

  const committedRef = useRef({ templates, workouts, schedule, logs });

  // Keep the committed snapshot aligned with the latest render so external
  // updates (sync pulls, logging, restore) are observed by the next action.
  // Advances made between renders survive because React re-renders with state
  // that already includes them, so this only ever syncs forward.
  const current = committedRef.current;
  if (
    current.templates !== templates ||
    current.workouts !== workouts ||
    current.schedule !== schedule ||
    current.logs !== logs
  ) {
    committedRef.current = { templates, workouts, schedule, logs };
  }

  const snap = () => committedRef.current;

  const applyWrites = (result) => {
    // A rejected action must leave committed state fully intact — no partial
    // snapshot is committed or exposed to the next action.
    if (result.error) {
      if (onError) onError(result.error);
      return false;
    }

    const next = { ...committedRef.current };
    if (result.templates !== undefined) {
      writers.saveTemplates(result.templates);
      next.templates = result.templates;
    }
    if (result.workouts !== undefined) {
      writers.saveWorkouts(result.workouts);
      next.workouts = result.workouts;
    }
    if (result.schedule !== undefined) {
      writers.saveSchedule(result.schedule);
      next.schedule = result.schedule;
    }

    // Advance atomically only after all writers succeeded.
    committedRef.current = next;
    return true;
  };

  return { snap, applyWrites };
}
