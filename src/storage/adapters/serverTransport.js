/**
 * Server-transport adapter for the offline-persistence seam.
 *
 * Defines the transport contract the seam uses to sync durable sections with
 * the NAS API, plus two interchangeable implementations:
 *
 *   - {@link createFetchTransportAdapter} — talks to the real `/api/data`
 *     endpoints over `fetch`. This mirrors the request shapes already used by
 *     `src/storage/sync.js` (GET `/data`, PUT `/data/:key` with `{ data }`,
 *     PUT `/data` with a full payload map).
 *   - {@link createMemoryTransportAdapter} — a deterministic in-memory fake for
 *     tests, with an injectable clock and an offline toggle so sync failures
 *     can be characterized without a live server.
 *
 * Contract:
 *   - `pullAll()`          → `{ ok, sections }` where `sections` is a map of
 *                            `key → { data, updatedAt }` (empty `{}` on failure)
 *   - `push(key, data)`    → `{ ok, status }`  (`status` is `null` on network error)
 *   - `pushAll(payload)`   → `{ ok, status }`
 *
 * Methods resolve to result objects rather than throwing, matching the
 * offline-first, error-swallowing style of the existing sync layer.
 *
 * @module storage/adapters/serverTransport
 */

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * @typedef {Object} TransportAdapter
 * @property {() => Promise<{ok: boolean, sections: Record<string, {data: unknown, updatedAt: string|null}>}>} pullAll
 * @property {(key: string, data: unknown) => Promise<{ok: boolean, status: number|null}>} push
 * @property {(payload: Record<string, unknown>) => Promise<{ok: boolean, status: number|null}>} pushAll
 */

function timeoutSignal(ms) {
  // AbortSignal.timeout is unavailable in some test/runtime environments.
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms)
    : undefined;
}

/**
 * Real transport backed by `fetch` against the NAS API.
 *
 * @param {Object} [options]
 * @param {string} [options.apiBase='/api']
 * @param {typeof fetch} [options.fetchImpl] - defaults to `globalThis.fetch`
 * @param {number} [options.timeoutMs=5000]
 * @returns {TransportAdapter}
 */
export function createFetchTransportAdapter({
  apiBase = '/api',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('createFetchTransportAdapter: no fetch implementation available');
  }
  const doFetch = (url, opts) => fetchImpl(url, { signal: timeoutSignal(timeoutMs), ...opts });

  return {
    async pullAll() {
      try {
        const res = await doFetch(`${apiBase}/data`, { cache: 'reload' });
        if (!res.ok) return { ok: false, sections: {} };
        const sections = await res.json();
        return { ok: true, sections: sections ?? {} };
      } catch {
        return { ok: false, sections: {} };
      }
    },
    async push(key, data) {
      try {
        const res = await doFetch(`${apiBase}/data/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        });
        return { ok: res.ok, status: res.status };
      } catch {
        return { ok: false, status: null };
      }
    },
    async pushAll(payload) {
      try {
        const res = await doFetch(`${apiBase}/data`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return { ok: res.ok, status: res.status };
      } catch {
        return { ok: false, status: null };
      }
    },
  };
}

/**
 * Deterministic in-memory transport fake for tests.
 *
 * @param {Object} [options]
 * @param {Record<string, {data: unknown, updatedAt: string|null}>} [options.initial]
 * @param {() => string} [options.clock] - stamps `updatedAt` on writes
 * @param {boolean} [options.online=true] - when false, every call resolves ok:false
 * @returns {TransportAdapter & { setOnline: (v: boolean) => void }}
 */
export function createMemoryTransportAdapter({
  initial = {},
  clock = () => new Date().toISOString(),
  online = true,
} = {}) {
  const store = new Map(Object.entries(initial));
  let isOnline = online;

  return {
    setOnline(value) {
      isOnline = value;
    },
    async pullAll() {
      if (!isOnline) return { ok: false, sections: {} };
      return { ok: true, sections: Object.fromEntries(store) };
    },
    async push(key, data) {
      if (!isOnline) return { ok: false, status: null };
      store.set(key, { data, updatedAt: clock() });
      return { ok: true, status: 200 };
    },
    async pushAll(payload) {
      if (!isOnline) return { ok: false, status: null };
      const stamp = clock();
      for (const [key, data] of Object.entries(payload)) {
        store.set(key, { data, updatedAt: stamp });
      }
      return { ok: true, status: 200 };
    },
  };
}
