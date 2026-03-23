import { useState } from 'react';
import { LS_ACTIVE_SESSION } from '../constants';
import { readLS, writeLS, removeLS } from '../storage/index';

/**
 * Hook for managing active/in-progress workout session (crash recovery)
 * @returns {{ session: Object|null, createSession: Function, updateSession: Function, clearSession: Function }}
 */
export function useActiveWorkout() {
  const [session, setSession] = useState(() => {
    return readLS(LS_ACTIVE_SESSION, null);
  });

  function createSession(logKey, startedAt) {
    const newSession = {
      logKey,
      startedAt,
    };
    writeLS(LS_ACTIVE_SESSION, newSession);
    setSession(newSession);
  }

  function updateSession(updates) {
    if (!session) return;
    const updated = { ...session, ...updates };
    writeLS(LS_ACTIVE_SESSION, updated);
    setSession(updated);
  }

  function clearSession() {
    removeLS(LS_ACTIVE_SESSION);
    setSession(null);
  }

  return { session, createSession, updateSession, clearSession };
}
