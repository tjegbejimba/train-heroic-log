/**
 * Sync layer: localStorage is primary (offline-first), background sync to NAS API.
 *
 * Flow:
 * 1. All reads/writes go to localStorage immediately (app always works)
 * 2. On writes, queue a background push to the server
 * 3. On startup, pull from server and merge (server wins for data you haven't touched locally)
 */

import { readLS, writeLS, removeLS } from './index';

// API base URL — in production, same origin; in dev, point to backend port
const API_BASE = import.meta.env.VITE_API_URL || '/api';

let syncEnabled = true;
let pendingPushes = new Map(); // key -> timeout ID (debounce)

/**
 * Check if the server is reachable
 */
export async function checkServerHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Pull all data from server and merge into localStorage.
 * For map-shaped data (plain objects), merges entries: local-only keys survive,
 * server wins on same-key conflicts. For other types, server overwrites local.
 *
 * Handles data: null cases using updatedAt to distinguish intent:
 *   - data: null, updatedAt: null  → server has no file yet; push local data up
 *   - data: null, updatedAt: set   → intentional deletion; remove local key
 *
 * Returns { ok, changed } — changed is true if any local data was updated.
 */
export async function pullFromServer() {
  if (!syncEnabled) return { ok: false, changed: false };
  try {
    const res = await fetch(`${API_BASE}/data`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, changed: false };
    const serverData = await res.json();

    let changed = false;
    for (const [key, { data, updatedAt }] of Object.entries(serverData)) {
      // Read the raw stored string once — used for efficient change detection
      // below (avoids re-serializing local and sidesteps key-order false positives)
      const localRaw = localStorage.getItem(key);
      let local = null;
      if (localRaw) {
        try {
          local = JSON.parse(localRaw);
        } catch (e) {
          console.warn(`Ignoring malformed localStorage value for key "${key}" during sync pull`, e);
          local = null;
        }
      }

      if (data === null) {
        if (updatedAt === null) {
          // Server has no file yet — push local data up so offline writes aren't lost
          if (local !== null) {
            pushToServer(key, local);
          }
        } else {
          // Intentional deletion — remove local key if present
          if (local !== null) {
            removeLS(key);
            changed = true;
          }
        }
        continue;
      }

      let merged;
      if (
        local !== null &&
        typeof local === 'object' && !Array.isArray(local) &&
        typeof data === 'object' && !Array.isArray(data)
      ) {
        // Merge maps: preserve local-only entries, server wins on conflicts
        merged = { ...local, ...data };
      } else {
        merged = data;
      }
      // One stringify (merged) compared against the already-stored raw string
      if (JSON.stringify(merged) !== localRaw) {
        writeLS(key, merged);
        changed = true;
      }
    }
    return { ok: true, changed };
  } catch {
    console.warn('Sync pull failed — working offline');
    return { ok: false, changed: false };
  }
}

/**
 * Push a single key to the server (debounced).
 * Called automatically after every localStorage write.
 */
export function pushToServer(key, data) {
  if (!syncEnabled) return;

  // Debounce: wait 500ms after last write before pushing
  if (pendingPushes.has(key)) {
    clearTimeout(pendingPushes.get(key));
  }

  const timeoutId = setTimeout(async () => {
    pendingPushes.delete(key);
    try {
      const res = await fetch(`${API_BASE}/data/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('sync-push', { detail: { ok: true, key } }));
      } else {
        window.dispatchEvent(new CustomEvent('sync-push', { detail: { ok: false, key } }));
      }
    } catch {
      // Silent fail — localStorage has the data, will sync next time
      console.warn(`Sync push failed for ${key} — will retry on next write`);
      window.dispatchEvent(new CustomEvent('sync-push', { detail: { ok: false, key } }));
    }
  }, 500);

  pendingPushes.set(key, timeoutId);
}

/**
 * Push ALL localStorage data to server (for initial setup or manual sync)
 */
export async function pushAllToServer(keys) {
  if (!syncEnabled) return false;
  try {
    const payload = {};
    for (const key of keys) {
      payload[key] = readLS(key, null);
    }
    const res = await fetch(`${API_BASE}/data`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    console.warn('Full sync push failed');
    return false;
  }
}

export function setSyncEnabled(enabled) {
  syncEnabled = enabled;
}

export function isSyncEnabled() {
  return syncEnabled;
}
