import { describe, it, expect } from 'vitest';
import { createPersistence } from './persistence';
import { createMemoryStorageAdapter } from './adapters/browserStorage';
import { createMemoryTransportAdapter } from './adapters/serverTransport';
import {
  LS_WORKOUTS,
  LS_TEMPLATES,
  LS_ACTIVE_SESSION,
  LS_WORKOUT_LOGS,
  LS_SCHEDULE,
  LS_YOUTUBE_LINKS,
} from '../constants';

function setup(opts = {}) {
  const storage = createMemoryStorageAdapter(opts.storage);
  const transport = createMemoryTransportAdapter({ clock: () => 'T', ...opts.transport });
  const persistence = createPersistence({ storage, transport });
  return { storage, transport, persistence };
}

describe('persistence seam — read', () => {
  it('returns the section default when nothing is stored', () => {
    const { persistence } = setup();
    expect(persistence.read('workouts')).toEqual({});
    expect(persistence.read('session')).toBeNull();
  });

  it('parses and returns stored JSON', () => {
    const { persistence } = setup({ storage: { initial: { [LS_WORKOUTS]: '{"Upper A":{}}' } } });
    expect(persistence.read('workouts')).toEqual({ 'Upper A': {} });
  });

  it('recovers from malformed stored data by returning the section default', () => {
    const { persistence } = setup({ storage: { initial: { [LS_WORKOUTS]: '{not valid json' } } });
    expect(persistence.read('workouts')).toEqual({});
  });

  it('recovers malformed session data as null rather than throwing', () => {
    const { persistence } = setup({ storage: { initial: { [LS_ACTIVE_SESSION]: '}{' } } });
    expect(() => persistence.read('session')).not.toThrow();
    expect(persistence.read('session')).toBeNull();
  });

  it('throws a clear error for an unknown section id', () => {
    const { persistence } = setup();
    expect(() => persistence.read('nope')).toThrow(/unknown section/i);
  });
});

describe('persistence seam — write', () => {
  it('serializes and stores the value under the section key', async () => {
    const { persistence, storage } = setup();
    const result = await persistence.write('templates', { t1: { id: 't1' } });
    expect(result.ok).toBe(true);
    expect(storage.getItem(LS_TEMPLATES)).toBe('{"t1":{"id":"t1"}}');
    expect(persistence.read('templates')).toEqual({ t1: { id: 't1' } });
  });

  it('pushes synced sections to the transport', async () => {
    const { persistence, transport } = setup();
    await persistence.write('workouts', { W: 1 });
    const { sections } = await transport.pullAll();
    expect(sections[LS_WORKOUTS]).toEqual({ data: { W: 1 }, updatedAt: 'T' });
  });

  it('reports a quota failure as a structured result without throwing', async () => {
    // Budget too small for even the smallest write.
    const { persistence, storage } = setup({ storage: { quotaBytes: 2 } });
    let result;
    await expect((async () => { result = await persistence.write('logs', { big: 'x'.repeat(50) }); })())
      .resolves.toBeUndefined();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('quota');
    // Nothing persisted, nothing pushed.
    expect(storage.getItem(LS_WORKOUT_LOGS)).toBeNull();
  });

  it('does not push to the transport when the local write fails for quota', async () => {
    const { persistence, transport } = setup({ storage: { quotaBytes: 2 } });
    await persistence.write('logs', { big: 'x'.repeat(50) });
    const { sections } = await transport.pullAll();
    expect(sections[LS_WORKOUT_LOGS]).toBeUndefined();
  });

  it('surfaces an offline transport as ok-local-but-not-synced', async () => {
    const { persistence, storage } = setup({ transport: { online: false } });
    const result = await persistence.write('schedule', { '2026-07-16': 'Upper A' });
    // Local write still succeeds (offline-first); sync just did not land.
    expect(result.ok).toBe(true);
    expect(result.pushed).toBe(false);
    expect(storage.getItem(LS_SCHEDULE)).toBe('{"2026-07-16":"Upper A"}');
  });
});

describe('persistence seam — remove', () => {
  it('clears the key locally and pushes a null deletion to synced sections', async () => {
    const { persistence, storage, transport } = setup({
      storage: { initial: { [LS_YOUTUBE_LINKS]: '{"Squat":"http://x"}' } },
    });
    await persistence.remove('youtubeLinks');
    expect(storage.getItem(LS_YOUTUBE_LINKS)).toBeNull();
    const { sections } = await transport.pullAll();
    expect(sections[LS_YOUTUBE_LINKS]).toEqual({ data: null, updatedAt: 'T' });
  });
});

describe('persistence seam — snapshot & backup', () => {
  it('snapshots every registered section by id', () => {
    const { persistence } = setup({
      storage: { initial: { [LS_WORKOUTS]: '{"W":1}', [LS_ACTIVE_SESSION]: '{"logKey":"k"}' } },
    });
    const snap = persistence.snapshot();
    expect(Object.keys(snap).sort()).toEqual(
      ['logs', 'schedule', 'session', 'templates', 'workouts', 'youtubeLinks'].sort()
    );
    expect(snap.workouts).toEqual({ W: 1 });
    expect(snap.session).toEqual({ logKey: 'k' });
  });

  it('buildBackup includes the five durable sections and excludes the session', () => {
    const { persistence } = setup({
      storage: { initial: { [LS_WORKOUTS]: '{"W":1}', [LS_ACTIVE_SESSION]: '{"logKey":"k"}' } },
    });
    const backup = persistence.buildBackup();
    expect(Object.keys(backup).sort()).toEqual(
      [LS_WORKOUTS, LS_SCHEDULE, LS_YOUTUBE_LINKS, LS_WORKOUT_LOGS, LS_TEMPLATES].sort()
    );
    expect(backup).not.toHaveProperty(LS_ACTIVE_SESSION);
    // Empty sections default to {} so a restore reproduces the snapshot.
    expect(backup[LS_TEMPLATES]).toEqual({});
    expect(backup[LS_WORKOUTS]).toEqual({ W: 1 });
  });
});
