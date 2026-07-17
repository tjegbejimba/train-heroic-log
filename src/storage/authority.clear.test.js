import { describe, it, expect } from 'vitest';
import { createAuthority } from './authority';
import { createMemoryStorageAdapter } from './adapters/browserStorage';
import { getAllKeys } from './registry';
import {
  LS_WORKOUTS,
  LS_TEMPLATES,
  LS_SCHEDULE,
  LS_WORKOUT_LOGS,
  LS_ACTIVE_SESSION,
  LS_YOUTUBE_LINKS,
} from '../constants';

/**
 * Clear paths for TrainLog data run through the persistence authority so a
 * "clear" removes each durable section locally AND replicates the deletion to
 * the server through the shared push path — the same seam writes use. These
 * tests exercise that boundary against an in-memory storage adapter and a fake
 * transport that mirrors a server store, so we can prove a subsequent pull can
 * never resurrect cleared data.
 */
function setup(initial = {}) {
  const storageInitial = {};
  const server = {};
  for (const [key, value] of Object.entries(initial)) {
    storageInitial[key] = JSON.stringify(value);
    server[key] = value;
  }
  const storage = createMemoryStorageAdapter({ initial: storageInitial });
  const pushes = [];
  const transport = {
    async pullAll() {
      // Server wins over local for keys the server holds.
      const sections = {};
      for (const [key, value] of Object.entries(server)) {
        if (value !== null && value !== undefined) sections[key] = value;
      }
      return { ok: true, sections };
    },
    async push(key, data) {
      pushes.push({ key, data, committed: storage.getItem(key) });
      server[key] = data; // null deletion mirrors the real server contract
      return { ok: true, status: 200 };
    },
    async pushAll() {
      return { ok: false, status: null };
    },
  };
  const authority = createAuthority({ storage, transport });
  return { storage, transport, pushes, server, authority };
}

describe('persistence authority — clearByKeys (selective)', () => {
  it('removes only the chosen sections locally and pushes their deletions remotely', async () => {
    const { authority, storage, server, pushes } = setup({
      [LS_WORKOUTS]: { 'Bench Press': {} },
      [LS_TEMPLATES]: { t1: { id: 't1' } },
      [LS_SCHEDULE]: { '2026-07-17': 'Upper A' },
    });

    await authority.clearByKeys([LS_WORKOUTS, LS_SCHEDULE]);

    // Chosen sections gone locally...
    expect(storage.getItem(LS_WORKOUTS)).toBeNull();
    expect(storage.getItem(LS_SCHEDULE)).toBeNull();
    // ...and remotely (null deletion pushed through the shared path).
    expect(server[LS_WORKOUTS]).toBeNull();
    expect(server[LS_SCHEDULE]).toBeNull();
    const clearedKeys = pushes.map((p) => p.key).sort();
    expect(clearedKeys).toEqual([LS_WORKOUTS, LS_SCHEDULE].sort());
    pushes.forEach((p) => expect(p.data).toBeNull());

    // Untouched section survives locally and on the server.
    expect(storage.getItem(LS_TEMPLATES)).toBe('{"t1":{"id":"t1"}}');
    expect(server[LS_TEMPLATES]).toEqual({ t1: { id: 't1' } });
  });

  it('commits the local deletion before the network push fires', async () => {
    const { authority, pushes } = setup({ [LS_WORKOUTS]: { a: 1 } });
    await authority.clearByKeys([LS_WORKOUTS]);
    expect(pushes).toHaveLength(1);
    // At the moment the push fired the local value was already removed.
    expect(pushes[0].committed).toBeNull();
  });
});

describe('persistence authority — clearByKeys (full)', () => {
  it('removes every durable section locally and remotely when given no keys', async () => {
    const seed = {
      [LS_WORKOUTS]: { w: 1 },
      [LS_TEMPLATES]: { t: 1 },
      [LS_SCHEDULE]: { s: 1 },
      [LS_WORKOUT_LOGS]: { l: 1 },
      [LS_YOUTUBE_LINKS]: { y: 1 },
      [LS_ACTIVE_SESSION]: { logKey: 'x' },
    };
    const { authority, storage, server, pushes } = setup(seed);

    await authority.clearByKeys();

    for (const key of getAllKeys()) {
      expect(storage.getItem(key)).toBeNull();
      expect(server[key]).toBeNull();
    }
    expect(pushes.map((p) => p.key).sort()).toEqual(getAllKeys().sort());
  });

  it('treats an empty key list as a full clear', async () => {
    const { authority, storage } = setup({ [LS_WORKOUTS]: { w: 1 } });
    await authority.clearByKeys([]);
    for (const key of getAllKeys()) {
      expect(storage.getItem(key)).toBeNull();
    }
  });
});

describe('persistence authority — clear then reload (no resurrection)', () => {
  it('a pull after a full clear cannot bring cleared data back', async () => {
    const seed = {
      [LS_WORKOUTS]: { w: 1 },
      [LS_TEMPLATES]: { t: 1 },
    };
    const { authority, storage, transport } = setup(seed);

    await authority.clearByKeys();

    // Simulate the post-clear reload path pulling from the server. Because the
    // clear pushed null deletions, the server holds nothing to merge back.
    const { sections } = await transport.pullAll();
    expect(sections[LS_WORKOUTS]).toBeUndefined();
    expect(sections[LS_TEMPLATES]).toBeUndefined();

    // Reads through the authority return section defaults, not the old data.
    expect(authority.readByKey(LS_WORKOUTS)).toEqual({});
    expect(authority.readByKey(LS_TEMPLATES)).toEqual({});
    expect(storage.getItem(LS_WORKOUTS)).toBeNull();
  });

  it('a selective clear leaves untouched sections available to a later pull', async () => {
    const { authority, transport } = setup({
      [LS_WORKOUTS]: { w: 1 },
      [LS_TEMPLATES]: { t: 1 },
    });

    await authority.clearByKeys([LS_WORKOUTS]);

    const { sections } = await transport.pullAll();
    expect(sections[LS_WORKOUTS]).toBeUndefined();
    expect(sections[LS_TEMPLATES]).toEqual({ t: 1 });
  });
});
