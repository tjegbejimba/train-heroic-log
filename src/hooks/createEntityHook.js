import { useState, useCallback } from 'react';
import { readByKey, writeByKey, removeByKey } from '../storage/authority';

/**
 * Factory for localStorage-backed React hooks.
 * Returns a hook that provides: { data, save, remove }
 * - save(value) — replace state entirely
 * - save(fn) — functional update (fn receives prev state)
 * - remove() — clear state + localStorage key
 *
 * All persistence is routed through the offline-persistence authority
 * (`src/storage/authority`), which commits locally before triggering the
 * shared background replication path.
 */
export function createEntityHook(lsKey, defaultValue) {
  return function useEntity() {
    const [data, setData] = useState(() => readByKey(lsKey, defaultValue));

    const save = useCallback((valueOrUpdater) => {
      if (typeof valueOrUpdater === 'function') {
        setData((prev) => {
          const next = valueOrUpdater(prev);
          writeByKey(lsKey, next);
          return next;
        });
      } else {
        writeByKey(lsKey, valueOrUpdater);
        setData(valueOrUpdater);
      }
    }, []);

    const remove = useCallback(() => {
      removeByKey(lsKey);
      setData(defaultValue);
    }, []);

    return { data, save, remove };
  };
}
