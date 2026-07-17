// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The authority fronts the replication engine. These tests pin the facade to the
// engine so callers never reach into ./sync directly. The engine is mocked so we
// observe delegation, argument forwarding, and return-value passthrough.
vi.mock('./sync', () => ({
  pushToServer: vi.fn(),
  flushPendingPushes: vi.fn(() => Promise.resolve('flushed')),
  retryFailedPushes: vi.fn(() => Promise.resolve('retried')),
  pullFromServer: vi.fn(() => Promise.resolve({ ok: true, changed: true })),
  pushAllToServer: vi.fn(() => Promise.resolve(true)),
  clearServerData: vi.fn(() => Promise.resolve(true)),
  checkServerHealth: vi.fn(() => Promise.resolve(true)),
}));

import {
  flushReplication,
  retryReplication,
  pullReplication,
  pushAllReplication,
  clearReplication,
  checkReplicationHealth,
} from './authority';
import {
  flushPendingPushes,
  retryFailedPushes,
  pullFromServer,
  pushAllToServer,
  clearServerData,
  checkServerHealth,
} from './sync';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('persistence authority — replication facade', () => {
  it('flushReplication flushes pending pushes through the engine', async () => {
    const result = await flushReplication();
    expect(flushPendingPushes).toHaveBeenCalledTimes(1);
    expect(result).toBe('flushed');
  });

  it('retryReplication retries failed pushes through the engine', async () => {
    const result = await retryReplication();
    expect(retryFailedPushes).toHaveBeenCalledTimes(1);
    expect(result).toBe('retried');
  });

  it('pullReplication pulls-and-merges through the engine', async () => {
    const result = await pullReplication();
    expect(pullFromServer).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, changed: true });
  });

  it('pushAllReplication forwards the key list to the engine', async () => {
    const keys = ['th_workouts', 'th_logs'];
    const result = await pushAllReplication(keys);
    expect(pushAllToServer).toHaveBeenCalledTimes(1);
    expect(pushAllToServer).toHaveBeenCalledWith(keys);
    expect(result).toBe(true);
  });

  it('clearReplication forwards the key list to the engine', async () => {
    const keys = ['th_workouts', 'th_logs'];
    const result = await clearReplication(keys);
    expect(clearServerData).toHaveBeenCalledTimes(1);
    expect(clearServerData).toHaveBeenCalledWith(keys);
    expect(result).toBe(true);
  });

  it('checkReplicationHealth probes server health through the engine', async () => {
    const result = await checkReplicationHealth();
    expect(checkServerHealth).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });
});
