import { describe, it, expect } from 'vitest';
import { resolveRestDuration } from './resolveRestDuration.js';

describe('resolveRestDuration', () => {
  describe('solo exercise (not in superset)', () => {
    it('returns explicit restDuration when set', () => {
      expect(resolveRestDuration({ restDuration: 60 }, false, 90)).toBe(60);
    });

    it('returns global default when restDuration is null', () => {
      expect(resolveRestDuration({ restDuration: null }, false, 90)).toBe(90);
    });

    it('returns global default when restDuration is undefined', () => {
      expect(resolveRestDuration({}, false, 90)).toBe(90);
    });

    it('returns global default when restDuration is 0 (not valid)', () => {
      expect(resolveRestDuration({ restDuration: 0 }, false, 90)).toBe(90);
    });

    it.each([30, 90, 180])('returns global default of %i for solo fallback', (val) => {
      expect(resolveRestDuration({ restDuration: null }, false, val)).toBe(val);
    });
  });

  describe('superset exercise (round-based rest)', () => {
    // In a superset the round only rests after its LAST movement; completing an
    // earlier movement flows straight into the next exercise with no timer.
    it('returns null for a non-last movement (no rest mid-round)', () => {
      expect(resolveRestDuration({ restDuration: null }, true, 90, false)).toBeNull();
      expect(resolveRestDuration({}, true, 90, false)).toBeNull();
    });

    it('suppresses even an explicit restDuration on a non-last movement', () => {
      expect(resolveRestDuration({ restDuration: 45 }, true, 90, false)).toBeNull();
    });

    it('rests with the global default after the last movement of the round', () => {
      expect(resolveRestDuration({ restDuration: null }, true, 90, true)).toBe(90);
      expect(resolveRestDuration({}, true, 90, true)).toBe(90);
    });

    it('honors an explicit restDuration at the round boundary', () => {
      expect(resolveRestDuration({ restDuration: 45 }, true, 90, true)).toBe(45);
    });

    it('treats the movement as the round boundary when position is omitted (back-compat)', () => {
      expect(resolveRestDuration({}, true, 90)).toBe(90);
      expect(resolveRestDuration({ restDuration: 45 }, true, 90)).toBe(45);
    });
  });
});
