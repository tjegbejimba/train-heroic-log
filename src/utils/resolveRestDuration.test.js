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

  describe('superset exercise', () => {
    it('returns explicit restDuration when set', () => {
      expect(resolveRestDuration({ restDuration: 45 }, true, 90)).toBe(45);
    });

    it('returns null when restDuration is null (no timer)', () => {
      expect(resolveRestDuration({ restDuration: null }, true, 90)).toBeNull();
    });

    it('returns null when restDuration is undefined (no timer)', () => {
      expect(resolveRestDuration({}, true, 90)).toBeNull();
    });
  });
});
