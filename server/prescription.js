export const UNIT_OPTIONS = ['lb', 'kg', 'bw', 'reps', '%', 'yd', 'm', 'RPE', 'in', 'ft', 'sec'];
export const normalizeName = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const textSchema = { type: 'string', maxLength: 10000 };
const nameSchema = { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' };
const unitSchema = { type: 'string', enum: UNIT_OPTIONS };
const nonnegativeSchema = { type: ['number', 'null'], minimum: 0 };
const objectSchema = (required, properties) => ({ type: 'object', additionalProperties: false, required, properties });
const arraySchema = (ref, maxItems) => ({ type: 'array', minItems: 1, maxItems, items: { $ref: `#/$defs/${ref}` } });
export const PLAN_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'TrainLog coach plan',
  description: 'Check with the server before apply. Dates must be today or later in America/Los_Angeles; started/completed dates and differing existing workout prescriptions are protected.',
  ...objectSchema(['baseRevision', 'templates', 'schedule'], {
    baseRevision: { type: 'string', pattern: '^[a-f0-9]{64}$', description: 'Copy from context; never replace without reviewing changed data.' },
    replaceScheduled: { type: 'boolean', default: false },
    templates: { ...arraySchema('template', 100), minItems: 0 },
    schedule: { type: 'object', maxProperties: 366, propertyNames: { pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, additionalProperties: nameSchema },
  }),
  $defs: {
    template: objectSchema(['name', 'blocks'], {
      name: nameSchema, notes: textSchema, blocks: arraySchema('part', 100),
    }),
    part: objectSchema(['exercises'], {
      value: textSchema, units: textSchema, instructions: textSchema, notes: textSchema, exercises: arraySchema('exercise', 20),
    }),
    exercise: objectSchema(['title', 'sets'], {
      title: { ...nameSchema, description: 'Reuse exact existing exercise titles; no repeated title in one workout.' },
      notes: { ...textSchema, description: 'Form notes for NEW exercises only. Existing form notes are inherited; use the explicit notes command to change them.' },
      workoutNotes: textSchema, sets: arraySchema('set', 100), unit: unitSchema, repsUnit: unitSchema,
      showValue: { type: 'boolean' }, restDuration: nonnegativeSchema, barWeight: nonnegativeSchema,
    }),
    set: {
      ...objectSchema([], {
        reps: { type: ['number', 'null'], exclusiveMinimum: 0 }, weight: nonnegativeSchema,
        unit: unitSchema, repsUnit: unitSchema, rawReps: textSchema, rawWeight: textSchema,
      }),
      anyOf: [
        { required: ['reps'], properties: { reps: { type: 'number', exclusiveMinimum: 0 } } },
        { required: ['rawReps'], properties: { rawReps: { type: 'string', pattern: '\\S' } } },
      ],
    },
  },
};

export function validatePlan(plan, today) {
  const errors = [];
  const object = (value, keys, at) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { errors.push(`${at}: expected an object`); return false; }
    for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${at}.${key}: unknown field`);
    return true;
  };
  const text = (value, at, required = false) => {
    if (value === undefined && !required) return;
    if (typeof value !== 'string' || value.length > 10000 || (required && !value.trim())) errors.push(`${at}: expected ${required ? 'nonempty ' : ''}text`);
  };
  const name = (value, at) => {
    text(value, at, true);
    if (typeof value === 'string' && value.length > 200) errors.push(`${at}: names must be at most 200 characters`);
    if (typeof value === 'string' && ['__proto__', 'constructor', 'prototype'].includes(normalizeName(value))) errors.push(`${at}: reserved name`);
  };
  const list = (value, at, limit) => {
    if (!Array.isArray(value) || !value.length || value.length > limit) { errors.push(`${at}: expected 1-${limit} items`); return false; }
    return true;
  };
  const numeric = (value, at, positive = false) => {
    if (value == null) return;
    if (typeof value !== 'number' || !Number.isFinite(value) || (positive ? value <= 0 : value < 0)) errors.push(`${at}: expected a ${positive ? 'positive' : 'nonnegative'} number`);
  };
  const unit = (value, at) => {
    if (value !== undefined && !UNIT_OPTIONS.includes(value)) errors.push(`${at}: unsupported unit`);
  };
  if (!object(plan, ['baseRevision', 'templates', 'schedule', 'replaceScheduled'], 'plan')) return errors;
  if (typeof plan.baseRevision !== 'string' || !/^[a-f0-9]{64}$/.test(plan.baseRevision)) errors.push('baseRevision: use the revision returned by context');
  if (plan.replaceScheduled !== undefined && typeof plan.replaceScheduled !== 'boolean') errors.push('replaceScheduled: expected boolean');
  if (!Array.isArray(plan.templates) || plan.templates.length > 100) errors.push('templates: expected an array of at most 100 templates');
  else {
    const names = new Set();
    plan.templates.forEach((template, t) => {
      const at = `templates[${t}]`;
      if (!object(template, ['name', 'notes', 'blocks'], at)) return;
      name(template.name, `${at}.name`);
      text(template.notes, `${at}.notes`);
      if (typeof template.name === 'string') {
        const normalized = normalizeName(template.name);
        if (names.has(normalized)) errors.push(`${at}.name: duplicate template name`);
        names.add(normalized);
      }
      const exercises = new Set();
      if (!list(template.blocks, `${at}.blocks`, 100)) return;
      template.blocks.forEach((block, b) => {
        const part = `${at}.blocks[${b}]`;
        if (!object(block, ['value', 'units', 'instructions', 'notes', 'exercises'], part)) return;
        for (const field of ['value', 'units', 'instructions', 'notes']) text(block[field], `${part}.${field}`);
        if (!list(block.exercises, `${part}.exercises`, 20)) return;
        block.exercises.forEach((exercise, e) => {
          const ex = `${part}.exercises[${e}]`;
          if (!object(exercise, ['title', 'notes', 'workoutNotes', 'sets', 'unit', 'repsUnit', 'showValue', 'restDuration', 'barWeight'], ex)) return;
          name(exercise.title, `${ex}.title`);
          if (typeof exercise.title === 'string') {
            if (exercise.title !== exercise.title.trim()) errors.push(`${ex}.title: use an exact trimmed exercise title`);
            if (exercises.has(exercise.title)) errors.push(`${ex}.title: repeating an exercise in a workout cannot be logged separately`);
            exercises.add(exercise.title);
          }
          for (const field of ['notes', 'workoutNotes']) text(exercise[field], `${ex}.${field}`);
          for (const field of ['unit', 'repsUnit']) unit(exercise[field], `${ex}.${field}`);
          for (const field of ['restDuration', 'barWeight']) numeric(exercise[field], `${ex}.${field}`);
          if (exercise.showValue !== undefined && typeof exercise.showValue !== 'boolean') errors.push(`${ex}.showValue: expected boolean`);
          if (!list(exercise.sets, `${ex}.sets`, 100)) return;
          exercise.sets.forEach((set, s) => {
            const atSet = `${ex}.sets[${s}]`;
            if (!object(set, ['reps', 'weight', 'unit', 'repsUnit', 'rawReps', 'rawWeight'], atSet)) return;
            numeric(set.reps, `${atSet}.reps`, true);
            numeric(set.weight, `${atSet}.weight`);
            for (const field of ['unit', 'repsUnit']) unit(set[field], `${atSet}.${field}`);
            for (const field of ['rawReps', 'rawWeight']) text(set[field], `${atSet}.${field}`);
            if (set.reps == null && !(typeof set.rawReps === 'string' && set.rawReps.trim())) errors.push(`${atSet}: prescribe reps or rawReps (for example AMRAP)`);
          });
        });
      });
    });
  }
  if (!plan.schedule || typeof plan.schedule !== 'object' || Array.isArray(plan.schedule) || Object.keys(plan.schedule).length > 366) errors.push('schedule: expected a map of at most 366 dates');
  else for (const [date, title] of Object.entries(plan.schedule)) {
    const parsed = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < today) errors.push(`schedule.${date}: expected today or a future real YYYY-MM-DD date`);
    name(title, `schedule.${date}`);
  }
  return errors;
}

export function normalizeBlocks(blocks, formNotes = new Map()) {
  return blocks.map((block) => ({
    value: '', units: '', instructions: '', notes: '', ...block,
    exercises: block.exercises.map((exercise) => {
      const unit = exercise.unit || exercise.sets[0]?.unit || 'lb';
      const repsUnit = exercise.repsUnit || exercise.sets[0]?.repsUnit || 'reps';
      return {
        workoutNotes: '', showValue: true, restDuration: null, barWeight: null, ...exercise, unit, repsUnit,
        notes: formNotes.has(exercise.title) ? formNotes.get(exercise.title) : exercise.notes || '',
        sets: exercise.sets.map((set) => ({
          reps: null, weight: null, unit, repsUnit, rawReps: '', rawWeight: '', ...set,
        })),
      };
    }),
  }));
}
