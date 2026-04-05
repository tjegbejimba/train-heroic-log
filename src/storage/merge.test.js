import { describe, it, expect } from 'vitest';
import { deepMerge } from './merge.js';

describe('deepMerge', () => {
  it('returns server when both are flat objects (server wins)', () => {
    const local = { a: 1, b: 2 };
    const server = { a: 9, c: 3 };
    expect(deepMerge(local, server)).toEqual({ a: 9, b: 2, c: 3 });
  });

  it('preserves nested local-only fields', () => {
    const local = { a: { x: 1, y: 2 } };
    const server = { a: { x: 9 } };
    expect(deepMerge(local, server)).toEqual({ a: { x: 9, y: 2 } });
  });

  it('server wins at leaf level for nested objects', () => {
    const local = { ex: { reps: 10, notes: 'heavy' } };
    const server = { ex: { reps: 12, notes: 'light' } };
    expect(deepMerge(local, server)).toEqual({ ex: { reps: 12, notes: 'light' } });
  });

  it('arrays are overwritten by server (not merged)', () => {
    const local = { sets: [1, 2, 3] };
    const server = { sets: [4, 5] };
    expect(deepMerge(local, server)).toEqual({ sets: [4, 5] });
  });

  it('null from server overwrites local', () => {
    const local = { a: { x: 1 } };
    const server = { a: null };
    expect(deepMerge(local, server)).toEqual({ a: null });
  });

  it('returns server when local is not an object', () => {
    expect(deepMerge('string', { a: 1 })).toEqual({ a: 1 });
    expect(deepMerge(42, { a: 1 })).toEqual({ a: 1 });
    expect(deepMerge(null, { a: 1 })).toEqual({ a: 1 });
  });

  it('returns server when server is not an object', () => {
    expect(deepMerge({ a: 1 }, 'string')).toBe('string');
    expect(deepMerge({ a: 1 }, null)).toBe(null);
  });

  it('handles empty objects', () => {
    expect(deepMerge({}, { a: 1 })).toEqual({ a: 1 });
    expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 });
    expect(deepMerge({}, {})).toEqual({});
  });

  it('handles deeply nested (3+ levels)', () => {
    const local = { a: { b: { c: 1, d: 2 }, e: 3 } };
    const server = { a: { b: { c: 99 } } };
    expect(deepMerge(local, server)).toEqual({ a: { b: { c: 99, d: 2 }, e: 3 } });
  });

  it('ignores __proto__ and constructor keys from server', () => {
    const local = { a: 1 };
    const server = JSON.parse('{"a": 2, "__proto__": {"polluted": true}}');
    const result = deepMerge(local, server);
    expect(result.a).toBe(2);
    expect(({}).polluted).toBeUndefined();
  });
});
