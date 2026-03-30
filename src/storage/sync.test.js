import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the module under test
// ---------------------------------------------------------------------------

// Mock ./index to break circular dependency and control readLS/writeLS/removeLS
vi.mock('./index', () => ({
  readLS: vi.fn(),
  writeLS: vi.fn(),
  removeLS: vi.fn(),
}));

// Stub browser globals before any import touches them
const localStorageStore = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key) => localStorageStore[key] ?? null),
  setItem: vi.fn((key, val) => { localStorageStore[key] = val; }),
  removeItem: vi.fn((key) => { delete localStorageStore[key]; }),
});

vi.stubGlobal('sessionStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
});

vi.stubGlobal('fetch', vi.fn());

// Provide minimal document so the visibilitychange listener doesn't blow up
vi.stubGlobal('document', {
  addEventListener: vi.fn(),
  visibilityState: 'visible',
});

// Provide window.dispatchEvent and CustomEvent
vi.stubGlobal('CustomEvent', class CustomEvent {
  constructor(type, opts) { this.type = type; this.detail = opts?.detail; }
});

const originalDispatchEvent = globalThis.window?.dispatchEvent;
if (typeof globalThis.window === 'undefined') {
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
} else {
  window.dispatchEvent = vi.fn();
}

// Provide AbortSignal.timeout
if (!AbortSignal.timeout) {
  AbortSignal.timeout = (ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

// Now import the module under test and the mocked dependencies
import {
  pullFromServer,
  pushToServer,
  flushPendingPushes,
  retryFailedPushes,
  setSyncEnabled,
  hasPendingPushes,
} from './sync';

import { readLS, writeLS, removeLS } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchJson(data, ok = true) {
  fetch.mockResolvedValueOnce({
    ok,
    json: async () => data,
  });
}

function mockFetchOk() {
  fetch.mockResolvedValueOnce({ ok: true });
}

function mockFetchFail() {
  fetch.mockRejectedValueOnce(new Error('Network error'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sync.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear our fake localStorage store
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
    // Ensure sync is enabled
    setSyncEnabled(true);
    // Use fake timers for debounce tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // pullFromServer
  // =========================================================================
  describe('pullFromServer', () => {
    it('returns changed=true when server has a key local does not', async () => {
      // Server returns data for th_workouts, local has nothing
      mockFetchJson({
        th_workouts: { data: { 'Upper A': { title: 'Upper A' } }, updatedAt: '2024-01-01' },
      });
      // localStorage.getItem returns null for th_workouts (not in local)
      localStorage.getItem.mockReturnValue(null);

      const result = await pullFromServer();

      expect(result).toEqual({ ok: true, changed: true });
      expect(writeLS).toHaveBeenCalledWith('th_workouts', { 'Upper A': { title: 'Upper A' } });
    });

    it('returns changed=false when server data equals local data', async () => {
      const data = { 'Upper A': { title: 'Upper A' } };
      const serialized = JSON.stringify(data);
      mockFetchJson({
        th_workouts: { data, updatedAt: '2024-01-01' },
      });
      // localStorage has the same data
      localStorage.getItem.mockReturnValue(serialized);

      const result = await pullFromServer();

      expect(result).toEqual({ ok: true, changed: false });
      expect(writeLS).not.toHaveBeenCalled();
    });

    it('server wins on same-key conflicts (merge)', async () => {
      const localData = { exercise1: { reps: 10 }, exercise2: { reps: 5 } };
      const serverData = { exercise1: { reps: 12 }, exercise3: { reps: 8 } };

      mockFetchJson({
        th_workouts: { data: serverData, updatedAt: '2024-01-01' },
      });
      localStorage.getItem.mockReturnValue(JSON.stringify(localData));

      const result = await pullFromServer();

      expect(result).toEqual({ ok: true, changed: true });
      // Merged: local-only exercise2 preserved, server exercise1 wins, exercise3 added
      expect(writeLS).toHaveBeenCalledWith('th_workouts', {
        exercise1: { reps: 12 },
        exercise2: { reps: 5 },
        exercise3: { reps: 8 },
      });
    });

    it('preserves local-only keys during merge', async () => {
      // Server sends th_workouts, local also has th_schedule (not in server response)
      const serverWorkouts = { 'Upper A': { title: 'Upper A' } };
      mockFetchJson({
        th_workouts: { data: serverWorkouts, updatedAt: '2024-01-01' },
      });
      // local has no th_workouts
      localStorage.getItem.mockReturnValue(null);

      const result = await pullFromServer();

      // Only th_workouts is touched; the test verifies that pullFromServer
      // only iterates server keys — it never deletes local keys not in server
      expect(result).toEqual({ ok: true, changed: true });
      // removeLS should NOT have been called for any key
      expect(removeLS).not.toHaveBeenCalled();
    });

    it('pushes local data to server when server has null data and null updatedAt', async () => {
      mockFetchJson({
        th_workouts: { data: null, updatedAt: null },
      });
      const localData = { 'Upper A': { title: 'Upper A' } };
      localStorage.getItem.mockReturnValue(JSON.stringify(localData));

      const result = await pullFromServer();

      expect(result).toEqual({ ok: true, changed: false });
      // Should not write to local, but should trigger a push
      expect(writeLS).not.toHaveBeenCalled();
      // pushToServer is called internally — we can verify via the pending push
      // Since pushToServer sets a timeout, we check hasPendingPushes
      expect(hasPendingPushes()).toBe(true);
    });

    it('removes local key when server has null data but updatedAt is set', async () => {
      mockFetchJson({
        th_workouts: { data: null, updatedAt: '2024-06-15T00:00:00Z' },
      });
      localStorage.getItem.mockReturnValue(JSON.stringify({ some: 'data' }));

      const result = await pullFromServer();

      expect(result).toEqual({ ok: true, changed: true });
      expect(removeLS).toHaveBeenCalledWith('th_workouts');
    });

    it('server overwrites local for non-object data (arrays)', async () => {
      const serverData = ['item1', 'item2'];
      const localData = ['old1'];
      mockFetchJson({
        th_workouts: { data: serverData, updatedAt: '2024-01-01' },
      });
      localStorage.getItem.mockReturnValue(JSON.stringify(localData));

      const result = await pullFromServer();

      expect(result).toEqual({ ok: true, changed: true });
      // Arrays are not merged — server overwrites
      expect(writeLS).toHaveBeenCalledWith('th_workouts', ['item1', 'item2']);
    });

    it('returns ok=false and changed=false on network failure', async () => {
      mockFetchFail();

      const result = await pullFromServer();

      expect(result).toEqual({ ok: false, changed: false });
      expect(writeLS).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // flushPendingPushes
  // =========================================================================
  describe('flushPendingPushes', () => {
    it('flushes queued keys immediately without waiting for debounce', async () => {
      // Queue a push via pushToServer (this sets a 500ms debounce timer)
      pushToServer('th_workouts', { some: 'data' });
      expect(hasPendingPushes()).toBe(true);

      // Mock fetch for the flush and readLS for reading current data
      readLS.mockReturnValue({ some: 'data' });
      mockFetchOk();

      // Flush immediately — should fire fetch without advancing timers
      const flushPromise = flushPendingPushes();
      // Advance just enough for the promise to resolve
      await vi.advanceTimersByTimeAsync(0);
      await flushPromise;

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/data/th_workouts'),
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(hasPendingPushes()).toBe(false);
    });

    it('is a noop when nothing is pending', async () => {
      expect(hasPendingPushes()).toBe(false);

      await flushPendingPushes();

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // pushToServer
  // =========================================================================
  describe('pushToServer', () => {
    it('debounces multiple writes to the same key — only one fetch fires', async () => {
      mockFetchOk();

      // Rapid-fire three pushes for the same key
      pushToServer('th_logs', { v: 1 });
      pushToServer('th_logs', { v: 2 });
      pushToServer('th_logs', { v: 3 });

      // Advance past the 500ms debounce
      await vi.advanceTimersByTimeAsync(600);

      // Only one fetch should have fired (the last one)
      expect(fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body).toEqual({ data: { v: 3 } });
    });
  });
});
