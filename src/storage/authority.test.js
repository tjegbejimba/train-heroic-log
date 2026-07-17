import { describe, it, expect } from 'vitest';
import { createAuthority } from './authority';
import { createMemoryStorageAdapter } from './adapters/browserStorage';
import {
  LS_WORKOUTS,
  LS_TEMPLATES,
  LS_SCHEDULE,
  LS_WORKOUT_LOGS,
  LS_ACTIVE_SESSION,
  LS_YOUTUBE_LINKS,
} from '../constants';

function setup(opts = {}) {
  const storage = createMemoryStorageAdapter(opts.storage);
  const pushes = [];
  const transport = {
    async pullAll() {
      return { ok: false, sections: {} };
    },
    async push(key, data) {
      // Capture what storage held at the moment the push fired, so tests can
      // assert the local commit already happened before network work started.
      pushes.push({ key, data, committed: storage.getItem(key) });
      return { ok: true, status: 200 };
    },
    async pushAll() {
      return { ok: false, status: null };
    },
  };
  const authority = createAuthority({ storage, transport });
  return { storage, transport, pushes, authority };
}

describe('persistence authority — key-based reads', () => {
  it('returns the section default for an empty synced key', () => {
    const { authority } = setup();
    expect(authority.readByKey(LS_WORKOUTS)).toEqual({});
  });

  it('returns null default for the recovery session key', () => {
    const { authority } = setup();
    expect(authority.readByKey(LS_ACTIVE_SESSION)).toBeNull();
  });

  it('parses and returns stored JSON for a known key', () => {
    const { authority } = setup({ storage: { initial: { [LS_TEMPLATES]: '{"t1":{"id":"t1"}}' } } });
    expect(authority.readByKey(LS_TEMPLATES)).toEqual({ t1: { id: 't1' } });
  });

  it('recovers from malformed stored data by returning the section default', () => {
    const { authority } = setup({ storage: { initial: { [LS_SCHEDULE]: '{not json' } } });
    expect(authority.readByKey(LS_SCHEDULE)).toEqual({});
  });

  it('falls back to the caller default for an unregistered key', () => {
    const { authority } = setup();
    expect(authority.readByKey('th_unknown', { fallback: true })).toEqual({ fallback: true });
  });
});

describe('persistence authority — key-based writes', () => {
  it('commits to storage before any network work and preserves the JSON shape', async () => {
    const { authority, storage, pushes } = setup();
    const value = { a: 1 };
    const res = await authority.writeByKey(LS_WORKOUTS, value);
    expect(res.ok).toBe(true);
    // The stored JSON shape is exactly what a legacy writeLS would have stored.
    expect(storage.getItem(LS_WORKOUTS)).toBe('{"a":1}');
    // Replication fired for this key, and the local commit was already durable
    // (committed === the serialized value) when the push started.
    expect(pushes).toHaveLength(1);
    expect(pushes[0].key).toBe(LS_WORKOUTS);
    expect(pushes[0].data).toEqual(value);
    expect(pushes[0].committed).toBe('{"a":1}');
  });

  it('routes synced writes through the shared push path for background replication', async () => {
    const { authority, pushes } = setup();
    await authority.writeByKey(LS_WORKOUT_LOGS, { 'd::W': { completedAt: 'x' } });
    expect(pushes).toHaveLength(1);
    expect(pushes[0].key).toBe(LS_WORKOUT_LOGS);
  });

  it('returns a structured quota failure and leaves storage untouched', async () => {
    const { authority, storage } = setup({ storage: { quotaBytes: 4 } });
    const res = await authority.writeByKey(LS_YOUTUBE_LINKS, { 'Bench Press': 'https://example.com/x' });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('quota');
    expect(storage.getItem(LS_YOUTUBE_LINKS)).toBeNull();
  });
});

describe('persistence authority — key-based removes', () => {
  it('removes locally then pushes a null deletion for synced sections', async () => {
    const { authority, storage, pushes } = setup({
      storage: { initial: { [LS_ACTIVE_SESSION]: '{"logKey":"x"}' } },
    });
    const res = await authority.removeByKey(LS_ACTIVE_SESSION);
    expect(res.ok).toBe(true);
    expect(storage.getItem(LS_ACTIVE_SESSION)).toBeNull();
    expect(pushes).toHaveLength(1);
    expect(pushes[0].key).toBe(LS_ACTIVE_SESSION);
    expect(pushes[0].data).toBeNull();
  });
});
