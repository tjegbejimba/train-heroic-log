/**
 * Browser-storage adapter for the offline-persistence seam.
 *
 * Defines the narrow key/value contract the seam depends on and provides two
 * interchangeable implementations:
 *
 *   - {@link createBrowserStorageAdapter} — wraps a real DOM `Storage`
 *     (`localStorage` by default). This is the production adapter.
 *   - {@link createMemoryStorageAdapter} — a deterministic in-memory fake for
 *     tests, with optional quota simulation so quota-exceeded failures can be
 *     characterized without depending on a real browser.
 *
 * Contract (matches the relevant subset of the DOM Storage API):
 *   - `getItem(key)`     → the stored string, or `null` if absent
 *   - `setItem(key, v)`  → stores `String(v)`; may throw on quota exhaustion
 *   - `removeItem(key)`  → deletes the key (no-op if absent)
 *   - `keys()`           → array of currently-present keys
 *
 * Adapters deal only in raw strings. JSON (de)serialization and malformed-data
 * recovery live one layer up, in the persistence seam.
 *
 * @module storage/adapters/browserStorage
 */

/**
 * @typedef {Object} StorageAdapter
 * @property {(key: string) => (string|null)} getItem
 * @property {(key: string, value: unknown) => void} setItem
 * @property {(key: string) => void} removeItem
 * @property {() => string[]} keys
 */

/**
 * Wrap a DOM `Storage`-like object (e.g. `window.localStorage`) as an adapter.
 *
 * @param {Storage} [storage] - defaults to `globalThis.localStorage`
 * @returns {StorageAdapter}
 */
export function createBrowserStorageAdapter(storage = globalThis.localStorage) {
  if (!storage) {
    throw new Error('createBrowserStorageAdapter: no Storage available');
  }
  return {
    getItem(key) {
      return storage.getItem(key);
    },
    setItem(key, value) {
      storage.setItem(key, String(value));
    },
    removeItem(key) {
      storage.removeItem(key);
    },
    keys() {
      const out = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k !== null) out.push(k);
      }
      return out;
    },
  };
}

/** Error mirroring the browser's quota-exceeded failure so callers can branch on `.name`. */
class QuotaExceededError extends Error {
  constructor(message = 'Storage quota exceeded') {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Byte size of a key/value pair, matching quota.js UTF-16 accounting
 * (2 bytes per character, counting both key and value).
 */
function pairBytes(key, value) {
  return (key.length + value.length) * 2;
}

/**
 * Deterministic in-memory storage adapter for tests.
 *
 * @param {Object} [options]
 * @param {Record<string,string>} [options.initial] - seed key/value pairs
 * @param {number} [options.quotaBytes] - optional budget; writes that would push
 *   total usage past it throw a QuotaExceededError and leave state unchanged
 * @returns {StorageAdapter}
 */
export function createMemoryStorageAdapter({ initial = {}, quotaBytes = Infinity } = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, String(v)]));

  function usedBytes(excludeKey) {
    let bytes = 0;
    for (const [k, v] of store) {
      if (k === excludeKey) continue;
      bytes += pairBytes(k, v);
    }
    return bytes;
  }

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      const str = String(value);
      // Replacing an existing key frees its old footprint first.
      const projected = usedBytes(key) + pairBytes(key, str);
      if (projected > quotaBytes) {
        throw new QuotaExceededError();
      }
      store.set(key, str);
    },
    removeItem(key) {
      store.delete(key);
    },
    keys() {
      return [...store.keys()];
    },
  };
}
