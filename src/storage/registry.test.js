import { describe, it, expect } from 'vitest';
import {
  SECTIONS,
  getSection,
  getSectionByKey,
  getSyncedKeys,
  getBackupKeys,
} from './registry';
import {
  LS_WORKOUTS,
  LS_SCHEDULE,
  LS_YOUTUBE_LINKS,
  LS_WORKOUT_LOGS,
  LS_ACTIVE_SESSION,
  LS_TEMPLATES,
} from '../constants';

describe('persistence registry', () => {
  it('defines exactly the six durable sections by stable id', () => {
    const ids = SECTIONS.map((s) => s.id).sort();
    expect(ids).toEqual(
      ['logs', 'schedule', 'session', 'templates', 'workouts', 'youtubeLinks'].sort()
    );
  });

  it('maps each section to its existing persisted localStorage key', () => {
    const byId = Object.fromEntries(SECTIONS.map((s) => [s.id, s.key]));
    expect(byId.templates).toBe(LS_TEMPLATES);
    expect(byId.workouts).toBe(LS_WORKOUTS);
    expect(byId.schedule).toBe(LS_SCHEDULE);
    expect(byId.logs).toBe(LS_WORKOUT_LOGS);
    expect(byId.youtubeLinks).toBe(LS_YOUTUBE_LINKS);
    expect(byId.session).toBe(LS_ACTIVE_SESSION);
  });

  it('marks every durable section as synced', () => {
    for (const section of SECTIONS) {
      expect(section.synced).toBe(true);
    }
  });

  it('excludes only the recovery session from backups', () => {
    const notBackedUp = SECTIONS.filter((s) => !s.backup).map((s) => s.id);
    expect(notBackedUp).toEqual(['session']);
  });

  it('backup keys are the five durable sections, never the active session', () => {
    const keys = getBackupKeys();
    expect(keys.sort()).toEqual(
      [LS_WORKOUTS, LS_SCHEDULE, LS_YOUTUBE_LINKS, LS_WORKOUT_LOGS, LS_TEMPLATES].sort()
    );
    expect(keys).not.toContain(LS_ACTIVE_SESSION);
  });

  it('synced keys cover all six sections including the session for crash recovery', () => {
    const keys = getSyncedKeys();
    expect(keys.sort()).toEqual(
      [
        LS_WORKOUTS,
        LS_SCHEDULE,
        LS_YOUTUBE_LINKS,
        LS_WORKOUT_LOGS,
        LS_TEMPLATES,
        LS_ACTIVE_SESSION,
      ].sort()
    );
  });

  it('looks sections up by id and by key', () => {
    expect(getSection('templates').key).toBe(LS_TEMPLATES);
    expect(getSectionByKey(LS_TEMPLATES).id).toBe('templates');
    expect(getSection('nope')).toBeUndefined();
    expect(getSectionByKey('th_unknown')).toBeUndefined();
  });

  it('gives every backup section an empty-object default shape', () => {
    for (const section of SECTIONS.filter((s) => s.backup)) {
      expect(section.defaultValue).toEqual({});
    }
  });

  it('defaults the recovery session to null (no in-progress workout)', () => {
    expect(getSection('session').defaultValue).toBeNull();
  });
});
