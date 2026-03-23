/**
 * Sync layer: localStorage is primary (offline-first), background sync to NAS API.
 *
 * Flow:
 * 1. All reads/writes go to localStorage immediately (app always works)
 * 2. On writes, queue a background push to the server
 * 3. On startup, pull from server and merge (server wins for data you haven't touched locally)
 */

import { readLS, writeLS } from './index';

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
 * Server data wins for keys that exist on server.
 * Returns true if sync succeeded.
 */
export async function pullFromServer() {
  if (!syncEnabled) return false;
  try {
    const res = await fetch(`${API_BASE}/data`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const serverData = await res.json();

    for (const [key, { data }] of Object.entries(serverData)) {
      if (data !== null) {
        writeLS(key, data);
      }
    }
    return true;
  } catch {
    console.warn('Sync pull failed — working offline');
    return false;
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
      await fetch(`${API_BASE}/data/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Silent fail — localStorage has the data, will sync next time
      console.warn(`Sync push failed for ${key} — will retry on next write`);
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
