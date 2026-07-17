// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LS_WORKOUTS, LS_ACTIVE_SESSION } from '../constants';

// End-to-end proof that debounce, deletion, retry, and flush replication all pass
// through the persistence authority's public API against the REAL sync engine
// (only the network is faked). Modules are reset per test so the engine's
// in-memory queue/retry state never leaks between scenarios. Browser globals are
// stubbed explicitly for determinism instead of relying on a full DOM.

let store = {};

function makeLocalStorage() {
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (i) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

if (!AbortSignal.timeout) {
  AbortSignal.timeout = (ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

function bodyOf(call) {
  return JSON.parse(call[1].body);
}

async function loadAuthorityWithEngine() {
  vi.resetModules();
  const authority = await import('./authority');
  const sync = await import('./sync');
  sync.setSyncEnabled(true);
  return { authority, sync };
}

beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', makeLocalStorage());
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
  vi.stubGlobal('CustomEvent', class CustomEvent {
    constructor(type, opts) { this.type = type; this.detail = opts?.detail; }
  });
  vi.stubGlobal('document', { addEventListener: vi.fn(), visibilityState: 'visible' });
  vi.stubGlobal('window', { addEventListener: vi.fn(), dispatchEvent: vi.fn() });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('replication through the persistence authority', () => {
  it('debounces rapid writes and replicates only the latest value', async () => {
    const { authority } = await loadAuthorityWithEngine();

    await authority.writeByKey(LS_WORKOUTS, { v: 1 });
    await authority.writeByKey(LS_WORKOUTS, { v: 2 });
    await authority.writeByKey(LS_WORKOUTS, { v: 3 });

    // Local commit is immediate and holds the latest value.
    expect(store[LS_WORKOUTS]).toBe('{"v":3}');
    // No network work before the debounce elapses.
    expect(fetch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetch.mock.calls[0])).toEqual({ data: { v: 3 } });
  });

  it('replicates a deletion as a null push', async () => {
    const { authority } = await loadAuthorityWithEngine();
    store[LS_ACTIVE_SESSION] = '{"logKey":"x"}';

    await authority.removeByKey(LS_ACTIVE_SESSION);

    expect(store[LS_ACTIVE_SESSION]).toBeUndefined();
    await vi.advanceTimersByTimeAsync(500);

    expect(fetch).toHaveBeenCalledTimes(1);
    const call = fetch.mock.calls[0];
    expect(call[0]).toContain(LS_ACTIVE_SESSION);
    expect(bodyOf(call)).toEqual({ data: null });
  });

  it('flushReplication forces a pending push without waiting for the debounce', async () => {
    const { authority } = await loadAuthorityWithEngine();

    await authority.writeByKey(LS_WORKOUTS, { flushed: true });
    expect(fetch).not.toHaveBeenCalled();

    await authority.flushReplication();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetch.mock.calls[0])).toEqual({ data: { flushed: true } });
  });

  it('retries a failed push with backoff, preserving the exact payload', async () => {
    const { authority } = await loadAuthorityWithEngine();
    fetch.mockRejectedValueOnce(new Error('offline'));

    await authority.writeByKey(LS_WORKOUTS, { attempt: 1 });
    await vi.advanceTimersByTimeAsync(500); // first push fails
    expect(fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000); // backoff retry succeeds
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(bodyOf(fetch.mock.calls[1])).toEqual({ data: { attempt: 1 } });
  });

  it('retryReplication re-pushes a failed deletion payload on reconnect', async () => {
    const { authority } = await loadAuthorityWithEngine();
    store[LS_ACTIVE_SESSION] = '{"logKey":"x"}';
    fetch.mockRejectedValueOnce(new Error('offline'));

    await authority.removeByKey(LS_ACTIVE_SESSION);
    await vi.advanceTimersByTimeAsync(500); // deletion push fails, payload=null retained
    expect(fetch).toHaveBeenCalledTimes(1);

    fetch.mockResolvedValueOnce({ ok: true });
    await authority.retryReplication();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(bodyOf(fetch.mock.calls[1])).toEqual({ data: null });
  });
});
