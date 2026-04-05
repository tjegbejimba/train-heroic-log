import { describe, it, expect } from 'vitest';
import { shouldStartRestTimer } from './shouldStartRestTimer.js';

describe('shouldStartRestTimer', () => {
  it('returns true on first completion of a set', () => {
    const fired = new Set();
    expect(shouldStartRestTimer('Bench Press', 0, false, true, fired)).toBe(true);
  });

  it('adds the set key to firedSets', () => {
    const fired = new Set();
    shouldStartRestTimer('Bench Press', 0, false, true, fired);
    expect(fired.has('Bench Press::0')).toBe(true);
  });

  it('returns false if set was already completed (wasCompleted=true)', () => {
    const fired = new Set();
    expect(shouldStartRestTimer('Bench Press', 0, true, true, fired)).toBe(false);
  });

  it('returns false if set is being unchecked (isNowCompleted=false)', () => {
    const fired = new Set();
    expect(shouldStartRestTimer('Bench Press', 0, true, false, fired)).toBe(false);
    expect(shouldStartRestTimer('Bench Press', 0, false, false, fired)).toBe(false);
  });

  it('returns false on re-check of a previously fired set (re-fire bug fix)', () => {
    const fired = new Set();
    // First check → fires
    shouldStartRestTimer('Bench Press', 0, false, true, fired);
    // Simulate uncheck (doesn't remove from fired)
    // Re-check → should NOT fire
    expect(shouldStartRestTimer('Bench Press', 0, false, true, fired)).toBe(false);
  });

  it('tracks different exercises independently', () => {
    const fired = new Set();
    expect(shouldStartRestTimer('Bench Press', 0, false, true, fired)).toBe(true);
    expect(shouldStartRestTimer('Squat', 0, false, true, fired)).toBe(true);
  });

  it('tracks different set indices independently', () => {
    const fired = new Set();
    expect(shouldStartRestTimer('Bench Press', 0, false, true, fired)).toBe(true);
    expect(shouldStartRestTimer('Bench Press', 1, false, true, fired)).toBe(true);
    // Re-fire on set 0 should be blocked
    expect(shouldStartRestTimer('Bench Press', 0, false, true, fired)).toBe(false);
  });
});
