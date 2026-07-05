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

import { buildBackup, BACKUP_KEYS } from './backup';
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
