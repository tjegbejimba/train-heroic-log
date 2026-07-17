const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Deep merge two values with server-wins-at-leaf semantics.
 * - Plain objects: recurse, preserving local-only keys
 * - Arrays, primitives, null: server overwrites
 */
export function deepMerge(local, server) {
  if (
    server === null || server === undefined ||
    typeof server !== 'object' || Array.isArray(server) ||
    local === null || local === undefined ||
    typeof local !== 'object' || Array.isArray(local)
  ) {
    return server;
  }

  const merged = { ...local };
  for (const key of Object.keys(server)) {
    if (UNSAFE_KEYS.has(key)) continue;
    merged[key] = deepMerge(local[key], server[key]);
  }
  return merged;
}

/**
 * Decide how one server section should reconcile with local storage, without
 * performing any I/O. Pure so the pull policy can be tested in isolation and so
 * a single malformed section can be skipped by the caller without aborting the
 * rest of the pull.
 *
 * Map data stays server-wins on conflicts while local-only entries survive
 * (via {@link deepMerge}); arrays/primitives are overwritten by the server.
 * A `data: null` entry is disambiguated by `updatedAt`:
 *   - `updatedAt == null` → the server has never stored this section, so local
 *     data is pushed up (returned as an `push` action) instead of being lost.
 *   - `updatedAt` set      → an intentional deletion, so local is removed.
 * Malformed local content is treated as absent (the server value wins).
 *
 * @param {string|null|undefined} localRaw - the raw localStorage string for the key
 * @param {{ data: unknown, updatedAt: string|null }} serverEntry
 * @returns {{ action: 'write', value: unknown, serialized: string }
 *          | { action: 'push', value: unknown }
 *          | { action: 'remove' }
 *          | { action: 'none' }}
 */
export function planSectionMerge(localRaw, serverEntry) {
  const { data, updatedAt } = serverEntry;

  let local = null;
  if (localRaw !== null && localRaw !== undefined) {
    try {
      local = JSON.parse(localRaw);
    } catch {
      // Malformed local content — treat as absent so the server value wins.
      local = null;
    }
  }

  if (data === null || data === undefined) {
    if (updatedAt === null || updatedAt === undefined) {
      // Server has no file yet — push local up so offline writes aren't lost.
      return local !== null ? { action: 'push', value: local } : { action: 'none' };
    }
    // Intentional deletion — remove local key if present.
    return local !== null ? { action: 'remove' } : { action: 'none' };
  }

  let merged;
  if (
    local !== null &&
    typeof local === 'object' && !Array.isArray(local) &&
    typeof data === 'object' && !Array.isArray(data)
  ) {
    // Merge maps: deep merge preserves local-only nested fields, server wins at leaf.
    merged = deepMerge(local, data);
  } else {
    merged = data;
  }

  const serialized = JSON.stringify(merged);
  if (serialized !== localRaw) {
    return { action: 'write', value: merged, serialized };
  }
  return { action: 'none' };
}
