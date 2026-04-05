import { useCallback } from 'react';
import { LS_ACTIVE_SESSION } from '../constants';
import { createEntityHook } from './createEntityHook';

const useActiveBase = createEntityHook(LS_ACTIVE_SESSION, null);

/**
 * Hook for managing active/in-progress workout session (crash recovery)
 */
export function useActiveWorkout() {
  const { data: session, save, remove } = useActiveBase();

  const createSession = useCallback((logKey, startedAt) => {
    save({ logKey, startedAt });
  }, [save]);

  const updateSession = useCallback((updates) => {
    if (!session) return;
    save({ ...session, ...updates });
  }, [session, save]);

  const clearSession = useCallback(() => {
    remove();
  }, [remove]);

  return { session, createSession, updateSession, clearSession };
}
