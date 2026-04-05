import { useState, useCallback } from 'react';
import { readLS, writeLS, removeLS } from '../storage/index';

/**
 * Factory for localStorage-backed React hooks.
 * Returns a hook that provides: { data, save, remove }
 * - save(value) — replace state entirely
 * - save(fn) — functional update (fn receives prev state)
 * - remove() — clear state + localStorage key
 */
export function createEntityHook(lsKey, defaultValue) {
  return function useEntity() {
    const [data, setData] = useState(() => readLS(lsKey, defaultValue));

    const save = useCallback((valueOrUpdater) => {
      if (typeof valueOrUpdater === 'function') {
        setData((prev) => {
          const next = valueOrUpdater(prev);
          writeLS(lsKey, next);
          return next;
        });
      } else {
        writeLS(lsKey, valueOrUpdater);
        setData(valueOrUpdater);
      }
    }, []);

    const remove = useCallback(() => {
      removeLS(lsKey);
      setData(defaultValue);
    }, []);

    return { data, save, remove };
  };
}
