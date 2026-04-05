const LB_PLATES = [45, 35, 25, 10, 5, 2.5];
const KG_PLATES = [20, 15, 10, 5, 2.5, 1.25];
const DEFAULT_BAR = { lb: 45, kg: 20 };
const VALID_UNITS = new Set(['lb', 'kg']);

/**
 * Calculate plates needed per side of the bar.
 * @param {number} totalWeight - Target total weight
 * @param {number|null} barWeight - Bar weight (null = default for unit)
 * @param {string} unit - 'lb' or 'kg'
 * @returns {{ plates: Array<{weight: number, count: number}>, perSide: number, barWeight: number, isExact: boolean } | null}
 */
export function calculatePlates(totalWeight, barWeight, unit) {
  if (!VALID_UNITS.has(unit)) return null;

  const bar = barWeight ?? DEFAULT_BAR[unit];
  const perSide = (totalWeight - bar) / 2;

  if (perSide < 0) return null;
  if (perSide === 0) return { plates: [], perSide: 0, barWeight: bar, isExact: true };

  const available = unit === 'kg' ? KG_PLATES : LB_PLATES;
  const plates = [];
  let remaining = perSide;

  for (const plate of available) {
    if (remaining >= plate) {
      const count = Math.floor(remaining / plate);
      plates.push({ weight: plate, count });
      remaining = Math.round((remaining - plate * count) * 100) / 100;
    }
  }

  return {
    plates,
    perSide,
    barWeight: bar,
    isExact: remaining === 0,
  };
}

/**
 * Format plate breakdown as compact string.
 * @param {object|null} result - from calculatePlates
 * @returns {string|null} e.g. "2×45 + 10 + 2.5 /side"
 */
export function formatPlates(result) {
  if (result === null) return null;
  if (result.plates.length === 0) return 'Bar only';

  const parts = result.plates.map(({ weight, count }) =>
    count === 1 ? `${weight}` : `${count}×${weight}`
  );

  const str = `${parts.join(' + ')} /side`;
  return result.isExact ? str : `${str} (closest)`;
}
