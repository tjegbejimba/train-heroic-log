import { describe, it, expect } from 'vitest';
import { getSetMeta, getUnitLabel } from './setMeta';

describe('getSetMeta', () => {
  it('returns correct meta for standard lb set', () => {
    const meta = getSetMeta({ reps: 10, weight: 135, unit: 'lb', repsUnit: 'reps' });
    expect(meta).toEqual({
      isBodyweight: false,
      isTimeWeight: false,
      isTimeReps: false,
      weightLabel: 'lb',
      repsLabel: 'Reps',
    });
  });

  it('detects bodyweight set (unit=bw)', () => {
    const meta = getSetMeta({ reps: 10, weight: null, unit: 'bw', repsUnit: 'reps' });
    expect(meta.isBodyweight).toBe(true);
    expect(meta.isTimeWeight).toBe(false);
    expect(meta.weightLabel).toBe('Weight');
  });

  it('detects bodyweight set (unit=reps)', () => {
    const meta = getSetMeta({ reps: 10, weight: null, unit: 'reps', repsUnit: 'reps' });
    expect(meta.isBodyweight).toBe(true);
  });

  it('detects timed weight (unit=sec)', () => {
    const meta = getSetMeta({ reps: 3, weight: 60, unit: 'sec', repsUnit: 'reps' });
    expect(meta.isTimeWeight).toBe(true);
    expect(meta.weightLabel).toBe('Time');
  });

  it('detects timed weight (unit=time)', () => {
    const meta = getSetMeta({ reps: 3, weight: 60, unit: 'time', repsUnit: 'reps' });
    expect(meta.isTimeWeight).toBe(true);
    expect(meta.weightLabel).toBe('Time');
  });

  it('detects timed reps (repsUnit=sec)', () => {
    const meta = getSetMeta({ reps: 60, weight: null, unit: 'bw', repsUnit: 'sec' });
    expect(meta.isTimeReps).toBe(true);
    expect(meta.repsLabel).toBe('Time');
  });

  it('detects timed reps (repsUnit=time)', () => {
    const meta = getSetMeta({ reps: 60, weight: null, unit: 'bw', repsUnit: 'time' });
    expect(meta.isTimeReps).toBe(true);
    expect(meta.repsLabel).toBe('Time');
  });

  it('handles kg unit', () => {
    const meta = getSetMeta({ reps: 5, weight: 100, unit: 'kg', repsUnit: 'reps' });
    expect(meta.weightLabel).toBe('kg');
    expect(meta.isBodyweight).toBe(false);
  });

  it('handles % unit', () => {
    const meta = getSetMeta({ reps: 5, weight: 80, unit: '%', repsUnit: 'reps' });
    expect(meta.weightLabel).toBe('%');
  });

  it('handles distance repsUnit (yd)', () => {
    const meta = getSetMeta({ reps: 100, weight: null, unit: 'bw', repsUnit: 'yd' });
    expect(meta.repsLabel).toBe('yd');
  });

  it('falls back to "Weight" for unknown unit', () => {
    const meta = getSetMeta({ reps: 5, weight: 50, unit: 'stones', repsUnit: 'reps' });
    expect(meta.weightLabel).toBe('Weight');
  });

  it('falls back to raw repsUnit for unknown repsUnit', () => {
    const meta = getSetMeta({ reps: 5, weight: 50, unit: 'lb', repsUnit: 'cal' });
    expect(meta.repsLabel).toBe('cal');
  });

  it('handles undefined repsUnit as Reps', () => {
    const meta = getSetMeta({ reps: 5, weight: 50, unit: 'lb' });
    expect(meta.repsLabel).toBe('Reps');
  });
});

describe('getUnitLabel', () => {
  it('returns label for known unit', () => {
    expect(getUnitLabel('lb')).toBe('lb');
    expect(getUnitLabel('kg')).toBe('kg');
  });

  it('returns raw string for unknown unit', () => {
    expect(getUnitLabel('stones')).toBe('stones');
  });

  it('returns empty string for falsy input', () => {
    expect(getUnitLabel(null)).toBe('');
    expect(getUnitLabel(undefined)).toBe('');
    expect(getUnitLabel('')).toBe('');
  });
});
