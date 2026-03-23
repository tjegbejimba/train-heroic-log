import { useState, useEffect, useCallback } from 'react';
import { checkServerHealth, pullFromServer, pushAllToServer } from '../storage/sync';
import {
  LS_WORKOUTS,
  LS_SCHEDULE,
  LS_YOUTUBE_LINKS,
  LS_WORKOUT_LOGS,
  LS_ACTIVE_SESSION,
  LS_TEMPLATES,
} from '../constants';

const ALL_KEYS = [
  LS_WORKOUTS,
  LS_SCHEDULE,
  LS_YOUTUBE_LINKS,
  LS_WORKOUT_LOGS,
  LS_ACTIVE_SESSION,
  LS_TEMPLATES,
];

/**
 * Hook for managing sync state with the NAS backend.
 * Call pullSync() on startup to load server data into localStorage.
 * The storage layer handles pushing automatically on every write.
 */
export function useSync() {
  const [syncStatus, setSyncStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const [lastSynced, setLastSynced] = useState(null);

  // Check server health on mount
  useEffect(() => {
    checkServerHealth().then((ok) => {
      setSyncStatus(ok ? 'online' : 'offline');
    });
  }, []);

  // Pull from server — returns { ok, changed }
  // changed=true means local data was updated and caller should reload state
  const pullSync = useCallback(async () => {
    setSyncStatus('checking');
    const { ok, changed } = await pullFromServer();
    setSyncStatus(ok ? 'online' : 'offline');
    if (ok) setLastSynced(new Date().toISOString());
    return { ok, changed };
  }, []);

  // Push all local data to server
  const pushSync = useCallback(async () => {
    setSyncStatus('checking');
    const ok = await pushAllToServer(ALL_KEYS);
    setSyncStatus(ok ? 'online' : 'offline');
    if (ok) setLastSynced(new Date().toISOString());
    return ok;
  }, []);

  return { syncStatus, lastSynced, pullSync, pushSync };
}
