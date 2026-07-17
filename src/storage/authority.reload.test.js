// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The authority owns the single reload-safe path used after a sync merge, a
// clear-all, or a backup restore. The replication engine is mocked so we observe
// the coordinator's ordering and exactly-once guarantees without real I/O.
const order = [];

vi.mock('./sync', () => ({
  pushToServer: vi.fn(),
  flushPendingPushes: vi.fn(() => { order.push('flush'); return Promise.resolve(); }),
  retryFailedPushes: vi.fn(() => Promise.resolve()),
  pullFromServer: vi.fn(() => Promise.resolve({ ok: true, changed: false })),
  pushAllToServer: vi.fn(() => Promise.resolve(true)),
  clearServerData: vi.fn(() => Promise.resolve(true)),
  checkServerHealth: vi.fn(() => Promise.resolve(true)),
}));

import { coordinateSyncReload, __resetSyncReload } from './authority';
import { flushPendingPushes } from './sync';

let sessionFlags;
let reloadCalls;
let stopCalls;

beforeEach(() => {
  vi.clearAllMocks();
  order.length = 0;
  sessionFlags = {};
  reloadCalls = 0;
  stopCalls = 0;
  __resetSyncReload();
  vi.useFakeTimers();
  vi.stubGlobal('sessionStorage', {
    setItem: (k, v) => { sessionFlags[k] = v; },
    getItem: (k) => (k in sessionFlags ? sessionFlags[k] : null),
    removeItem: (k) => { delete sessionFlags[k]; },
  });
  vi.stubGlobal('window', {
    stop: () => { order.push('stop'); stopCalls += 1; },
    location: { reload: () => { reloadCalls += 1; } },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('authority — coordinateSyncReload', () => {
  it('flushes then reloads exactly once, setting skipSync (skip-next-pull)', async () => {
    const started = await coordinateSyncReload();
    expect(started).toBe(true);

    expect(flushPendingPushes).toHaveBeenCalledTimes(1);
    expect(sessionFlags.skipSync).toBe('1');

    // Reload is scheduled, not fired synchronously; it fires once when timers run.
    expect(reloadCalls).toBe(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(reloadCalls).toBe(1);
  });

  it('aborts in-flight work with window.stop() before the final flush', async () => {
    await coordinateSyncReload();
    expect(stopCalls).toBe(1);
    // stop must precede the flush so no new write can enqueue in between.
    expect(order.indexOf('stop')).toBeLessThan(order.indexOf('flush'));
  });

  it('runs the mutate hook before the final flush', async () => {
    const mutate = vi.fn(() => { order.push('mutate'); });
    await coordinateSyncReload({ mutate });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['stop', 'mutate', 'flush']);
  });

  it('merges caller session flags alongside skipSync', async () => {
    await coordinateSyncReload({ sessionFlags: { syncReload: '1' } });
    expect(sessionFlags.skipSync).toBe('1');
    expect(sessionFlags.syncReload).toBe('1');
  });

  it('is exactly-once: a second call is a no-op that never double-reloads', async () => {
    await coordinateSyncReload();
    const second = await coordinateSyncReload({ mutate: vi.fn() });

    expect(second).toBe(false);
    expect(flushPendingPushes).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600);
    expect(reloadCalls).toBe(1);
  });

  it('honors a delay before reloading (for toast visibility)', async () => {
    await coordinateSyncReload({ delayMs: 500 });
    await vi.advanceTimersByTimeAsync(400);
    expect(reloadCalls).toBe(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(reloadCalls).toBe(1);
  });
});
