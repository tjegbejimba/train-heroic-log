/**
 * Sync layer: localStorage is primary (offline-first), background sync to NAS API.
 *
 * Flow:
 * 1. All reads/writes go to localStorage immediately (app always works)
 * 2. On writes, queue a background push to the server
 * 3. On startup, pull from server and merge (server wins for data you haven't touched locally)
 */

import { readLS, writeLS, removeLS } from './index';
import { deepMerge } from './merge';
import { createRetryState, recordFailure, dropKey, getFailedEntries, shouldRetry, getBackoffMs } from './retry';

// API base URL — in production, same origin; in dev, point to backend port
const API_BASE = import.meta.env.VITE_API_URL || '/api';

let syncEnabled = true;
let pendingPushes = new Map(); // key -> timeout ID (debounce)
let retryTimers = new Map(); // key -> timeout ID (backoff retry)

// Restore retry state from localStorage so it survives page reloads and PWA restarts
let retryState = createRetryState();
try {
  const stored = localStorage.getItem('sync_failed_keys');
  if (stored) {
    const parsed = JSON.parse(stored);
    // Migrate from old Set format (array of strings) to new state format
    if (Array.isArray(parsed)) {
      parsed.forEach((k) => { retryState = recordFailure(retryState, k, readLS(k, null), null); });
    } else {
      retryState = createRetryState(parsed);
    }
  }
} catch { /* ignore parse errors */ }

function persistRetryState() {
  try {
    localStorage.setItem('sync_failed_keys', JSON.stringify(retryState));
  } catch { /* localStorage may be unavailable */ }
}

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
    const res = await fetch(`${API_BASE}/data`, { signal: AbortSignal.timeout(5000), cache: 'reload' });
    if (!res.ok) return { ok: false, changed: false };
    const serverData = await res.json();

    let changed = false;
    const changedKeys = [];
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
            changedKeys.push(key);
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
        // Merge maps: deep merge preserves local-only nested fields, server wins at leaf
        merged = deepMerge(local, data);
      } else {
        merged = data;
      }
      // One stringify (merged) compared against the already-stored raw string.
      // Write directly to localStorage (bypassing writeLS) so we don't enqueue
      // a redundant push back to the server for data we just pulled from it.
      const mergedStr = JSON.stringify(merged);
      if (mergedStr !== localRaw) {
        localStorage.setItem(key, mergedStr);
        changed = true;
        changedKeys.push(key);
      }
    }
    if (changed) {
      window.dispatchEvent(new CustomEvent('sync-merge-conflict', { detail: { keys: changedKeys } }));
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
        retryState = dropKey(retryState, key);
        persistRetryState();
        if (retryTimers.has(key)) { clearTimeout(retryTimers.get(key)); retryTimers.delete(key); }
        window.dispatchEvent(new CustomEvent('sync-push', { detail: { ok: true, key } }));
      } else {
        handlePushFailure(key, data, res.status);
      }
    } catch {
      handlePushFailure(key, data, null);
    }
  }, 500);

  pendingPushes.set(key, timeoutId);
}

function handlePushFailure(key, data, statusCode) {
  retryState = recordFailure(retryState, key, data, statusCode);
  persistRetryState();
  const entry = retryState[key];
  if (!entry.exhausted) scheduleRetry(key);
  window.dispatchEvent(new CustomEvent('sync-push', { detail: { ok: false, key, attempts: entry.attempts } }));
}

function scheduleRetry(key) {
  if (retryTimers.has(key)) { clearTimeout(retryTimers.get(key)); retryTimers.delete(key); }
  const entry = retryState[key];
  if (!entry || entry.exhausted) return;
  const delay = getBackoffMs(entry.attempts - 1);
  const timerId = setTimeout(async () => {
    retryTimers.delete(key);
    const currentEntry = retryState[key];
    if (!currentEntry || currentEntry.exhausted) return;
    const payload = currentEntry.payload;
    try {
      const res = await fetch(`${API_BASE}/data/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        retryState = dropKey(retryState, key);
        persistRetryState();
        window.dispatchEvent(new CustomEvent('sync-push', { detail: { ok: true, key } }));
      } else {
        handlePushFailure(key, payload, res.status);
      }
    } catch {
      handlePushFailure(key, payload, null);
    }
  }, delay);
  retryTimers.set(key, timerId);
}

/**
 * Immediately flush all debounced pushes (don't wait for timers).
 * Call this before page reload to prevent data loss.
 */
export async function flushPendingPushes() {
  const keys = [...pendingPushes.keys()];
  for (const key of keys) {
    clearTimeout(pendingPushes.get(key));
    pendingPushes.delete(key);
  }
  if (keys.length === 0) return;
  await Promise.all(keys.map(async (key) => {
    try {
      const data = readLS(key, null);
      const res = await fetch(`${API_BASE}/data/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        retryState = dropKey(retryState, key);
        persistRetryState();
        window.dispatchEvent(new CustomEvent('sync-push', { detail: { ok: true, key } }));
      } else {
        retryState = recordFailure(retryState, key, data, res.status);
        persistRetryState();
      }
    } catch {
      const data = readLS(key, null);
      retryState = recordFailure(retryState, key, data, null);
      persistRetryState();
    }
  }));
}

/**
 * Check if there are pending debounced pushes.
 */
export function hasPendingPushes() {
  return pendingPushes.size > 0;
}

/**
 * Retry pushing keys that previously failed.
 * Uses stored payload (not localStorage) so failed deletes aren't lost.
 * Skips exhausted entries (too many attempts or 4xx errors).
 */
export async function retryFailedPushes() {
  const entries = getFailedEntries(retryState);
  const retryable = entries.filter((e) => !e.exhausted);
  if (retryable.length === 0) return;
  await Promise.all(retryable.map(async (entry) => {
    try {
      const res = await fetch(`${API_BASE}/data/${entry.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: entry.payload }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        retryState = dropKey(retryState, entry.key);
        persistRetryState();
        window.dispatchEvent(new CustomEvent('sync-push', { detail: { ok: true, key: entry.key } }));
      } else {
        handlePushFailure(entry.key, entry.payload, res.status);
      }
    } catch {
      handlePushFailure(entry.key, entry.payload, null);
    }
  }));
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

/**
 * Clear all data on the server (push null for every key)
 */
export async function clearServerData(keys) {
  if (!syncEnabled) return false;
  try {
    const payload = {};
    for (const key of keys) {
      payload[key] = null;
    }
    const res = await fetch(`${API_BASE}/data`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    console.warn('Server data clear failed');
    return false;
  }
}

// Flush pending pushes when the page goes to background.
// iOS freezes JS timers when a PWA is backgrounded, so debounced pushes
// would never fire — this ensures writes reach the server before suspension.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingPushes();
    }
  });
}

// Flush pending pushes before page unload to prevent data loss during the
// 500ms debounce window.  navigator.sendBeacon is used as a synchronous
// fallback since async fetch is not guaranteed to complete during beforeunload.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (pendingPushes.size === 0) return;
    const keys = [...pendingPushes.keys()];
    for (const key of keys) {
      clearTimeout(pendingPushes.get(key));
      pendingPushes.delete(key);
    }
    for (const key of keys) {
      try {
        const data = readLS(key, null);
        const payload = JSON.stringify({ data });
        const url = `${API_BASE}/data/${key}`;
        const sent = navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
        if (!sent) {
          retryState = recordFailure(retryState, key, data, null);
        }
      } catch {
        const data = readLS(key, null);
        retryState = recordFailure(retryState, key, data, null);
      }
    }
    persistRetryState();
  });

  // Retry failed pushes when network comes back online
  window.addEventListener('online', () => {
    retryFailedPushes();
  });
}

export function setSyncEnabled(enabled) {
  syncEnabled = enabled;
}

export function isSyncEnabled() {
  return syncEnabled;
}
