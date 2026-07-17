/**
 * Shared registry of TrainLog's durable, offline-persisted sections.
 *
 * This is the single source of truth for *what* data the app persists, which
 * sections sync to the NAS, and which are captured in a user backup.  The
 * offline-persistence seam (adapters + `persistence.js`) and the backup layer
 * both read their key lists from here so the definitions never drift apart.
 *
 * Each section is described by:
 *   - `id`           — stable internal identifier (never the localStorage key)
 *   - `key`          — the existing localStorage key it persists to
 *   - `synced`       — whether writes push to / pull from the server
 *   - `backup`       — whether the section is included in an export backup
 *   - `defaultValue` — the fallback shape when nothing is stored yet
 *
 * The recovery **Session** (`th_active`) is durable and synced for crash
 * recovery, but is intentionally excluded from backups — it is an in-progress
 * scratch pad, not something a restore should ever reproduce.
 *
 * @module storage/registry
 */

import {
  LS_WORKOUTS,
  LS_SCHEDULE,
  LS_YOUTUBE_LINKS,
  LS_WORKOUT_LOGS,
  LS_ACTIVE_SESSION,
  LS_TEMPLATES,
} from '../constants';

/**
 * @typedef {Object} Section
 * @property {string}  id           - stable internal identifier
 * @property {string}  key          - localStorage key the section persists to
 * @property {boolean} synced       - participates in server sync
 * @property {boolean} backup       - included in export backups
 * @property {unknown} defaultValue - fallback value when nothing is stored
 */

/** @type {ReadonlyArray<Section>} */
export const SECTIONS = Object.freeze([
  { id: 'templates', key: LS_TEMPLATES, synced: true, backup: true, defaultValue: {} },
  { id: 'workouts', key: LS_WORKOUTS, synced: true, backup: true, defaultValue: {} },
  { id: 'schedule', key: LS_SCHEDULE, synced: true, backup: true, defaultValue: {} },
  { id: 'logs', key: LS_WORKOUT_LOGS, synced: true, backup: true, defaultValue: {} },
  { id: 'youtubeLinks', key: LS_YOUTUBE_LINKS, synced: true, backup: true, defaultValue: {} },
  // Recovery scratch pad: synced for crash recovery, never backed up.
  { id: 'session', key: LS_ACTIVE_SESSION, synced: true, backup: false, defaultValue: null },
].map(Object.freeze));

/** Look a section up by its stable id. */
export function getSection(id) {
  return SECTIONS.find((s) => s.id === id);
}

/** Look a section up by its localStorage key. */
export function getSectionByKey(key) {
  return SECTIONS.find((s) => s.key === key);
}

/** localStorage keys for every synced section (includes the recovery session). */
export function getSyncedKeys() {
  return SECTIONS.filter((s) => s.synced).map((s) => s.key);
}

/** localStorage keys for every backup section (excludes the recovery session). */
export function getBackupKeys() {
  return SECTIONS.filter((s) => s.backup).map((s) => s.key);
}
