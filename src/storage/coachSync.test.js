import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDataStore } from '../../server/data-store.js';
import { createDataRouter } from '../../server/data-api.js';

const realFetch = globalThis.fetch;
let server;
let dir;
let url;
let storage;
beforeEach(async () => {
  vi.resetModules();
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  });
  vi.stubGlobal('window', { addEventListener: vi.fn(), dispatchEvent: vi.fn() });
  vi.stubGlobal('document', { addEventListener: vi.fn() });
  vi.stubGlobal('CustomEvent', class { constructor(type, options) { this.type = type; this.detail = options?.detail; } });
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trainlog-sync-test-'));
  fs.writeFileSync(path.join(dir, 'th_schedule.json'), JSON.stringify({ '2099-11-03': 'Upper A' }));
  fs.writeFileSync(path.join(dir, 'sync_metadata.json'), JSON.stringify({ coachEnabled: true, conflicts: [], receipts: [] }));
  const app = express();
  app.use(express.json());
  app.use('/api', createDataRouter(createDataStore(dir)));
  server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  url = `http://127.0.0.1:${server.address().port}`;
  vi.stubGlobal('fetch', (input, options) => realFetch(new URL(input, url), options));
});
afterEach(async () => {
  await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  fs.rmSync(dir, { recursive: true });
  vi.unstubAllGlobals();
});
const remoteChange = async (data, base) => {
  const response = await realFetch(`${url}/api/data/th_schedule`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, base }),
  });
  return response.json();
};

it('preserves offline app edits and server additions during pull, and records overlapping proposals', async () => {
  const { pullFromServer } = await import('./sync.js');
  await pullFromServer();
  const base = { '2099-11-03': 'Upper A' };
  localStorage.setItem('th_schedule', JSON.stringify({ ...base, '2099-11-04': 'My Lower' }));
  await remoteChange({ '2099-11-03': 'Coach Upper', '2099-11-05': 'Coach Lower' }, base);
  const result = await pullFromServer();
  expect(result.ok).toBe(true);
  expect(JSON.parse(localStorage.getItem('th_schedule'))).toEqual({
    '2099-11-03': 'Coach Upper', '2099-11-04': 'My Lower', '2099-11-05': 'Coach Lower',
  });
  const serverData = await realFetch(`${url}/api/data/th_schedule`).then((res) => res.json());
  expect(serverData.data['2099-11-04']).toBe('My Lower');
  localStorage.setItem('th_schedule', JSON.stringify({ ...serverData.data, '2099-11-03': 'My Upper' }));
  await remoteChange({ ...serverData.data, '2099-11-03': 'Coach Upper v2' }, serverData.data);
  await pullFromServer();
  const pending = await realFetch(`${url}/api/sync/conflicts`).then((res) => res.json());
  expect(pending.conflicts).toHaveLength(1);
  expect(pending.conflicts[0].local.value).toBe('My Upper');
});

it('sends the original baseline on background flushes so successive stale app saves cannot delete coach additions', async () => {
  const { pullFromServer, pushToServer, flushPendingPushes } = await import('./sync.js');
  await pullFromServer();
  const base = { '2099-11-03': 'Upper A' };
  await remoteChange({ ...base, '2099-11-04': 'Coach Lower' }, base);
  let local = { ...base, '2099-11-05': 'My Upper' };
  localStorage.setItem('th_schedule', JSON.stringify(local));
  pushToServer('th_schedule', local);
  await flushPendingPushes();
  local = { ...local, '2099-11-06': 'My Lower' };
  localStorage.setItem('th_schedule', JSON.stringify(local));
  pushToServer('th_schedule', local);
  await flushPendingPushes();
  const remote = await realFetch(`${url}/api/data/th_schedule`).then((res) => res.json());
  expect(remote.data).toEqual({ ...local, '2099-11-04': 'Coach Lower' });
  await pullFromServer();
  expect(JSON.parse(localStorage.getItem('th_schedule'))).toEqual(remote.data);
});

it('preserves both complete proposals when upgrading a device that has edits but no synchronized baseline', async () => {
  localStorage.setItem('th_schedule', JSON.stringify({ '2099-11-04': 'My offline workout' }));
  const { pullFromServer } = await import('./sync.js');
  await pullFromServer();
  const pending = await realFetch(`${url}/api/sync/conflicts`).then((res) => res.json());
  expect(pending.conflicts).toHaveLength(1);
  expect(pending.conflicts[0]).toMatchObject({
    key: 'th_schedule', path: [], reason: 'baseline-unavailable',
    local: { value: { '2099-11-04': 'My offline workout' } },
    remote: { value: { '2099-11-03': 'Upper A' } },
  });
});

it('notifies mounted views when a legacy server response updates local data without a reload', async () => {
  global.fetch = vi.fn(async (input, options) => {
    const response = await realFetch(`${url}${input}`, options);
    if (input === '/api/data' && !options?.method) {
      const entries = await response.json();
      for (const entry of Object.values(entries)) delete entry.syncVersion;
      return Response.json(entries);
    }
    return response;
  });
  const { pullFromServer } = await import('./sync.js');
  expect((await pullFromServer()).changed).toBe(true);
  expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
    type: 'sync-applied', detail: { keys: expect.arrayContaining(['th_schedule']) },
  }));
});
