import { describe, it, expect, beforeEach, vi } from 'vitest';

// buildBackup reads through the storage layer; mock it with a plain store so the
// test is deterministic and independent of any localStorage polyfill.
vi.mock('../storage/index', () => {
  const store = {};
  return {
    readLS: (key, fallback) => (key in store ? store[key] : fallback),
    __store: store,
  };
});

import {
  buildBackup,
  BACKUP_KEYS,
  parseBackup,
  restoreBackup,
  NO_SECTIONS_MESSAGE,
} from './backup';
import { __store as store } from '../storage/index';
import {
  LS_WORKOUTS,
  LS_SCHEDULE,
  LS_YOUTUBE_LINKS,
  LS_WORKOUT_LOGS,
  LS_TEMPLATES,
  LS_ACTIVE_SESSION,
} from '../constants';

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
});

describe('buildBackup', () => {
  it('always includes all five required sections, even when storage is empty', () => {
    const backup = buildBackup();
    expect(Object.keys(backup).sort()).toEqual(
      [LS_WORKOUTS, LS_SCHEDULE, LS_YOUTUBE_LINKS, LS_WORKOUT_LOGS, LS_TEMPLATES].sort()
    );
    // Empty sections are present as {} (not missing) so a restore reproduces them.
    for (const key of BACKUP_KEYS) {
      expect(backup[key]).toEqual({});
    }
  });

  it('captures existing data while defaulting only the empty sections to {}', () => {
    store[LS_WORKOUTS] = { 'Upper A': { title: 'Upper A' } };
    store[LS_SCHEDULE] = { '2026-07-06': 'Upper A' };

    const backup = buildBackup();

    expect(backup[LS_WORKOUTS]).toEqual({ 'Upper A': { title: 'Upper A' } });
    expect(backup[LS_SCHEDULE]).toEqual({ '2026-07-06': 'Upper A' });
    // Sections with no data are still present as {} so restore clears stale data.
    expect(backup[LS_WORKOUT_LOGS]).toEqual({});
    expect(backup[LS_YOUTUBE_LINKS]).toEqual({});
    expect(backup[LS_TEMPLATES]).toEqual({});
  });

  it('never includes the in-progress active-session scratch key', () => {
    store[LS_ACTIVE_SESSION] = { inProgress: true };
    const backup = buildBackup();
    expect(BACKUP_KEYS).not.toContain(LS_ACTIVE_SESSION);
    expect(backup).not.toHaveProperty(LS_ACTIVE_SESSION);
  });
});

describe('parseBackup', () => {
  it('rejects a file with no recognizable TrainLog sections before any restore', () => {
    expect(() => parseBackup({ not_a_section: {}, th_settings: {} })).toThrow(
      NO_SECTIONS_MESSAGE
    );
    expect(() => parseBackup(null)).toThrow(NO_SECTIONS_MESSAGE);
    expect(() => parseBackup('nonsense')).toThrow(NO_SECTIONS_MESSAGE);
  });

  it('returns only the recognized backup keys, ignoring the excluded session key', () => {
    const { keys } = parseBackup({
      [LS_TEMPLATES]: {},
      [LS_WORKOUTS]: { 'Upper A': {} },
      [LS_ACTIVE_SESSION]: { inProgress: true }, // durable but never backed up
      bogus: 5,
    });
    expect(keys.sort()).toEqual([LS_TEMPLATES, LS_WORKOUTS].sort());
  });

  it('treats a non-object section value as unrecognized', () => {
    const { keys } = parseBackup({
      [LS_WORKOUT_LOGS]: {},
      [LS_WORKOUTS]: 'oops',
      [LS_SCHEDULE]: null,
    });
    expect(keys).toEqual([LS_WORKOUT_LOGS]);
  });
});

describe('restoreBackup', () => {
  it('rejects an unrecognized backup without persisting anything', async () => {
    const write = vi.fn();
    const coordinateReload = vi.fn();
    await expect(
      restoreBackup({ bogus: {} }, { write, coordinateReload })
    ).rejects.toThrow(NO_SECTIONS_MESSAGE);
    expect(write).not.toHaveBeenCalled();
    expect(coordinateReload).not.toHaveBeenCalled();
  });

  it('persists every recognized section through the authority inside the reload-safe path', async () => {
    const events = [];
    const write = vi.fn((key) => events.push(`write:${key}`));
    const coordinateReload = vi.fn(async ({ mutate }) => {
      events.push('reload:start');
      await mutate();
      events.push('reload:end');
    });
    const data = {
      [LS_TEMPLATES]: { t1: { title: 'PPL' } },
      [LS_WORKOUTS]: { 'Upper A': { title: 'Upper A' } },
      [LS_SCHEDULE]: {},
      [LS_ACTIVE_SESSION]: { inProgress: true },
    };

    const { keys } = await restoreBackup(data, { write, coordinateReload });

    expect(keys.sort()).toEqual([LS_TEMPLATES, LS_WORKOUTS, LS_SCHEDULE].sort());
    expect(write).toHaveBeenCalledWith(LS_TEMPLATES, data[LS_TEMPLATES]);
    expect(write).toHaveBeenCalledWith(LS_WORKOUTS, data[LS_WORKOUTS]);
    expect(write).toHaveBeenCalledWith(LS_SCHEDULE, data[LS_SCHEDULE]);
    // Never persists the excluded recovery session, even when present in the file.
    expect(write).not.toHaveBeenCalledWith(LS_ACTIVE_SESSION, expect.anything());
    // Every persist happens INSIDE the reload-safe coordinator's mutate step.
    expect(coordinateReload).toHaveBeenCalledTimes(1);
    expect(events[0]).toBe('reload:start');
    expect(events[events.length - 1]).toBe('reload:end');
    expect(events).toContain(`write:${LS_TEMPLATES}`);
  });
});
