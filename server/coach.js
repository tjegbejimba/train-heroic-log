import { Router } from 'express';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canonical, equal, isMap } from './sync-protocol.js';
import { normalizeBlocks, normalizeName, PLAN_SCHEMA, validatePlan } from './prescription.js';

export const COACH_TIME_ZONE = 'America/Los_Angeles';

function calendarToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: COACH_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function context(store) {
  const data = store.snapshot();
  const catalogue = new Map();
  const add = (title, notes = '', source = '') => {
    if (!catalogue.has(title)) catalogue.set(title, { title, formNotes: [], sources: [], youtubeUrl: data.th_yt_links?.[title] || null });
    const item = catalogue.get(title);
    if (notes && !item.formNotes.includes(notes)) item.formNotes.push(notes);
    if (source && !item.sources.includes(source)) item.sources.push(source);
  };
  for (const key of ['th_workouts', 'th_templates']) {
    for (const item of Object.values(data[key] || {})) {
      for (const block of item.blocks || []) {
        for (const exercise of block.exercises || []) add(exercise.title, exercise.notes, item.name || item.title);
      }
    }
  }
  const history = Object.fromEntries(Object.entries(data.th_logs || {}).filter(([, log]) => log?.completedAt));
  for (const log of Object.values(history)) for (const title of Object.keys(log.exercises || {})) add(title);
  for (const title of Object.keys(data.th_yt_links || {})) add(title);
  return {
    revision: store.revision(), timeZone: COACH_TIME_ZONE, today: calendarToday(),
    exercises: [...catalogue.values()].sort((a, b) => a.title.localeCompare(b.title)),
    templates: data.th_templates || {}, workouts: data.th_workouts || {},
    schedule: data.th_schedule || {}, history, activeSession: data.th_active,
    conflicts: store.metadata().conflicts.filter((item) => !item.resolvedAt),
  };
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function definition(item) {
  return {
    notes: item.notes || '',
    blocks: normalizeBlocks(item.blocks).map((block) => ({
      ...block, exercises: block.exercises.map(({ notes, ...exercise }) => exercise),
    })),
  };
}

function preparePlan(store, plan) {
  const errors = validatePlan(plan, calendarToday());
  if (errors.length) fail(errors.join('; '));
  if (!isMap(plan) || !Array.isArray(plan.templates) || !isMap(plan.schedule)) fail('Expected templates array and schedule map');
  if (plan.baseRevision !== store.revision()) fail('Data changed; read context and check the plan again', 409);
  const current = context(store);
  const formNotes = new Map(current.exercises.map((ex) => [ex.title, ex.formNotes[0] || '']));
  const templates = { ...current.templates };
  const workouts = { ...current.workouts };
  const schedule = { ...current.schedule };
  const added = [];
  const warnings = [];
  const knownExercises = new Set(current.exercises.map((ex) => ex.title));
  for (const item of plan.templates) {
    if (!item?.name?.trim() || !Array.isArray(item.blocks) || !item.blocks.length) fail('Each template needs a name and parts');
    const name = item.name.trim().replace(/\s+/g, ' ');
    const id = `tpl_coach_${createHash('sha256').update(normalizeName(name)).digest('hex').slice(0, 24)}`;
    for (const block of item.blocks) for (const exercise of block.exercises) {
      if (exercise.notes !== undefined && formNotes.has(exercise.title) && exercise.notes !== formNotes.get(exercise.title)) {
        warnings.push(`Form notes for ${exercise.title} were inherited unchanged; use notes set to update global cues.`);
      }
    }
    const blocks = normalizeBlocks(item.blocks, formNotes);
    const matches = Object.values(templates).filter((existing) => normalizeName(existing.name) === normalizeName(name));
    const matchingWorkouts = Object.values(workouts).filter((existing) => normalizeName(existing.title) === normalizeName(name));
    if (matches.length > 1 || matchingWorkouts.length > 1) fail(`Ambiguous existing name: ${name}`, 409);
    for (const existing of [...matches, ...matchingWorkouts]) {
      if (!equal(definition(existing), definition({ blocks, notes: item.notes }))) fail(`Prescription conflict: ${name}. Create a separately named workout version.`, 409);
      if ((existing.name || existing.title) !== name) fail(`Use the existing exact name: ${existing.name || existing.title}`, 409);
    }
    if (!matches.length) {
      if (Object.hasOwn(templates, id)) fail(`Template ID collision for ${name}`, 409);
      templates[id] = { id, name, blocks, notes: item.notes || '', createdDate: new Date().toISOString() };
      added.push(name);
    }
    if (!matchingWorkouts.length) workouts[name] = { title: name, blocks, notes: item.notes || '' };
    for (const block of blocks) for (const ex of block.exercises) {
      if (!knownExercises.has(ex.title)) {
        const similar = current.exercises.filter((entry) =>
          normalizeName(entry.title).includes(normalizeName(ex.title)) || normalizeName(ex.title).includes(normalizeName(entry.title)),
        ).map((entry) => entry.title);
        warnings.push(`New exercise: ${ex.title}${similar.length ? `. Check identity against: ${similar.join(', ')}` : ''}`);
        knownExercises.add(ex.title);
        formNotes.set(ex.title, ex.notes);
      }
    }
  }
  for (const [date, title] of Object.entries(plan.schedule)) {
    if (!Object.hasOwn(workouts, title)) fail(`Unknown workout: ${title}`);
    const started = current.activeSession?.logKey?.startsWith(`${date}::`) ||
      Object.keys(store.read('th_logs') || {}).some((key) => key.startsWith(`${date}::`));
    if (started) fail(`Protected training date: ${date} has a started or completed session`, 409);
    if (Object.hasOwn(schedule, date) && schedule[date] !== title && !plan.replaceScheduled) fail(`Schedule conflict on ${date}; set replaceScheduled: true to authorize this replacement`, 409);
    if (current.conflicts.some((item) => item.key === 'th_schedule' && (!item.path.length || item.path[0] === date))) fail(`Resolve the pending schedule conflict on ${date} in the app first`, 409);
    schedule[date] = title;
  }
  return {
    updates: Object.fromEntries(Object.entries({ th_templates: templates, th_workouts: workouts, th_schedule: schedule }).filter(([key, value]) => !equal(value, store.read(key) || {}))),
    report: {
      added, scheduled: Object.keys(plan.schedule),
      replacements: Object.entries(plan.schedule).filter(([date, title]) => current.schedule[date] && current.schedule[date] !== title).map(([date, title]) => ({ date, from: current.schedule[date], to: title })),
      warnings,
    },
  };
}

export function createCoachRouter(store) {
  const router = Router();
  router.get('/guide', (req, res) => res.json({ instructions: readFileSync(new URL('./COACH.md', import.meta.url), 'utf8') }));
  router.get('/cli', (req, res) => res.type('text/javascript').sendFile(fileURLToPath(new URL('./trainlog.mjs', import.meta.url))));
  router.get('/schema', (req, res) => res.json(PLAN_SCHEMA));
  router.get('/context', (req, res) => res.json(context(store)));
  router.post('/notes', (req, res, next) => {
    try {
      const body = req.body;
      if (!isMap(body) || Object.keys(body).some((key) => !['baseRevision', 'exerciseTitle', 'notes'].includes(key)) ||
        typeof body.exerciseTitle !== 'string' || typeof body.notes !== 'string' || body.notes.length > 10000) fail('Expected baseRevision, exact exerciseTitle and notes text');
      if (body.baseRevision !== store.revision()) fail('Data changed; read context before updating form notes', 409);
      const updates = {};
      let matched = false;
      for (const key of ['th_templates', 'th_workouts']) {
        updates[key] = Object.fromEntries(Object.entries(store.read(key) || {}).map(([id, item]) => [id, {
          ...item, blocks: item.blocks.map((block) => ({
            ...block, exercises: block.exercises.map((exercise) => {
              if (exercise.title !== body.exerciseTitle) return exercise;
              matched = true;
              return { ...exercise, notes: body.notes };
            }),
          })),
        }]));
      }
      if (!matched) fail('Exercise not found in any workout or template', 404);
      if (store.metadata().conflicts.some((item) => !item.resolvedAt && ['th_workouts', 'th_templates'].includes(item.key))) fail('Resolve pending workout/template conflicts before changing form notes', 409);
      const meta = store.metadata();
      meta.coachEnabled = true;
      store.commit(updates, meta);
      res.json({ ok: true, revision: store.revision() });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      next(error);
    }
  });
  for (const action of ['check', 'apply']) {
    router.post(`/plan/${action}`, (req, res, next) => {
      try {
        const hash = createHash('sha256').update(canonical(req.body)).digest('hex');
        const meta = store.metadata();
        const receipt = meta.receipts.find((item) => item.hash === hash);
        if (action === 'apply' && receipt) {
          if (receipt.revision !== store.revision()) fail('This plan was applied previously but data has since changed; read context again', 409);
          return res.json({ ok: true, replayed: true, revision: receipt.revision });
        }
        const prepared = preparePlan(store, req.body);
        if (action === 'check') return res.json({ valid: true, revision: store.revision(), ...prepared.report });
        meta.coachEnabled = true;
        const nextRevision = createHash('sha256').update(canonical({ ...store.snapshot(), ...prepared.updates })).digest('hex');
        meta.receipts.push({ hash, revision: nextRevision, appliedAt: new Date().toISOString() });
        store.commit(prepared.updates, meta);
        res.json({ ok: true, revision: store.revision(), ...prepared.report });
      } catch (error) {
        if (error.status) return res.status(error.status).json({ valid: false, error: error.message, revision: store.revision() });
        next(error);
      }
    });
  }
  return router;
}
