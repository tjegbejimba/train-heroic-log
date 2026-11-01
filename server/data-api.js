import { Router } from 'express';
import { VALID_KEYS } from './data-utils.js';
import { applyProposal, equal, isMap, proposal, valueAt } from './sync-protocol.js';
import { createCoachRouter } from './coach.js';

export function dataApiErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON request' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  console.error('Data API failed:', error);
  res.status(503).json({ error: 'Persistence unavailable; no success was confirmed. Retry after recovery.' });
}

export function createDataRouter(store) {
  const router = Router();
  router.use((req, res, next) => {
    try { store.recover(); next(); } catch (error) { next(error); }
  });
  router.get('/data', (req, res) => {
    res.json(Object.fromEntries(VALID_KEYS.map((key) => [key, store.entry(key)])));
  });
  router.get('/data/:key', (req, res) => {
    if (!VALID_KEYS.includes(req.params.key)) return res.status(400).json({ error: 'Invalid key' });
    res.json({ key: req.params.key, ...store.entry(req.params.key) });
  });
  function requireBaseline(req, res, next) {
    if (store.metadata().coachEnabled && !Object.hasOwn(req.body || {}, 'base')) {
      return res.status(428).json({ error: 'Refresh TrainLog to upgrade sync before writing coach-managed data' });
    }
    next();
  }
  function writeSection(req, res) {
    const { key } = req.params;
    if (!VALID_KEYS.includes(key)) return res.status(400).json({ error: 'Invalid key' });
    if (!Object.hasOwn(req.body || {}, 'data')) return res.status(400).json({ error: 'data is required' });
    const conflicts = store.sync({ [key]: req.body.data }, { [key]: req.body.base ?? null }, req.body.baseKnown === false ? [key] : []);
    res.json({ key, ok: true, ...store.entry(key), conflicts });
  }
  router.put('/data/:key', requireBaseline, writeSection);
  router.post('/data/:key', requireBaseline, writeSection);
  router.put('/data', (req, res) => {
    const protectedRequest = Object.hasOwn(req.body || {}, 'updates');
    if (store.metadata().coachEnabled && !protectedRequest) {
      return res.status(428).json({ error: 'Refresh TrainLog to upgrade sync before bulk writes' });
    }
    const updates = protectedRequest ? req.body.updates : req.body;
    const bases = protectedRequest ? req.body.bases : {};
    if (!isMap(updates) || !isMap(bases) || Object.keys(updates).some((key) => !VALID_KEYS.includes(key))) {
      return res.status(400).json({ error: 'Expected updates and bases containing valid data sections' });
    }
    const unknownBases = req.body.unknownBases || [];
    if (!Array.isArray(unknownBases) || unknownBases.some((key) => !VALID_KEYS.includes(key))) return res.status(400).json({ error: 'Invalid unknownBases list' });
    const conflicts = store.sync(updates, bases, unknownBases);
    res.json({ ok: true, data: Object.fromEntries(VALID_KEYS.map((key) => [key, store.entry(key)])), conflicts });
  });
  router.delete('/data/:key', (req, res) => {
    if (!VALID_KEYS.includes(req.params.key)) return res.status(400).json({ error: 'Invalid key' });
    if (store.metadata().coachEnabled) return res.status(428).json({ error: 'Use a baseline-aware PUT with data: null' });
    store.commit({ [req.params.key]: null });
    res.json({ ok: true });
  });
  router.get('/sync/conflicts', (req, res) => {
    res.json({
      revision: store.revision(),
      conflicts: store.metadata().conflicts.filter((conflict) => req.query.resolved === '1' || !conflict.resolvedAt),
    });
  });
  router.post('/sync/conflicts/:id/resolve', (req, res) => {
    const { choice, revision } = req.body || {};
    if (!['local', 'remote'].includes(choice)) return res.status(400).json({ error: 'choice must be local or remote' });
    if (revision !== store.revision()) return res.status(409).json({ error: 'Data changed; refresh the conflict before resolving it' });
    const meta = store.metadata();
    const conflict = meta.conflicts.find((item) => item.id === req.params.id && !item.resolvedAt);
    if (!conflict) return res.status(404).json({ error: 'Pending conflict not found' });
    const current = store.read(conflict.key);
    if (!equal(proposal(valueAt(current, conflict.path)), conflict.remote)) {
      return res.status(409).json({ error: 'This value changed again; inspect the latest data before resolving' });
    }
    const updated = applyProposal(current, conflict.path, conflict[choice]);
    if (choice === 'local' && ['th_schedule', 'th_workouts'].includes(conflict.key)) {
      const schedule = conflict.key === 'th_schedule' ? updated : store.read('th_schedule');
      const workouts = (conflict.key === 'th_workouts' ? updated : store.read('th_workouts')) || {};
      const missing = Object.values(schedule || {}).filter((title) => !Object.hasOwn(workouts, title));
      if (missing.length) return res.status(409).json({ error: `This choice references a missing workout: ${[...new Set(missing)].join(', ')}. Resolve workout proposals or adjust the schedule first.` });
    }
    conflict.resolvedAt = new Date().toISOString();
    conflict.choice = choice;
    store.commit({ [conflict.key]: updated }, meta);
    res.json({ ok: true, revision: store.revision() });
  });
  router.use('/coach', createCoachRouter(store));
  router.use(dataApiErrorHandler);
  return router;
}
