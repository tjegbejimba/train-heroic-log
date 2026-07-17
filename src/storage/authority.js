/**
 * Production wiring for the offline-persistence authority.
 *
 * The {@link module:storage/persistence} seam owns TrainLog's durable data but
 * is intentionally section-id oriented and dependency-injected so it can run
 * against in-memory fakes.  This module adapts that seam to the way the rest of
 * the app addresses data — by *localStorage key* — and wires the production
 * adapters:
 *
 *   - a browser-storage adapter over `window.localStorage`, and
 *   - a **sync-transport adapter** whose `push` delegates to the existing
 *     debounced/retry replication in {@link module:storage/sync} (`pushToServer`).
 *
 * Delegating to `pushToServer` (rather than issuing a fresh `fetch`) keeps a
 * single background-replication path: the same 500ms debounce, the same failure
 * retry/backoff, the same `sync-push` events the UI listens to.  The seam
 * therefore takes ownership of the local read/write/remove path without
 * disconnecting sync.
 *
 * `writeByKey`/`removeByKey` commit locally first (inside the seam) and then
 * trigger the background push, mirroring the offline-first `writeLS`/`removeLS`
 * contract they replace — including the quota-exceeded user alert.
 *
 * @module storage/authority
 */

import { createPersistence } from './persistence';
import { createBrowserStorageAdapter } from './adapters/browserStorage';
import { getSectionByKey } from './registry';
import {
  pushToServer,
  flushPendingPushes,
  retryFailedPushes,
  pullFromServer,
  pushAllToServer,
  clearServerData,
  checkServerHealth,
} from './sync';

const QUOTA_ALERT_MESSAGE = 'Storage limit exceeded. Try clearing old workouts.';

/**
 * A transport adapter that forwards durable-section pushes into the shared,
 * debounced replication path instead of issuing its own network request.
 *
 * @param {(key: string, data: unknown) => void} [push] - injectable for tests
 * @returns {import('./adapters/serverTransport').TransportAdapter}
 */
export function createSyncTransportAdapter(push = pushToServer) {
  return {
    // Pulls are owned by the existing sync layer (`pullFromServer`); the
    // authority only writes through this adapter.
    async pullAll() {
      return { ok: false, sections: {} };
    },
    async push(key, data) {
      push(key, data);
      return { ok: true, status: null };
    },
    async pushAll() {
      return { ok: false, status: null };
    },
  };
}

/**
 * Build a key-addressed authority around an existing persistence seam.
 *
 * @param {Object} deps
 * @param {import('./adapters/browserStorage').StorageAdapter} deps.storage
 * @param {import('./adapters/serverTransport').TransportAdapter} deps.transport
 * @param {(msg: string) => void} [deps.notify] - surfaced on quota failure
 * @returns {{
 *   persistence: ReturnType<typeof createPersistence>,
 *   readByKey: (key: string, fallback?: unknown) => unknown,
 *   writeByKey: (key: string, value: unknown) => Promise<{ok: boolean, reason?: string}>,
 *   removeByKey: (key: string) => Promise<{ok: boolean}>,
 * }}
 */
export function createAuthority({ storage, transport, notify = defaultNotify }) {
  const persistence = createPersistence({ storage, transport });

  /** Read a durable section by its localStorage key, degrading to `fallback`. */
  function readByKey(key, fallback = null) {
    const section = getSectionByKey(key);
    if (!section) return fallback;
    return persistence.read(section.id);
  }

  /**
   * Write a durable section by its localStorage key. Commits locally first,
   * then triggers background replication. Surfaces the quota alert to preserve
   * the legacy `writeLS` outcome.
   */
  function writeByKey(key, value) {
    const section = getSectionByKey(key);
    if (!section) return Promise.resolve({ ok: false, reason: 'unknown-key' });
    const result = persistence.write(section.id, value);
    return result.then((res) => {
      if (res && res.ok === false && res.reason === 'quota') {
        notify(QUOTA_ALERT_MESSAGE);
      }
      return res;
    });
  }

  /** Remove a durable section by its localStorage key, pushing a null deletion. */
  function removeByKey(key) {
    const section = getSectionByKey(key);
    if (!section) return Promise.resolve({ ok: false, reason: 'unknown-key' });
    return persistence.remove(section.id);
  }

  return { persistence, readByKey, writeByKey, removeByKey };
}

/** Best-effort user alert; a no-op where `alert` is unavailable (SSR/tests). */
function defaultNotify(message) {
  if (typeof alert === 'function') {
    try {
      alert(message);
    } catch {
      /* alert unavailable — swallow */
    }
  }
}

let singleton = null;

/** Lazily construct the production authority (localStorage + shared sync push). */
function getAuthority() {
  if (!singleton) {
    singleton = createAuthority({
      storage: createBrowserStorageAdapter(),
      transport: createSyncTransportAdapter(),
    });
  }
  return singleton;
}

/** Read a durable section by its localStorage key (production singleton). */
export function readByKey(key, fallback = null) {
  return getAuthority().readByKey(key, fallback);
}

/** Write a durable section by its localStorage key (production singleton). */
export function writeByKey(key, value) {
  return getAuthority().writeByKey(key, value);
}

/** Remove a durable section by its localStorage key (production singleton). */
export function removeByKey(key) {
  return getAuthority().removeByKey(key);
}

/* -------------------------------------------------------------------------- *
 * Replication lifecycle facade.
 *
 * The authority is the single owner of background replication: it fronts the
 * private sync engine (`storage/sync`) so no production write path imports the
 * engine's push/retry/flush helpers directly. Each function below is a thin,
 * behavior-preserving delegate to the engine — the debounce, retry/backoff,
 * exhaustion, reconnect, and unload/background fallback semantics all live in
 * the engine and are reached exclusively through these entry points.
 * -------------------------------------------------------------------------- */

/** Immediately flush all debounced pushes (call before a reload/unload). */
export function flushReplication() {
  return flushPendingPushes();
}

/** Re-push any previously-failed keys, preserving their stored payloads. */
export function retryReplication() {
  return retryFailedPushes();
}

/** Pull server data and merge it into local storage. */
export function pullReplication() {
  return pullFromServer();
}

/** Push every provided key to the server in one bulk request. */
export function pushAllReplication(keys) {
  return pushAllToServer(keys);
}

/** Clear the given keys on the server (bulk null push). */
export function clearReplication(keys) {
  return clearServerData(keys);
}

/** Probe whether the replication server is reachable. */
export function checkReplicationHealth() {
  return checkServerHealth();
}

/* -------------------------------------------------------------------------- *
 * Reload coordination.
 *
 * A handful of flows (a sync merge that changed local data, a clear-all, a
 * backup restore) must commit their changes, force any pending replication to
 * the server, and then reload the page. Left uncoordinated they race: a second
 * trigger could reload twice, or a state write could slip in between the final
 * flush and the reload and be lost.
 *
 * `coordinateSyncReload` is the single owner of that sequence. It runs exactly
 * once per page life, aborts in-flight async work first (so nothing new can
 * enqueue), runs an optional caller mutation, performs the FINAL flush, marks
 * the next startup pull to be skipped, then schedules one reload.
 * -------------------------------------------------------------------------- */

let reloadInProgress = false;

/**
 * Coordinate the one-and-only sync reload for this page.
 *
 * Sequence (exactly once): abort in-flight work → optional `mutate` →
 * final flush → set `skipSync` (+ caller flags) → schedule a single reload.
 *
 * @param {Object} [opts]
 * @param {() => (void | Promise<void>)} [opts.mutate] - data change to commit under the guard
 * @param {Record<string, string>} [opts.sessionFlags] - extra sessionStorage flags to set
 * @param {number} [opts.delayMs=0] - delay before the reload (e.g. to show a toast)
 * @returns {Promise<boolean>} true if this call owned the reload, false if one was already in progress
 */
export async function coordinateSyncReload({ mutate, sessionFlags = {}, delayMs = 0 } = {}) {
  if (reloadInProgress) return false;
  reloadInProgress = true;

  // Abort pending async operations so no new local write can enqueue between
  // the final flush and the reload.
  if (typeof window !== 'undefined' && typeof window.stop === 'function') {
    try {
      window.stop();
    } catch {
      /* window.stop unavailable — ignore */
    }
  }

  if (typeof mutate === 'function') {
    await mutate();
  }

  // The final flush: everything committed above reaches the server before reload.
  await flushReplication();

  if (typeof sessionStorage !== 'undefined') {
    // Skip the next startup pull so we don't re-merge what we just reconciled.
    sessionStorage.setItem('skipSync', '1');
    for (const [key, value] of Object.entries(sessionFlags)) {
      sessionStorage.setItem(key, value);
    }
  }

  if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
    setTimeout(() => window.location.reload(), delayMs);
  }
  return true;
}

/** Test-only: reset the exactly-once reload guard between cases. */
export function __resetSyncReload() {
  reloadInProgress = false;
}
