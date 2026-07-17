import { describe, it, expect, vi } from 'vitest';
import {
  createBrowserStorageAdapter,
  createMemoryStorageAdapter,
} from './browserStorage';

/**
 * Both the real (localStorage-backed) adapter and the in-memory fake must
 * satisfy the same contract, so the behavioural tests run against each.
 */
function realBackedAdapter() {
  const store = {};
  const storage = {
    getItem: vi.fn((k) => (k in store ? store[k] : null)),
    setItem: vi.fn((k, v) => { store[k] = String(v); }),
    removeItem: vi.fn((k) => { delete store[k]; }),
    key: vi.fn((i) => Object.keys(store)[i] ?? null),
    get length() { return Object.keys(store).length; },
  };
  return createBrowserStorageAdapter(storage);
}

describe.each([
  ['browser adapter', () => realBackedAdapter()],
  ['memory fake', () => createMemoryStorageAdapter()],
])('storage adapter contract — %s', (_name, make) => {
  it('returns null for keys that were never written', () => {
    const adapter = make();
    expect(adapter.getItem('th_missing')).toBeNull();
  });

  it('round-trips a stored string value', () => {
    const adapter = make();
    adapter.setItem('th_workouts', '{"a":1}');
    expect(adapter.getItem('th_workouts')).toBe('{"a":1}');
  });

  it('overwrites an existing value', () => {
    const adapter = make();
    adapter.setItem('th_logs', '[]');
    adapter.setItem('th_logs', '[1]');
    expect(adapter.getItem('th_logs')).toBe('[1]');
  });

  it('removes a stored value', () => {
    const adapter = make();
    adapter.setItem('th_templates', '{}');
    adapter.removeItem('th_templates');
    expect(adapter.getItem('th_templates')).toBeNull();
  });

  it('lists the keys currently present', () => {
    const adapter = make();
    adapter.setItem('th_a', '1');
    adapter.setItem('th_b', '2');
    expect(adapter.keys().sort()).toEqual(['th_a', 'th_b']);
    adapter.removeItem('th_a');
    expect(adapter.keys()).toEqual(['th_b']);
  });

  it('coerces non-string values to strings on write, like the DOM Storage API', () => {
    const adapter = make();
    adapter.setItem('th_num', 5);
    expect(adapter.getItem('th_num')).toBe('5');
  });
});

describe('memory fake — deterministic quota simulation', () => {
  it('throws a QuotaExceededError when a write would exceed the byte budget', () => {
    const adapter = createMemoryStorageAdapter({ quotaBytes: 20 });
    // Each char is 2 bytes (UTF-16), consistent with quota.js accounting.
    // key 'k' (1) + value 'x'.repeat(9) (9) = 10 chars = 20 bytes: fits exactly.
    expect(() => adapter.setItem('k', 'x'.repeat(9))).not.toThrow();
    // Adding one more char tips it over the budget.
    expect(() => adapter.setItem('k', 'x'.repeat(10))).toThrow(/quota/i);
  });

  it('names the quota error QuotaExceededError so callers can branch on it', () => {
    const adapter = createMemoryStorageAdapter({ quotaBytes: 2 });
    let caught;
    try {
      adapter.setItem('kk', 'vv');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught.name).toBe('QuotaExceededError');
  });

  it('does not persist a value that was rejected for quota', () => {
    const adapter = createMemoryStorageAdapter({ quotaBytes: 4 });
    adapter.setItem('a', 'b'); // 2 chars = 4 bytes, fits
    expect(() => adapter.setItem('a', 'toolong')).toThrow();
    // The prior good value is retained, the oversized write is discarded.
    expect(adapter.getItem('a')).toBe('b');
  });

  it('seeds from an initial snapshot', () => {
    const adapter = createMemoryStorageAdapter({ initial: { th_seed: '{"x":1}' } });
    expect(adapter.getItem('th_seed')).toBe('{"x":1}');
  });
});
