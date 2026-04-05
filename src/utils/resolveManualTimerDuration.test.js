import { describe, it, expect } from 'vitest';
import { resolveManualTimerDuration } from './resolveManualTimerDuration.js';

describe('resolveManualTimerDuration', () => {
  const GLOBAL_DEFAULT = 90;

  it('returns exercise restDuration when explicitly set', () => {
    expect(resolveManualTimerDuration({ restDuration: 60 }, GLOBAL_DEFAULT)).toBe(60);
  });

  it('returns global default when restDuration is null', () => {
    expect(resolveManualTimerDuration({ restDuration: null }, GLOBAL_DEFAULT)).toBe(GLOBAL_DEFAULT);
  });

  it('returns global default when restDuration is undefined', () => {
    expect(resolveManualTimerDuration({}, GLOBAL_DEFAULT)).toBe(GLOBAL_DEFAULT);
  });

  it('returns global default when exercise is null', () => {
    expect(resolveManualTimerDuration(null, GLOBAL_DEFAULT)).toBe(GLOBAL_DEFAULT);
  });

  it('returns global default when restDuration is 0', () => {
    expect(resolveManualTimerDuration({ restDuration: 0 }, GLOBAL_DEFAULT)).toBe(GLOBAL_DEFAULT);
  });

  it('returns various explicit durations', () => {
    expect(resolveManualTimerDuration({ restDuration: 30 }, GLOBAL_DEFAULT)).toBe(30);
    expect(resolveManualTimerDuration({ restDuration: 180 }, GLOBAL_DEFAULT)).toBe(180);
  });
});
