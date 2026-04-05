/**
 * Template-related operations.
 *
 * @module operations/templateOps
 */

import { compose } from './core.js';
import { removeFromSchedule, renameInSchedule } from './scheduleOps.js';
import { removeOrphanWorkout } from './orphans.js';

/**
 * Delete a template and cascade: clean schedule, remove orphan workout.
 *
 * @param {string} templateId
 * @returns {function(import('./core').DataSnapshot): import('./core').Changeset}
 */
export function deleteTemplate(templateId) {
  return (state) => {
    const tpl = state.templates[templateId];
    if (!tpl) return {};

    const templates = { ...state.templates };
    delete templates[templateId];

    return compose(
      () => ({ templates }),
      removeFromSchedule(tpl.name),
      removeOrphanWorkout(tpl.name),
    )(state);
  };
}

/**
 * Rename a template and cascade: update schedule entries, rename workout key.
 *
 * Returns `{ error }` if the new name collides with another template.
 *
 * @param {string} templateId
 * @param {string} newName
 * @returns {function(import('./core').DataSnapshot): import('./core').Changeset}
 */
export function renameTemplate(templateId, newName) {
  return (state) => {
    const tpl = state.templates[templateId];
    if (!tpl) return {};
    const oldName = tpl.name;
    if (oldName === newName) return {};

    // Duplicate name check (case-insensitive)
    const collision = Object.values(state.templates).find(
      (t) => t.id !== templateId && t.name.toLowerCase() === newName.toLowerCase(),
    );
    if (collision) return { error: 'A template with this name already exists' };

    const templates = {
      ...state.templates,
      [templateId]: { ...tpl, name: newName },
    };

    // Rename the workout key if it exists
    const renameWorkout = (s) => {
      if (!s.workouts[oldName]) return {};
      const workouts = { ...s.workouts };
      const workout = workouts[oldName];
      delete workouts[oldName];
      workouts[newName] = { ...workout, title: newName };
      return { workouts };
    };

    return compose(
      () => ({ templates }),
      renameInSchedule(oldName, newName),
      renameWorkout,
    )(state);
  };
}

/**
 * Save a template and sync the matching workout definition + schedule.
 *
 * Handles rename if template.name changed from its previous value.
 * Returns `{ error }` on name collision.
 *
 * @param {Object} updatedTemplate - full template object with id
 * @param {string} previousName   - name before this edit
 * @returns {function(import('./core').DataSnapshot): import('./core').Changeset}
 */
export function saveTemplateAndSync(updatedTemplate, previousName) {
  return (state) => {
    const nameChanged = previousName !== updatedTemplate.name;

    // Duplicate name check
    if (nameChanged) {
      const collision = Object.values(state.templates).find(
        (t) =>
          t.id !== updatedTemplate.id &&
          t.name.toLowerCase() === updatedTemplate.name.toLowerCase(),
      );
      if (collision) return { error: 'A template with this name already exists' };
    }

    const templates = {
      ...state.templates,
      [updatedTemplate.id]: updatedTemplate,
    };

    // Update the matching workout definition
    const syncWorkout = (s) => {
      if (!s.workouts[previousName]) return {};
      const workouts = { ...s.workouts };
      if (nameChanged) delete workouts[previousName];
      workouts[updatedTemplate.name] = {
        title: updatedTemplate.name,
        blocks: updatedTemplate.blocks,
        notes: updatedTemplate.notes || '',
      };
      return { workouts };
    };

    // If renamed, update schedule pointers
    const syncSchedule = nameChanged
      ? renameInSchedule(previousName, updatedTemplate.name)
      : () => ({});

    return compose(
      () => ({ templates }),
      syncWorkout,
      syncSchedule,
    )(state);
  };
}

/**
 * Create a template from a workout definition.
 *
 * Returns `{ error }` if a template with the same name already exists.
 *
 * @param {Object} workout - { title, blocks, notes }
 * @param {string} [id]    - optional custom id; defaults to generated
 * @returns {function(import('./core').DataSnapshot): import('./core').Changeset}
 */
export function createTemplateFromWorkout(workout, id) {
  return (state) => {
    const exists = Object.values(state.templates).some(
      (t) => t.name.toLowerCase() === workout.title.toLowerCase(),
    );
    if (exists) return { error: 'A template with this name already exists' };

    const templateId = id || `tpl_${Date.now()}`;
    const template = {
      id: templateId,
      name: workout.title,
      createdDate: new Date().toISOString(),
      blocks: workout.blocks,
      notes: workout.notes || '',
    };

    return {
      templates: { ...state.templates, [templateId]: template },
    };
  };
}
