import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getQuotaUsage, getQuotaWarning, getSizeByKey } from './quota.js';

// Mock localStorage
const storage = {};
const mockLocalStorage = {
  getItem: (key) => storage[key] ?? null,
  key: (i) => Object.keys(storage)[i],
  get length() { return Object.keys(storage).length; },
};

beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k]);
  vi.stubGlobal('localStorage', mockLocalStorage);
});

describe('getQuotaUsage', () => {
  it('returns 0 for empty storage', () => {
    const { used } = getQuotaUsage();
    expect(used).toBe(0);
  });

  it('sums key + value lengths in bytes (UTF-16)', () => {
    storage['abc'] = '12345';
    // 'abc' = 3 chars, '12345' = 5 chars → 8 chars × 2 bytes = 16 bytes
    const { used } = getQuotaUsage();
    expect(used).toBe(16);
  });

  it('provides a default estimate of 5MB', () => {
    const { estimate } = getQuotaUsage();
    expect(estimate).toBe(5 * 1024 * 1024);
  });
});

describe('getQuotaWarning', () => {
  it('returns ok when usage is low', () => {
    expect(getQuotaWarning(100, 5 * 1024 * 1024).level).toBe('ok');
  });

  it('returns warning when above 70%', () => {
    const estimate = 1000;
    expect(getQuotaWarning(750, estimate).level).toBe('warning');
  });

  it('returns critical when above 90%', () => {
    const estimate = 1000;
    expect(getQuotaWarning(950, estimate).level).toBe('critical');
  });

  it('includes percentage', () => {
    const result = getQuotaWarning(500, 1000);
    expect(result.percent).toBe(50);
  });
});

describe('getSizeByKey', () => {
  it('returns size for each requested key', () => {
    storage['th_workouts'] = '{"a":1}';
    storage['th_logs'] = '[]';
    storage['unrelated'] = 'ignored';

    const sizes = getSizeByKey(['th_workouts', 'th_logs', 'th_missing']);
    expect(sizes['th_workouts']).toBe(14); // key(11) + value(7) chars × 2... wait
    // Actually: value length only (consistent with what matters for quota)
    expect(sizes['th_workouts']).toBeGreaterThan(0);
    expect(sizes['th_logs']).toBeGreaterThan(0);
    expect(sizes['th_missing']).toBe(0);
  });
});
