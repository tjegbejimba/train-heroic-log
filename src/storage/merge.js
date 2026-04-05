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
