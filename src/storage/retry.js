/**
 * Retry state management — pure functions, no side effects.
 * Tracks failed sync keys with payload, attempt count, and backoff timing.
 */

const MAX_ATTEMPTS = 10;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

/** Exponential backoff: 1s → 2s → 4s → … → 30s cap */
export function getBackoffMs(attempt) {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
}

/** 4xx = non-retryable (client error), 5xx/null = retryable */
export function shouldRetry(statusCode) {
  if (statusCode === null || statusCode === undefined) return true; // network error
  return statusCode >= 500;
}

/** Create fresh or restore from persisted data */
export function createRetryState(persisted = null) {
  if (persisted && typeof persisted === 'object') return { ...persisted };
  return {};
}

/** Record a failure for a key, incrementing attempts and updating payload */
export function recordFailure(state, key, payload, statusCode) {
  const prev = state[key];
  const attempts = (prev?.attempts || 0) + 1;
  const exhausted = !shouldRetry(statusCode) || attempts >= MAX_ATTEMPTS;

  return {
    ...state,
    [key]: {
      key,
      payload,
      attempts,
      statusCode,
      lastAttempt: Date.now(),
      exhausted,
    },
  };
}

/** Remove a key from retry state (on success) */
export function dropKey(state, key) {
  const next = { ...state };
  delete next[key];
  return next;
}

/** Get all failed entries as an array with exhausted flag */
export function getFailedEntries(state) {
  return Object.values(state);
}
