import { describe, it, expect } from 'vitest';
import { deepMerge, planSectionMerge } from './merge.js';

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

describe('planSectionMerge', () => {
  it('writes server data when local is absent', () => {
    const plan = planSectionMerge(null, { data: { 'Upper A': { title: 'Upper A' } }, updatedAt: '2024-01-01' });
    expect(plan.action).toBe('write');
    expect(plan.value).toEqual({ 'Upper A': { title: 'Upper A' } });
    expect(plan.serialized).toBe(JSON.stringify({ 'Upper A': { title: 'Upper A' } }));
  });

  it('is a no-op when merged data equals the stored raw string', () => {
    const data = { 'Upper A': { title: 'Upper A' } };
    const raw = JSON.stringify(data);
    expect(planSectionMerge(raw, { data, updatedAt: '2024-01-01' })).toEqual({ action: 'none' });
  });

  it('merges maps: server wins on conflict, local-only entries preserved', () => {
    const local = { exercise1: { reps: 10 }, exercise2: { reps: 5 } };
    const server = { exercise1: { reps: 12 }, exercise3: { reps: 8 } };
    const plan = planSectionMerge(JSON.stringify(local), { data: server, updatedAt: '2024-01-01' });
    expect(plan.action).toBe('write');
    expect(plan.value).toEqual({ exercise1: { reps: 12 }, exercise2: { reps: 5 }, exercise3: { reps: 8 } });
  });

  it('overwrites with server data for arrays (no merge)', () => {
    const plan = planSectionMerge(JSON.stringify(['old1']), { data: ['item1', 'item2'], updatedAt: '2024-01-01' });
    expect(plan.action).toBe('write');
    expect(plan.value).toEqual(['item1', 'item2']);
  });

  it('pushes local up when server never populated (data null, updatedAt null)', () => {
    const local = { 'Upper A': { title: 'Upper A' } };
    const plan = planSectionMerge(JSON.stringify(local), { data: null, updatedAt: null });
    expect(plan).toEqual({ action: 'push', value: local });
  });

  it('does nothing when server never populated and local is absent', () => {
    expect(planSectionMerge(null, { data: null, updatedAt: null })).toEqual({ action: 'none' });
  });

  it('removes local on an intentional server deletion (data null, updatedAt set)', () => {
    const plan = planSectionMerge(JSON.stringify({ some: 'data' }), { data: null, updatedAt: '2024-06-15T00:00:00Z' });
    expect(plan).toEqual({ action: 'remove' });
  });

  it('does nothing when server deleted a key local no longer has', () => {
    expect(planSectionMerge(null, { data: null, updatedAt: '2024-06-15T00:00:00Z' })).toEqual({ action: 'none' });
  });

  it('treats malformed local data as absent and takes the server value', () => {
    const plan = planSectionMerge('{not-json', { data: { a: 1 }, updatedAt: '2024-01-01' });
    expect(plan.action).toBe('write');
    expect(plan.value).toEqual({ a: 1 });
  });

  it('throws for an entry missing the data field so the caller skips it (no deletion)', () => {
    // A well-formed server entry always carries a `data` key (possibly null); a
    // missing `data` is malformed and must not be read as an intentional deletion.
    expect(() => planSectionMerge(JSON.stringify({ keep: 1 }), { updatedAt: '2024-01-01' })).toThrow();
  });

  it('throws for an entry with explicitly undefined data', () => {
    expect(() => planSectionMerge(null, { data: undefined, updatedAt: null })).toThrow();
  });

  it('throws for a non-object server entry', () => {
    expect(() => planSectionMerge(null, 42)).toThrow();
    expect(() => planSectionMerge(null, null)).toThrow();
    expect(() => planSectionMerge(null, [1, 2])).toThrow();
  });
});
