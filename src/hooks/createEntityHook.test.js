// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock storage before importing factory
vi.mock('../storage/index', () => {
  const store = {};
  return {
    readLS: (key, fallback) => store[key] ?? fallback,
    writeLS: (key, value) => { store[key] = value; },
    removeLS: (key) => { delete store[key]; },
    __store: store,
  };
});

import { createEntityHook } from './createEntityHook';
import { __store as store } from '../storage/index';

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
});

describe('createEntityHook', () => {
  it('reads initial state from localStorage', () => {
    store['test_key'] = { a: 1 };
    const useTest = createEntityHook('test_key', {});
    const { result } = renderHook(() => useTest());
    expect(result.current.data).toEqual({ a: 1 });
  });

  it('returns default when localStorage is empty', () => {
    const useTest = createEntityHook('test_key', { empty: true });
    const { result } = renderHook(() => useTest());
    expect(result.current.data).toEqual({ empty: true });
  });

  it('save updates state and writes to localStorage', () => {
    const useTest = createEntityHook('test_key', {});
    const { result } = renderHook(() => useTest());
    act(() => result.current.save({ b: 2 }));
    expect(result.current.data).toEqual({ b: 2 });
    expect(store['test_key']).toEqual({ b: 2 });
  });

  it('supports functional updater to avoid stale closures', () => {
    store['test_key'] = { count: 0 };
    const useTest = createEntityHook('test_key', {});
    const { result } = renderHook(() => useTest());
    act(() => result.current.save((prev) => ({ ...prev, count: prev.count + 1 })));
    expect(result.current.data).toEqual({ count: 1 });
    expect(store['test_key']).toEqual({ count: 1 });
  });

  it('remove clears state and removes from localStorage', () => {
    store['test_key'] = { a: 1 };
    const useTest = createEntityHook('test_key', null);
    const { result } = renderHook(() => useTest());
    expect(result.current.data).toEqual({ a: 1 });
    act(() => result.current.remove());
    expect(result.current.data).toBeNull();
    expect(store['test_key']).toBeUndefined();
  });
});
