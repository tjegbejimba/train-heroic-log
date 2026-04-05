/**
 * localStorage quota tracking utilities.
 * Chars stored as UTF-16 → 2 bytes per character.
 */

const DEFAULT_ESTIMATE = 5 * 1024 * 1024; // 5MB — conservative browser default

/** Total bytes used across all localStorage keys */
export function getQuotaUsage() {
  let chars = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    chars += key.length + (value?.length ?? 0);
  }
  return { used: chars * 2, estimate: DEFAULT_ESTIMATE };
}

/** Classify usage level: ok / warning (>70%) / critical (>90%) */
export function getQuotaWarning(usedBytes, estimateBytes = DEFAULT_ESTIMATE) {
  const percent = Math.round((usedBytes / estimateBytes) * 100);
  if (percent >= 90) return { level: 'critical', percent };
  if (percent >= 70) return { level: 'warning', percent };
  return { level: 'ok', percent };
}

/** Byte size per key (value only — keys are negligible) */
export function getSizeByKey(keys) {
  const sizes = {};
  for (const key of keys) {
    const value = localStorage.getItem(key);
    sizes[key] = value ? value.length * 2 : 0;
  }
  return sizes;
}
