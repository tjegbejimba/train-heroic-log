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
import { pushToServer } from './sync';

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
