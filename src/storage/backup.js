import { readLS } from './index';
import { getBackupKeys } from './registry';
import { writeByKey, coordinateSyncReload } from './authority';

// The sections a full backup must round-trip, sourced from the shared section
// registry. The in-progress active session scratch (LS_ACTIVE_SESSION /
// th_active) is registered with `backup: false`, so it is intentionally excluded.
export const BACKUP_KEYS = getBackupKeys();

/** Shown when a chosen file contains no recognizable TrainLog sections. */
export const NO_SECTIONS_MESSAGE = 'No TrainLog data found in that file';

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

/** A plain (non-array, non-null) object — the shape every backup section holds. */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate a parsed backup object and extract its recognizable sections. A
 * section is *recognized* only when its key is a known backup key and its value
 * is a plain object map — so the excluded recovery Session, unknown keys, and
 * malformed (non-object) sections are all ignored. This runs before any write so
 * an unusable file is rejected atomically, never leaving a partial restore.
 *
 * @param {unknown} data - the parsed contents of a backup file
 * @returns {{ keys: string[] }} the recognized backup keys to restore
 * @throws {Error} NO_SECTIONS_MESSAGE when nothing recognizable is present
 */
export function parseBackup(data) {
  if (!isPlainObject(data)) {
    throw new Error(NO_SECTIONS_MESSAGE);
  }
  const keys = BACKUP_KEYS.filter((key) => isPlainObject(data[key]));
  if (keys.length === 0) {
    throw new Error(NO_SECTIONS_MESSAGE);
  }
  return { keys };
}

/**
 * Restore a backup atomically through the persistence authority.
 *
 * The file is validated first ({@link parseBackup}); if it holds no recognizable
 * sections it is rejected *before any write*. Otherwise every recognized section
 * is persisted through the authority — committing locally and replicating
 * remotely — inside the shared reload-safe coordinator's `mutate` step, so the
 * writes are flushed to the server and `skipSync` is set before the single
 * reload. That prevents a stale startup pull from server-wins-merging over the
 * data we just restored.
 *
 * @param {unknown} data - the parsed contents of a backup file
 * @param {Object} [deps]
 * @param {(key: string, value: unknown) => unknown} [deps.write] - persistence authority write
 * @param {(opts: { mutate: () => void, delayMs?: number }) => Promise<unknown>} [deps.coordinateReload]
 * @param {number} [deps.delayMs=500] - delay before the reload (lets a toast show)
 * @returns {Promise<{ keys: string[] }>} the sections that were restored
 * @throws {Error} NO_SECTIONS_MESSAGE when the backup is unrecognizable
 */
export async function restoreBackup(
  data,
  { write = writeByKey, coordinateReload = coordinateSyncReload, delayMs = 500 } = {}
) {
  const { keys } = parseBackup(data); // rejects before any write when unrecognizable
  await coordinateReload({
    mutate: () => {
      for (const key of keys) {
        write(key, data[key]); // commit locally + queue replication via the authority
      }
    },
    delayMs,
  });
  return { keys };
}
