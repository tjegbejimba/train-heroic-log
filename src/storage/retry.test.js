import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRetryState, recordFailure, shouldRetry, getBackoffMs, dropKey, getFailedEntries } from './retry.js';

describe('retry backoff', () => {
  it('getBackoffMs doubles each attempt up to max', () => {
    expect(getBackoffMs(0)).toBe(1000);  // 1s
    expect(getBackoffMs(1)).toBe(2000);  // 2s
    expect(getBackoffMs(2)).toBe(4000);  // 4s
    expect(getBackoffMs(3)).toBe(8000);  // 8s
    expect(getBackoffMs(10)).toBe(30000); // capped at 30s
  });

  it('shouldRetry returns false for 4xx (non-retryable)', () => {
    expect(shouldRetry(400)).toBe(false);
    expect(shouldRetry(403)).toBe(false);
    expect(shouldRetry(404)).toBe(false);
    expect(shouldRetry(422)).toBe(false);
  });

  it('shouldRetry returns true for 5xx and network errors', () => {
    expect(shouldRetry(500)).toBe(true);
    expect(shouldRetry(502)).toBe(true);
    expect(shouldRetry(503)).toBe(true);
    expect(shouldRetry(null)).toBe(true); // network error (no status)
  });
});

describe('retry state management', () => {
  let state;

  beforeEach(() => {
    state = createRetryState();
  });

  it('starts empty', () => {
    expect(getFailedEntries(state)).toEqual([]);
  });

  it('recordFailure tracks key with payload and attempt count', () => {
    state = recordFailure(state, 'th_workouts', { title: 'A' }, 500);
    const entries = getFailedEntries(state);
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe('th_workouts');
    expect(entries[0].payload).toEqual({ title: 'A' });
    expect(entries[0].attempts).toBe(1);
    expect(entries[0].statusCode).toBe(500);
  });

  it('recordFailure increments attempts on repeated failure', () => {
    state = recordFailure(state, 'th_workouts', { a: 1 }, 500);
    state = recordFailure(state, 'th_workouts', { a: 2 }, 503);
    const entries = getFailedEntries(state);
    expect(entries).toHaveLength(1);
    expect(entries[0].attempts).toBe(2);
    expect(entries[0].payload).toEqual({ a: 2 }); // latest payload
    expect(entries[0].statusCode).toBe(503);
  });

  it('recordFailure stores null payload for deletes', () => {
    state = recordFailure(state, 'th_workouts', null, 500);
    const entries = getFailedEntries(state);
    expect(entries[0].payload).toBeNull();
  });

  it('dropKey removes a key from state', () => {
    state = recordFailure(state, 'th_workouts', { a: 1 }, 500);
    state = recordFailure(state, 'th_logs', { b: 2 }, 502);
    state = dropKey(state, 'th_workouts');
    const entries = getFailedEntries(state);
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe('th_logs');
  });

  it('entries exceeding max attempts are flagged', () => {
    state = recordFailure(state, 'th_workouts', {}, 500);
    for (let i = 1; i < 10; i++) {
      state = recordFailure(state, 'th_workouts', {}, 500);
    }
    const entries = getFailedEntries(state);
    expect(entries[0].attempts).toBe(10);
    expect(entries[0].exhausted).toBe(true);
  });

  it('4xx errors are marked exhausted immediately', () => {
    state = recordFailure(state, 'th_workouts', {}, 404);
    const entries = getFailedEntries(state);
    expect(entries[0].attempts).toBe(1);
    expect(entries[0].exhausted).toBe(true);
  });

  it('serializes and deserializes for persistence', () => {
    state = recordFailure(state, 'th_workouts', { a: 1 }, 500);
    state = recordFailure(state, 'th_logs', null, 502);
    const json = JSON.stringify(state);
    const restored = createRetryState(JSON.parse(json));
    expect(getFailedEntries(restored)).toEqual(getFailedEntries(state));
  });
});
