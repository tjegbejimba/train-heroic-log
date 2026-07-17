import { useState, useEffect, useCallback } from 'react';
import { checkServerHealth, pullFromServer, pushAllToServer, clearServerData } from '../storage/sync';
import { getSyncedKeys } from '../storage/registry';

// Every synced durable section, sourced from the shared section registry
// (includes the recovery active-session key for crash recovery).
const ALL_KEYS = getSyncedKeys();

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

  // Listen for background push results
  useEffect(() => {
    function handleSyncPush(e) {
      const { ok } = e.detail;
      setSyncStatus(ok ? 'online' : 'offline');
      if (ok) setLastSynced(new Date().toISOString());
    }
    window.addEventListener('sync-push', handleSyncPush);
    return () => window.removeEventListener('sync-push', handleSyncPush);
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

  // Clear all data on server
  const clearServer = useCallback(async () => {
    return clearServerData(ALL_KEYS);
  }, []);

  return { syncStatus, lastSynced, pullSync, pushSync, clearServer };
}
