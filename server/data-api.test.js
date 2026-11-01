import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createDataStore } from './data-store.js';
import { createDataRouter, dataApiErrorHandler } from './data-api.js';

const cleanups = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function startApi(seed = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trainlog-coach-test-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true }));
  for (const [key, value] of Object.entries(seed)) {
    fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(value));
  }
  const store = createDataStore(dir);
  const app = express();
  app.use(express.json());
  app.use('/api', createDataRouter(store));
  app.use('/api', dataApiErrorHandler);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  cleanups.push(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (route, body, method = 'POST') => {
    const response = await fetch(`${url}${route}`, body === undefined ? {} : {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  return { request, dir, url, store };
}

describe('protected data HTTP interface', () => {
  it('reports malformed JSON as invalid input rather than a persistence outage', async () => {
    const { url } = await startApi();
    const response = await fetch(`${url}/coach/plan/apply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('Malformed JSON');
  });

  it('reads existing NAS sections and advertises baseline-aware sync without changing their data', async () => {
    const { request } = await startApi({ th_schedule: { '2026-11-03': 'Upper A' } });
    const result = await request('/data');
    expect(result.status).toBe(200);
    expect(result.body.th_schedule).toMatchObject({
      data: { '2026-11-03': 'Upper A' }, syncVersion: 2,
    });

    expect(result.body.th_logs.data).toBeNull();
  });

  it('merges unrelated offline edits and preserves conflicting date proposals for resolution', async () => {
    const base = { '2026-11-03': 'Upper A', '2026-11-04': 'Lower A' };
    const { request } = await startApi({ th_schedule: base });
    expect((await request('/data/th_schedule', {
      base, data: { ...base, '2026-11-03': 'Upper A v2' },
    }, 'PUT')).status).toBe(200);
    const offline = { ...base, '2026-11-03': 'Rest', '2026-11-05': 'Lower A' };
    const result = await request('/data/th_schedule', { base, data: offline }, 'PUT');
    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({
      '2026-11-03': 'Upper A v2', '2026-11-04': 'Lower A', '2026-11-05': 'Lower A',
    });
    const pending = await request('/sync/conflicts');
    expect(pending.body.conflicts).toHaveLength(1);
    expect(pending.body.conflicts[0]).toMatchObject({
      key: 'th_schedule', path: ['2026-11-03'],
      local: { present: true, value: 'Rest' }, remote: { present: true, value: 'Upper A v2' },
    });
  });

  it('resolves a proposal explicitly, keeps the losing proposal recoverable, and detects stale resolution', async () => {
    const { request } = await startApi({
      th_schedule: { '2026-11-03': 'Coach Upper' },
      th_workouts: Object.fromEntries(['Coach Upper', 'My Upper'].map((title) => [title, { title, blocks: [] }])),
    });
    await request('/data/th_schedule', {
      base: { '2026-11-03': 'Old Upper' }, data: { '2026-11-03': 'My Upper' },
    }, 'PUT');
    const pending = (await request('/sync/conflicts')).body;
    const id = pending.conflicts[0].id;
    expect((await request(`/sync/conflicts/${id}/resolve`, { choice: 'local', revision: 'old' })).status).toBe(409);
    expect((await request(`/sync/conflicts/${id}/resolve`, { choice: 'local', revision: pending.revision })).status).toBe(200);
    expect((await request('/data')).body.th_schedule.data).toEqual({ '2026-11-03': 'My Upper' });
    const archive = (await request('/sync/conflicts?resolved=1')).body.conflicts;
    expect(archive[0]).toMatchObject({ choice: 'local', remote: { value: 'Coach Upper' } });
    expect(archive[0].resolvedAt).toBeTruthy();
  });

  it('blocks reads after an interrupted multi-section commit and rolls forward before serving again', async () => {
    const { request, dir } = await startApi();
    const blockedFile = path.join(dir, 'th_workouts.json.tmp');
    fs.mkdirSync(blockedFile);
    const updates = {
      th_templates: { upper: { name: 'Upper' } },
      th_workouts: { Upper: { title: 'Upper' } },
      th_schedule: { '2026-11-03': 'Upper' },
    };
    expect((await request('/data', { updates, bases: {} }, 'PUT')).status).toBe(503);
    expect((await request('/data')).status).toBe(503);
    fs.rmdirSync(blockedFile);
    const recovered = await request('/data');
    expect(recovered.status).toBe(200);
    for (const [key, value] of Object.entries(updates)) expect(recovered.body[key].data).toEqual(value);
  });

  it('allows a conflict to be reviewed again after its server value changes and archives earlier proposals', async () => {
    const { request } = await startApi({
      th_schedule: { '2099-11-03': 'Coach Upper' },
      th_workouts: Object.fromEntries(['Coach Upper', 'My Upper', 'Latest Upper'].map((title) => [title, { title, blocks: [] }])),
    });
    await request('/data/th_schedule', {
      base: { '2099-11-03': 'Old Upper' }, data: { '2099-11-03': 'My Upper' },
    }, 'PUT');
    const first = (await request('/sync/conflicts')).body;
    await request('/data/th_schedule', {
      base: { '2099-11-03': 'Coach Upper' }, data: { '2099-11-03': 'Latest Upper' },
    }, 'PUT');
    const refreshed = (await request('/sync/conflicts')).body;
    expect(refreshed.conflicts[0].remote.value).toBe('Latest Upper');
    const id = first.conflicts[0].id;
    expect((await request(`/sync/conflicts/${id}/resolve`, { choice: 'local', revision: first.revision })).status).toBe(409);
    expect((await request(`/sync/conflicts/${id}/resolve`, { choice: 'local', revision: refreshed.revision })).status).toBe(200);
    const archive = (await request('/sync/conflicts?resolved=1')).body.conflicts[0];
    expect(archive.remote.value).toBe('Latest Upper');
    expect(archive.previousRemotes).toContainEqual({ present: true, value: 'Coach Upper' });
  });

  it('represents deletions of map entries named like inherited JavaScript properties accurately', async () => {
    const { request } = await startApi({ th_yt_links: { constructor: 'https://youtu.be/server' } });
    await request('/data/th_yt_links', {
      base: { constructor: 'https://youtu.be/old' }, data: {},
    }, 'PUT');
    const pending = (await request('/sync/conflicts')).body;
    expect(pending.conflicts[0].local).toEqual({ present: false, value: null });
    expect((await request(`/sync/conflicts/${pending.conflicts[0].id}/resolve`, { choice: 'local', revision: pending.revision })).status).toBe(200);
    expect((await request('/data/th_yt_links')).body.data).toEqual({});
  });

  it('rejects conflict choices that would leave scheduled workouts unavailable', async () => {
    const upper = { title: 'Upper', notes: 'Coach version', blocks: [] };
    const { request } = await startApi({ th_workouts: { Upper: upper }, th_schedule: { '2099-11-03': 'Upper' } });
    await request('/data/th_schedule', { base: { '2099-11-03': 'Old' }, data: { '2099-11-03': 'Not yet created' } }, 'PUT');
    await request('/data/th_workouts', { base: { Upper: { ...upper, notes: 'Old version' } }, data: {} }, 'PUT');
    const pending = (await request('/sync/conflicts')).body;
    for (const conflict of pending.conflicts) {
      const rejected = await request(`/sync/conflicts/${conflict.id}/resolve`, { choice: 'local', revision: pending.revision });
      expect(rejected.status).toBe(409);
      expect(rejected.body.error).toContain('missing workout');
    }
    expect((await request('/coach/context')).body.workouts.Upper).toEqual(upper);
    expect((await request('/sync/conflicts')).body.conflicts).toHaveLength(2);
  });
});

describe('coach HTTP interface', () => {
  it('provides exercises from unscheduled templates and completed history with distinct note fields', async () => {
    const template = { id: 'upper', name: 'Upper', blocks: [{ exercises: [{
      title: 'Bench Press', notes: 'Keep wrists stacked', workoutNotes: 'Pause each rep', sets: [{ reps: 8, weight: 60, unit: 'kg' }],
    }] }] };
    const completed = { completedAt: '2026-10-30T10:00:00Z', exercises: { 'Bench Press': [{ completed: true, actualReps: 8, actualWeight: 60, unit: 'kg' }] } };
    const { request } = await startApi({
      th_templates: { upper: template },
      th_logs: { '2026-10-30::Upper': completed, '2026-11-01::Upper': { exercises: {} } },
      th_yt_links: { 'Bench Press': 'https://youtu.be/example' },
    });
    const result = await request('/coach/context');
    expect(result.status).toBe(200);
    expect(result.body.timeZone).toBe('America/Los_Angeles');
    expect(result.body.revision).toMatch(/^[a-f0-9]{64}$/);
    expect(result.body.history).toEqual({ '2026-10-30::Upper': completed });
    expect(result.body.exercises[0]).toMatchObject({
      title: 'Bench Press', formNotes: ['Keep wrists stacked'], youtubeUrl: 'https://youtu.be/example',
    });
    expect(result.body.templates.upper.blocks[0].exercises[0].workoutNotes).toBe('Pause each rep');
  });

  it('checks without writes and applies versioned plans idempotently without touching history', async () => {
    const history = { '2026-10-30::Upper': { completedAt: '2026-10-30T10:00:00Z', exercises: {} } };
    const { request } = await startApi({ th_logs: history });
    const before = (await request('/coach/context')).body;
    const plan = {
      baseRevision: before.revision, templates: [{ name: 'Upper A - Week 2', blocks: [{ exercises: [{
        title: 'Bench Press', workoutNotes: 'Pause each rep', sets: [{ reps: 8, weight: 60, unit: 'kg' }],
      }] }] }], schedule: { '2099-11-03': 'Upper A - Week 2' },
    };
    const checked = await request('/coach/plan/check', plan);
    expect(checked.status).toBe(200);
    expect(checked.body.valid).toBe(true);
    expect((await request('/coach/context')).body.revision).toBe(before.revision);
    expect((await request('/coach/plan/apply', plan)).status).toBe(200);
    const applied = (await request('/coach/context')).body;
    expect(applied.schedule['2099-11-03']).toBe('Upper A - Week 2');
    expect(applied.workouts['Upper A - Week 2'].blocks[0].exercises[0].sets[0]).toMatchObject({ reps: 8, weight: 60, unit: 'kg' });
    expect(applied.history).toEqual(history);
    expect((await request('/coach/plan/apply', plan)).body.replayed).toBe(true);
    expect(Object.keys((await request('/coach/context')).body.templates)).toHaveLength(1);
    expect((await request('/data/th_schedule', { data: {} }, 'PUT')).status).toBe(428);
  });

  it('inherits the first set units consistently for later sets without explicit units', async () => {
    const { request } = await startApi();
    const plan = {
      baseRevision: (await request('/coach/context')).body.revision,
      templates: [{ name: 'Timed progression', blocks: [{ exercises: [{
        title: 'Loaded carry', sets: [{ reps: 30, weight: 20, unit: 'kg', repsUnit: 'sec' }, { reps: 30, weight: 20 }],
      }] }] }], schedule: {},
    };
    expect((await request('/coach/plan/apply', plan)).status).toBe(200);
    const exercise = (await request('/coach/context')).body.workouts['Timed progression'].blocks[0].exercises[0];
    expect(exercise.sets[1]).toMatchObject({ unit: 'kg', repsUnit: 'sec' });
  });

  it('blocks coach calendar writes until a whole-calendar upgrade conflict is resolved', async () => {
    const { request } = await startApi({
      th_workouts: { Upper: { title: 'Upper', blocks: [] } }, th_schedule: { '2099-11-03': 'Upper' },
    });
    await request('/data/th_schedule', { base: null, baseKnown: false, data: { '2099-11-04': 'Upper' } }, 'PUT');
    const current = (await request('/coach/context')).body;
    expect(current.conflicts[0].path).toEqual([]);
    const result = await request('/coach/plan/apply', { baseRevision: current.revision, templates: [], schedule: { '2099-11-05': 'Upper' } });
    expect(result.status).toBe(409);
    expect(result.body.error).toContain('pending schedule conflict');
  });

  it('warns instead of changing existing global cues through plan creation, including blank cues', async () => {
    for (const notes of ['', 'Keep wrists stacked']) {
      const blocks = [{ exercises: [{ title: 'Bench Press', notes, sets: [{ reps: 8, weight: 60, unit: 'kg' }] }] }];
      const { request } = await startApi({ th_workouts: { Upper: { title: 'Upper', blocks } } });
      const plan = {
        baseRevision: (await request('/coach/context')).body.revision,
        templates: [{ name: 'Upper - Week 2', blocks: [{ exercises: [{ ...blocks[0].exercises[0], notes: 'New global cue' }] }] }],
        schedule: {},
      };
      const applied = await request('/coach/plan/apply', plan);
      expect(applied.status).toBe(200);
      expect(applied.body.warnings).toContain('Form notes for Bench Press were inherited unchanged; use notes set to update global cues.');
      expect((await request('/coach/context')).body.workouts['Upper - Week 2'].blocks[0].exercises[0].notes).toBe(notes);
    }
  });

  it('shares a newly introduced exercise form cue across versions in the same plan', async () => {
    const { request } = await startApi();
    const templates = ['First cue', 'Different cue'].map((notes, index) => ({
      name: `Carry - Version ${index + 1}`,
      blocks: [{ exercises: [{ title: 'Suitcase carry', notes, sets: [{ reps: 30, weight: 20, unit: 'kg', repsUnit: 'sec' }] }] }],
    }));
    const result = await request('/coach/plan/apply', { baseRevision: (await request('/coach/context')).body.revision, templates, schedule: {} });
    expect(result.status).toBe(200);
    expect((await request('/coach/context')).body.exercises[0].formNotes).toEqual(['First cue']);
    expect(result.body.warnings).toContain('Form notes for Suitcase carry were inherited unchanged; use notes set to update global cues.');
  });

  it('rejects malformed prescriptions and calendar dates without any writes', async () => {
    const { request } = await startApi();
    const before = (await request('/coach/context')).body;
    const valid = {
      baseRevision: before.revision, templates: [{ name: 'Upper', blocks: [{ exercises: [{
        title: 'Bench Press', sets: [{ reps: 8, weight: 60, unit: 'kg' }],
      }] }] }], schedule: { '2099-11-03': 'Upper' },
    };
    const cases = [
      { ...valid, th_logs: {} },
      { ...valid, schedule: { '2099-02-30': 'Upper' } },
      { ...valid, schedule: { '2000-01-01': 'Upper' } },
      { ...valid, templates: [{ name: '__proto__', blocks: valid.templates[0].blocks }] },
      { ...valid, templates: [{ name: 'Upper', blocks: [{ exercises: [{ title: 'Bench Press', sets: [{ reps: -8, weight: 60, unit: 'kg' }] }] }] }] },
      { ...valid, templates: [{ name: 'Upper', blocks: [{ exercises: [{ title: 'Bench Press', sets: [{ reps: 8, weight: 60, unit: 'lbs' }] }] }] }] },
      { ...valid, templates: [{ name: 'Upper', blocks: [{ exercises: [{ title: 'Bench Press', sets: null }] }] }] },
    ];
    for (const plan of cases) {
      const result = await request('/coach/plan/apply', plan);
      expect(result.status, JSON.stringify(plan)).toBe(400);
      expect(result.body.error).toBeTruthy();
      expect((await request('/coach/context')).body.revision).toBe(before.revision);
    }
  });

  it('never overwrites an existing prescription, and protects started or completed dates', async () => {
    const { request } = await startApi();
    const template = { name: 'Upper A', blocks: [{ exercises: [{ title: 'Bench Press', sets: [{ reps: 8, weight: 60, unit: 'kg' }] }] }] };
    const plan = { baseRevision: (await request('/coach/context')).body.revision, templates: [template], schedule: {} };
    await request('/coach/plan/apply', plan);
    let current = (await request('/coach/context')).body;
    const identical = { ...plan, baseRevision: current.revision };
    expect((await request('/coach/plan/apply', identical)).status).toBe(200);
    current = (await request('/coach/context')).body;
    const changed = { ...identical, baseRevision: current.revision, templates: [{ ...template, blocks: [{ exercises: [{ title: 'Bench Press', sets: [{ reps: 6, weight: 65, unit: 'kg' }] }] }] }] };
    expect((await request('/coach/plan/apply', changed)).status).toBe(409);
    await request('/data', { updates: {
      th_active: { logKey: '2099-11-03::Upper A', startedAt: '2099-11-03T10:00:00Z' },
      th_logs: { '2099-11-04::Upper A': { completedAt: '2099-11-04T10:00:00Z', exercises: {} } },
    }, bases: {} }, 'PUT');
    current = (await request('/coach/context')).body;
    for (const date of ['2099-11-03', '2099-11-04']) {
      const protectedPlan = { baseRevision: current.revision, templates: [], schedule: { [date]: 'Upper A' }, replaceScheduled: true };
      expect((await request('/coach/plan/apply', protectedPlan)).status).toBe(409);
    }
    expect((await request('/coach/context')).body.revision).toBe(current.revision);
  });

  it('updates global form notes explicitly across versions while preserving workout instructions and completed logs', async () => {
    const exercise = { title: 'Bench Press', notes: 'Old form cue', workoutNotes: 'Pause', sets: [{ reps: 8, weight: 60, unit: 'kg' }] };
    const template = { id: 'upper', name: 'Upper', blocks: [{ exercises: [exercise] }] };
    const logs = { '2026-10-30::Upper': { completedAt: '2026-10-30T10:00:00Z', exercises: {}, exerciseNotes: { 'Bench Press': 'Felt good' } } };
    const { request } = await startApi({
      th_workouts: { Upper: { title: 'Upper', blocks: template.blocks } },
      th_templates: { upper: template }, th_logs: logs,
    });
    const revision = (await request('/coach/context')).body.revision;
    const update = { baseRevision: revision, exerciseTitle: 'Bench Press', notes: 'Keep wrists stacked' };
    expect((await request('/coach/notes', { ...update, baseRevision: 'old' })).status).toBe(409);
    expect((await request('/coach/notes', update)).status).toBe(200);
    const after = (await request('/coach/context')).body;
    expect(after.exercises[0].formNotes).toEqual(['Keep wrists stacked']);
    expect(after.templates.upper.blocks[0].exercises[0].workoutNotes).toBe('Pause');
    expect(after.history).toEqual(logs);
  });

  it('runs the portable CLI against HTTP and returns machine-readable results or nonzero errors', async () => {
    const { url, dir, request } = await startApi();
    const run = (...args) => promisify(execFile)(process.execPath, [path.resolve('server/trainlog.mjs'), '--url', url, ...args]);
    const { stdout } = await run('context');
    const context = JSON.parse(stdout);
    expect(context.revision).toMatch(/^[a-f0-9]{64}$/);
    const planFile = path.join(dir, 'plan.json');
    fs.writeFileSync(planFile, JSON.stringify({
      baseRevision: context.revision, templates: [{ name: 'Coach Test', blocks: [{ exercises: [{
        title: 'Squat', sets: [{ reps: 5, weight: 100, unit: 'kg' }],
      }] }] }], schedule: { '2099-11-03': 'Coach Test' },
    }));
    expect(JSON.parse((await run('plan', 'check', planFile)).stdout).valid).toBe(true);
    expect(JSON.parse((await run('plan', 'apply', planFile)).stdout).ok).toBe(true);
    fs.writeFileSync(planFile, '{}');
    await expect(run('plan', 'apply', planFile)).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('"error"') });
    expect((await request('/coach/context')).body.schedule['2099-11-03']).toBe('Coach Test');
  });

  it('serves a standalone CLI and discoverable plan schema from the NAS interface', async () => {
    const { url, dir, request } = await startApi();
    const download = await fetch(`${url}/coach/cli`);
    expect(download.status).toBe(200);
    const portable = path.join(dir, 'trainlog.mjs');
    fs.writeFileSync(portable, await download.text());
    const run = (...args) => promisify(execFile)(process.execPath, [portable, '--url', url, ...args]);
    const schema = JSON.parse((await run('schema')).stdout);
    expect(schema.required).toEqual(['baseRevision', 'templates', 'schedule']);
    expect(schema.$defs.set.properties.unit.enum).toContain('kg');
    expect(JSON.parse((await run('context')).stdout).timeZone).toBe('America/Los_Angeles');
    expect((await request('/coach/schema')).body.additionalProperties).toBe(false);
    expect(JSON.parse((await run('guide')).stdout).instructions).toContain('plan check');
  });
});
