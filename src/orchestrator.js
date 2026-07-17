/**
 * Data Orchestration Layer — pure functions, zero React dependencies.
 * Each function: (snapshot, ...params) → Result
 *
 * Snapshot: { templates, workouts, schedule, logs }
 * Result:   { templates?, workouts?, schedule?, error?, meta? }
 * Only changed keys are present. Omitted = no write needed.
 */

// ─── Internal helpers ───────────────────────────────────

function isWorkoutOrphaned(title, schedule, logs) {
  const stillScheduled = Object.values(schedule).includes(title);
  if (stillScheduled) return false;
  const referencedByLog = Object.keys(logs).some((k) => k.endsWith(`::${title}`));
  return !referencedByLog;
}

function workoutFromTemplate(tpl) {
  return { title: tpl.name, blocks: tpl.blocks, notes: tpl.notes || '' };
}

function updateBlockNotes(blocks, exerciseTitle, notes) {
  return blocks.map((block) => ({
    ...block,
    exercises: block.exercises.map((ex) =>
      ex.title === exerciseTitle ? { ...ex, notes } : ex
    ),
  }));
}

function hasNameCollision(templates, name, excludeId = null) {
  const lower = name.toLowerCase();
  return Object.values(templates).some(
    (t) => (excludeId ? t.id !== excludeId : true) && t.name.toLowerCase() === lower
  );
}

function findTemplateByName(templates, name) {
  return Object.values(templates).find((t) => t.name === name);
}

// Deep, reference-free copy of a JSON-serializable value so a duplicated
// Template shares no nested objects (Parts, Exercises, Sets, notes) with its
// source. `structuredClone` is available in supported browsers and Node ≥17;
// the JSON round-trip is a defensive fallback for older runtimes.
function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

// A completed Log is keyed `YYYY-MM-DD::WorkoutTitle`. Workout titles may
// themselves contain `::`, so match on the exact title after the first
// separator rather than a naive suffix check.
function isWorkoutLogged(logs, workoutTitle) {
  return Object.keys(logs).some((k) => {
    const idx = k.indexOf('::');
    return idx !== -1 && k.slice(idx + 2) === workoutTitle;
  });
}

// Local calendar date (YYYY-MM-DD) — mirrors App.jsx's currentDate derivation so
// schedule comparisons use the user's day, not UTC.
function localTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Public API ─────────────────────────────────────────

/**
 * Template lifecycle: save/rename, delete, create, syncBlocks.
 *
 * `save` keeps the materialized Workout consistent with the Template — an
 * explicit save cascades the Template's blocks (including edited set targets)
 * onto the matching Workout, mirroring the `syncBlocks` path used when a target
 * change is confirmed from an active Session.
 */
export function applyTemplateChange(snap, change) {
  const { type } = change;

  if (type === 'delete') {
    const { templateId, today } = change;
    const tpl = snap.templates[templateId];
    if (!tpl) return { error: 'Template not found' };

    const referenceDate = today || localTodayISO();

    const newTemplates = { ...snap.templates };
    delete newTemplates[templateId];

    // The template is gone, so drop its *past* schedule entries. Future entries
    // stay — the user still plans to train that Workout, so it must survive.
    const newSchedule = { ...snap.schedule };
    let hasFutureSchedule = false;
    Object.entries(newSchedule).forEach(([date, title]) => {
      if (title !== tpl.name) return;
      if (date >= referenceDate) hasFutureSchedule = true;
      else delete newSchedule[date];
    });

    const result = { templates: newTemplates, schedule: newSchedule };

    // Remove the materialized Workout only when nothing meaningful references it:
    // no completed Log (History) and no future Schedule (upcoming plan).
    if (snap.workouts[tpl.name]) {
      const referencedByLog = isWorkoutLogged(snap.logs, tpl.name);
      if (!referencedByLog && !hasFutureSchedule) {
        const newWorkouts = { ...snap.workouts };
        delete newWorkouts[tpl.name];
        result.workouts = newWorkouts;
      }
    }

    return result;
  }

  if (type === 'save') {
    const { template, previousName } = change;
    const oldName = previousName || template.name;
    const newName = template.name;
    const isRename = oldName !== newName;

    if (isRename && hasNameCollision(snap.templates, newName, template.id)) {
      return { error: 'A template with this name already exists' };
    }

    const result = {
      templates: { ...snap.templates, [template.id]: template },
    };

    if (isRename) {
      // Cascade to schedule
      const newSchedule = { ...snap.schedule };
      let scheduleChanged = false;
      Object.entries(newSchedule).forEach(([date, title]) => {
        if (title === oldName) { newSchedule[date] = newName; scheduleChanged = true; }
      });
      if (scheduleChanged) result.schedule = newSchedule;
    }

    // Keep the materialized Workout consistent with the saved Template so an
    // edited target (prescribed set) stays in sync in both directions. On a
    // rename the workout also moves to the new key/title; either way it adopts
    // the Template's blocks. This is the same explicit-save lifecycle path the
    // active-Session direction uses via `syncBlocks`. When the old key is absent
    // but a stale workout already sits under the new name, refresh that one.
    const sourceName = snap.workouts[oldName]
      ? oldName
      : (snap.workouts[newName] ? newName : null);
    if (sourceName) {
      const newWorkouts = { ...snap.workouts };
      const existing = newWorkouts[sourceName];
      if (isRename && sourceName !== newName) delete newWorkouts[sourceName];
      newWorkouts[newName] = { ...existing, title: newName, blocks: template.blocks };
      result.workouts = newWorkouts;
    }

    return result;
  }

  if (type === 'create') {
    const { workout, makeId } = change;
    if (hasNameCollision(snap.templates, workout.title)) {
      return { error: 'A template with this name already exists' };
    }
    const id = makeId ? makeId() : `tpl_${Date.now()}`;
    const tpl = {
      id,
      name: workout.title,
      createdDate: new Date().toISOString(),
      blocks: workout.blocks,
      notes: workout.notes || '',
    };
    return { templates: { ...snap.templates, [id]: tpl }, meta: { createdId: id } };
  }

  if (type === 'duplicate') {
    const { templateId, makeId } = change;
    const original = snap.templates[templateId];
    if (!original) return { error: 'Template not found' };

    // Consistent collision handling: a copy is named "<name> (Copy)". If that
    // name is already taken, reject with the exact same outcome as create and
    // rename rather than silently minting a colliding Template.
    const name = `${original.name} (Copy)`;
    if (hasNameCollision(snap.templates, name)) {
      return { error: 'A template with this name already exists' };
    }

    const id = makeId ? makeId() : `tpl_${Date.now()}`;
    const copy = deepClone(original);
    copy.id = id;
    copy.name = name;
    copy.createdDate = new Date().toISOString();

    return { templates: { ...snap.templates, [id]: copy }, meta: { createdId: id } };
  }

  if (type === 'syncBlocks') {
    const { workoutTitle, blocks } = change;
    const result = {};

    if (snap.workouts[workoutTitle]) {
      result.workouts = {
        ...snap.workouts,
        [workoutTitle]: { ...snap.workouts[workoutTitle], blocks },
      };
    }

    const tpl = findTemplateByName(snap.templates, workoutTitle);
    if (tpl) {
      result.templates = {
        ...snap.templates,
        [tpl.id]: { ...tpl, blocks },
      };
    }

    return result;
  }

  return { error: `Unknown change type: ${type}` };
}

/**
 * Schedule mutations: assign or clear one-to-many dates.
 * Creates workouts from templates when scheduling. Cleans orphans when clearing.
 */
export function applyScheduleChange(snap, changes) {
  const newSchedule = { ...snap.schedule };
  let newWorkouts = { ...snap.workouts };
  let workoutsChanged = false;

  // Apply all date changes to schedule first
  Object.entries(changes).forEach(([date, title]) => {
    if (title === null) {
      delete newSchedule[date];
    } else {
      newSchedule[date] = title;
    }
  });

  // Create missing workouts for assigned dates
  Object.entries(changes).forEach(([, title]) => {
    if (title !== null && !newWorkouts[title]) {
      const tplList = Object.values(snap.templates);
      const tpl = tplList.find((t) => t.name === title);
      if (tpl) {
        newWorkouts[title] = workoutFromTemplate(tpl);
        workoutsChanged = true;
      }
    }
  });

  // Clean orphan workouts for cleared dates
  Object.entries(changes).forEach(([date, title]) => {
    if (title === null) {
      const evictedTitle = snap.schedule[date];
      if (evictedTitle && newWorkouts[evictedTitle]) {
        if (isWorkoutOrphaned(evictedTitle, newSchedule, snap.logs)) {
          delete newWorkouts[evictedTitle];
          workoutsChanged = true;
        }
      }
    }
  });

  const result = { schedule: newSchedule };
  if (workoutsChanged) result.workouts = newWorkouts;
  return result;
}

/**
 * Exercise note propagation.
 * Scoped: updates one workout + matching template.
 * Global: updates ALL workouts + ALL templates.
 */
export function applyNoteChange(snap, exerciseTitle, notes, scope = {}) {
  const result = {};

  if (scope.workoutTitle) {
    // Scoped: update one workout + matching template
    const newWorkouts = { ...snap.workouts };
    if (newWorkouts[scope.workoutTitle]) {
      newWorkouts[scope.workoutTitle] = {
        ...newWorkouts[scope.workoutTitle],
        blocks: updateBlockNotes(newWorkouts[scope.workoutTitle].blocks, exerciseTitle, notes),
      };
    }
    result.workouts = newWorkouts;

    const tpl = findTemplateByName(snap.templates, scope.workoutTitle);
    if (tpl) {
      result.templates = {
        ...snap.templates,
        [tpl.id]: { ...tpl, blocks: updateBlockNotes(tpl.blocks, exerciseTitle, notes) },
      };
    }
  } else {
    // Global: update ALL workouts + ALL templates
    const newWorkouts = {};
    Object.entries(snap.workouts).forEach(([title, workout]) => {
      newWorkouts[title] = {
        ...workout,
        blocks: updateBlockNotes(workout.blocks, exerciseTitle, notes),
      };
    });
    result.workouts = newWorkouts;

    const newTemplates = {};
    Object.entries(snap.templates).forEach(([id, tpl]) => {
      newTemplates[id] = {
        ...tpl,
        blocks: updateBlockNotes(tpl.blocks, exerciseTitle, notes),
      };
    });
    result.templates = newTemplates;
  }

  return result;
}

/**
 * CSV import merge. Creates workouts + schedule, merges templates
 * preserving workoutNotes from existing templates.
 */
export function applyImport(snap, workoutMap, scheduleMap, opts = {}) {
  const { makeId } = opts;

  // Build existing-by-name lookup
  const existingByName = {};
  Object.entries(snap.templates).forEach(([id, tpl]) => {
    existingByName[tpl.name] = id;
  });

  const updatedTemplates = { ...snap.templates };
  let idx = 0;

  Object.values(workoutMap).forEach((workout) => {
    const existingId = existingByName[workout.title];
    if (existingId) {
      // Preserve workoutNotes from existing template
      const existingTpl = updatedTemplates[existingId];
      const savedWorkoutNotes = {};
      existingTpl.blocks.forEach((b) =>
        b.exercises.forEach((ex) => {
          if (ex.workoutNotes) savedWorkoutNotes[ex.title] = ex.workoutNotes;
        })
      );
      const mergedBlocks = workout.blocks.map((b) => ({
        ...b,
        exercises: b.exercises.map((ex) =>
          savedWorkoutNotes[ex.title]
            ? { ...ex, workoutNotes: savedWorkoutNotes[ex.title] }
            : ex
        ),
      }));
      updatedTemplates[existingId] = {
        ...existingTpl,
        blocks: mergedBlocks,
        notes: workout.notes || existingTpl.notes || '',
      };
    } else {
      const id = makeId ? makeId(idx) : `tpl_${Date.now()}_${idx}`;
      updatedTemplates[id] = {
        id,
        name: workout.title,
        createdDate: new Date().toISOString(),
        blocks: workout.blocks,
        notes: workout.notes || '',
      };
    }
    idx++;
  });

  return {
    workouts: workoutMap,
    schedule: scheduleMap,
    templates: updatedTemplates,
  };
}
