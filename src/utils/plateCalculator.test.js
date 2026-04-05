import { describe, it, expect } from 'vitest';
import { calculatePlates, formatPlates } from './plateCalculator';

describe('calculatePlates', () => {
  it('135 lb with 45 lb bar → 1×45 /side', () => {
    const result = calculatePlates(135, 45, 'lb');
    expect(result.plates).toEqual([{ weight: 45, count: 1 }]);
    expect(result.perSide).toBe(45);
    expect(result.barWeight).toBe(45);
    expect(result.isExact).toBe(true);
  });

  it('225 lb with 45 lb bar → 2×45 /side', () => {
    const result = calculatePlates(225, 45, 'lb');
    expect(result.plates).toEqual([{ weight: 45, count: 2 }]);
    expect(result.perSide).toBe(90);
    expect(result.isExact).toBe(true);
  });

  it('185 lb with 45 lb bar → 1×45 + 1×25 /side', () => {
    const result = calculatePlates(185, 45, 'lb');
    expect(result.plates).toEqual([
      { weight: 45, count: 1 },
      { weight: 25, count: 1 },
    ]);
    expect(result.perSide).toBe(70);
    expect(result.isExact).toBe(true);
  });

  it('315 lb with 45 lb bar → 3×45 /side', () => {
    const result = calculatePlates(315, 45, 'lb');
    expect(result.plates).toEqual([{ weight: 45, count: 3 }]);
    expect(result.perSide).toBe(135);
    expect(result.isExact).toBe(true);
  });

  it('45 lb with 45 lb bar → bar only', () => {
    const result = calculatePlates(45, 45, 'lb');
    expect(result.plates).toEqual([]);
    expect(result.perSide).toBe(0);
    expect(result.barWeight).toBe(45);
    expect(result.isExact).toBe(true);
  });

  it('50 lb with 45 lb bar → 2.5 /side', () => {
    const result = calculatePlates(50, 45, 'lb');
    expect(result.plates).toEqual([{ weight: 2.5, count: 1 }]);
    expect(result.perSide).toBe(2.5);
    expect(result.isExact).toBe(true);
  });

  it('30 lb with 45 lb bar → null (weight < bar)', () => {
    expect(calculatePlates(30, 45, 'lb')).toBeNull();
  });

  it('100 kg with 20 kg bar → 2×20 /side', () => {
    const result = calculatePlates(100, 20, 'kg');
    expect(result.plates).toEqual([{ weight: 20, count: 2 }]);
    expect(result.perSide).toBe(40);
    expect(result.isExact).toBe(true);
  });

  it('60 kg with 20 kg bar → 20 /side', () => {
    const result = calculatePlates(60, 20, 'kg');
    expect(result.plates).toEqual([{ weight: 20, count: 1 }]);
    expect(result.perSide).toBe(20);
    expect(result.isExact).toBe(true);
  });

  it('null bar weight defaults to 45 lb', () => {
    const result = calculatePlates(135, null, 'lb');
    expect(result.barWeight).toBe(45);
    expect(result.plates).toEqual([{ weight: 45, count: 1 }]);
  });

  it('null bar weight + kg defaults to 20 kg', () => {
    const result = calculatePlates(60, null, 'kg');
    expect(result.barWeight).toBe(20);
    expect(result.plates).toEqual([{ weight: 20, count: 1 }]);
  });

  it('non-weight unit (bw) → null', () => {
    expect(calculatePlates(135, 45, 'bw')).toBeNull();
  });

  it('non-weight unit (%) → null', () => {
    expect(calculatePlates(80, null, '%')).toBeNull();
  });

  it('non-weight unit (RPE) → null', () => {
    expect(calculatePlates(7, null, 'RPE')).toBeNull();
  });

  it('55 lb trap bar, 145 lb total → 1×45 /side', () => {
    const result = calculatePlates(145, 55, 'lb');
    expect(result.barWeight).toBe(55);
    expect(result.plates).toEqual([{ weight: 45, count: 1 }]);
    expect(result.perSide).toBe(45);
    expect(result.isExact).toBe(true);
  });

  it('0 lb bar (machine), 90 lb total → 1×45 /side', () => {
    const result = calculatePlates(90, 0, 'lb');
    expect(result.barWeight).toBe(0);
    expect(result.plates).toEqual([{ weight: 45, count: 1 }]);
    expect(result.perSide).toBe(45);
    expect(result.isExact).toBe(true);
  });

  it('inexact weight (137 lb, 45 bar) → closest plates + isExact=false', () => {
    const result = calculatePlates(137, 45, 'lb');
    // perSide = (137-45)/2 = 46, greedy: 45 + remainder 1 (no 1 lb plate)
    expect(result.plates).toEqual([{ weight: 45, count: 1 }]);
    expect(result.isExact).toBe(false);
    expect(result.perSide).toBe(46);
  });
});

describe('formatPlates', () => {
  it('null result → null', () => {
    expect(formatPlates(null, 'lb')).toBeNull();
  });

  it('empty plates → "Bar only"', () => {
    const result = { plates: [], perSide: 0, barWeight: 45, isExact: true };
    expect(formatPlates(result, 'lb')).toBe('Bar only');
  });

  it('single plate, count 1 → "45 /side"', () => {
    const result = { plates: [{ weight: 45, count: 1 }], perSide: 45, barWeight: 45, isExact: true };
    expect(formatPlates(result, 'lb')).toBe('45 /side');
  });

  it('single plate, count > 1 → "2×45 /side"', () => {
    const result = { plates: [{ weight: 45, count: 2 }], perSide: 90, barWeight: 45, isExact: true };
    expect(formatPlates(result, 'lb')).toBe('2×45 /side');
  });

  it('multiple plates → "2×45 + 10 + 2.5 /side"', () => {
    const result = {
      plates: [
        { weight: 45, count: 2 },
        { weight: 10, count: 1 },
        { weight: 2.5, count: 1 },
      ],
      perSide: 102.5,
      barWeight: 45,
      isExact: true,
    };
    expect(formatPlates(result, 'lb')).toBe('2×45 + 10 + 2.5 /side');
  });

  it('inexact result appends "(closest)"', () => {
    const result = { plates: [{ weight: 45, count: 1 }], perSide: 46, barWeight: 45, isExact: false };
    expect(formatPlates(result, 'lb')).toBe('45 /side (closest)');
  });
});
