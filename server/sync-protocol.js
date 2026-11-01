export function canonical(value) {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isMap(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function isMap(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export const equal = (a, b) => canonical(a) === canonical(b);
export const proposal = (value) => ({ present: value !== undefined, value: value ?? null });
const ownValue = (value, key) => value != null && Object.hasOwn(value, key) ? value[key] : undefined;

export function mergeChanges(base, local, remote, path = []) {
  if (equal(local, base)) return { data: remote, conflicts: [] };
  if (equal(remote, base) || equal(local, remote)) return { data: local, conflicts: [] };
  if (isMap(local) && isMap(remote) && (isMap(base) || base == null)) {
    const keys = [...new Set([...Object.keys(base || {}), ...Object.keys(local), ...Object.keys(remote)])];
    const entries = keys.map((key) => [key, mergeChanges(ownValue(base, key), ownValue(local, key), ownValue(remote, key), [...path, key])]);
    return {
      data: Object.fromEntries(entries.filter(([, result]) => result.data !== undefined).map(([key, result]) => [key, result.data])),
      conflicts: entries.flatMap(([, result]) => result.conflicts),
    };
  }
  return {
    data: remote,
    conflicts: [{ path, base: proposal(base), local: proposal(local), remote: proposal(remote) }],
  };
}

export function valueAt(data, path) {
  return path.reduce(ownValue, data);
}

export function applyProposal(data, path, choice) {
  if (path.length === 0) return choice.present ? choice.value : null;
  const next = { ...(data || {}) };
  const [key, ...rest] = path;
  if (rest.length) Object.defineProperty(next, key, { value: applyProposal(ownValue(next, key), rest, choice), enumerable: true, writable: true, configurable: true });
  else if (choice.present) Object.defineProperty(next, key, { value: choice.value, enumerable: true, writable: true, configurable: true });
  else delete next[key];
  return next;
}
