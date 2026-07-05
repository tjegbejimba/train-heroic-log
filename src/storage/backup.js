import { readLS } from './index';
import {
  LS_WORKOUTS,
  LS_SCHEDULE,
  LS_YOUTUBE_LINKS,
  LS_WORKOUT_LOGS,
  LS_TEMPLATES,
} from '../constants';

// The five sections a full backup must round-trip. The in-progress active
// session scratch (LS_ACTIVE_SESSION / th_active) is intentionally excluded.
export const BACKUP_KEYS = [
  LS_WORKOUTS,
  LS_SCHEDULE,
  LS_YOUTUBE_LINKS,
  LS_WORKOUT_LOGS,
  LS_TEMPLATES,
];

/**
 * Build a complete backup snapshot. Every required section is always present —
 * sections with no data serialize as an empty object `{}` rather than being
 * omitted — so restoring a backup faithfully reproduces the snapshot instead of
 * silently leaving stale sections behind on the target device.
 *
 * @returns {Record<string, unknown>} map of storage key -> parsed data
 */
export function buildBackup() {
  const backup = {};
  for (const key of BACKUP_KEYS) {
    backup[key] = readLS(key, {});
  }
  return backup;
}
