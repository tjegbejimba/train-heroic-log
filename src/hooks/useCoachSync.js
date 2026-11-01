import { useCallback, useEffect, useRef, useState } from 'react';
import { canApplyReplication, readReplicationConflicts, resolveReplicationConflict } from '../storage/authority';

export function useCoachSync({ blocked, pullSync }) {
  const [pending, setPending] = useState({ revision: '', conflicts: [] });
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState(false);
  const current = useRef({ blocked, pullSync, pending });
  current.current = { blocked, pullSync, pending };
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current || current.current.blocked || document.visibilityState === 'hidden' || !canApplyReplication()) return;
    busy.current = true;
    try {
      const result = await current.current.pullSync();
      if (!result.ok) throw new Error('Sync is offline. Your local edits remain on this device.');
      if (localStorage.getItem('sync_protocol_version') === '2') setPending(await readReplicationConflicts());
      setError('');
    } catch (failure) {
      console.warn('Coach sync could not refresh:', failure);
      if (current.current.pending.conflicts.length) setError(failure.message);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 500);
    const interval = setInterval(refresh, 10000);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [blocked, refresh]);

  const resolve = useCallback(async (id, choice) => {
    if (busy.current || current.current.blocked) return;
    busy.current = true;
    setResolving(true);
    setError('');
    try {
      await resolveReplicationConflict(id, choice, current.current.pending.revision);
      const result = await current.current.pullSync();
      if (!result.ok) throw new Error('The choice was saved, but this device could not refresh. Retry when online.');
      setPending(await readReplicationConflicts());
    } catch (failure) {
      setError(failure.message);
      console.error('Sync conflict resolution failed:', failure);
    } finally {
      busy.current = false;
      setResolving(false);
    }
  }, []);
  return { conflicts: pending.conflicts, error, resolving, resolve, refresh };
}
