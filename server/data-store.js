import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { VALID_KEYS } from './data-utils.js';
import { canonical, equal, mergeChanges, proposal, valueAt } from './sync-protocol.js';

export function createDataStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const metadataKey = 'sync_metadata';
  function atomicWrite(key, value) {
    const target = path.join(dir, `${key}.json`);
    const temporary = `${target}.tmp`;
    const fd = fs.openSync(temporary, 'w', 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify(value, null, 2));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, target);
    const directory = fs.openSync(dir, 'r');
    try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  }
  function recover() {
    const pending = read('sync_transaction');
    if (!pending) return;
    for (const [key, value] of Object.entries(pending.updates)) {
      if (![...VALID_KEYS, metadataKey].includes(key)) throw new Error('Invalid transaction key');
      atomicWrite(key, value);
    }
    atomicWrite('sync_transaction', null);
  }
  function read(key) {
    const file = path.join(dir, `${key}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  function entry(key) {
    const file = path.join(dir, `${key}.json`);
    return {
      data: read(key), syncVersion: 2,
      updatedAt: fs.existsSync(file) ? fs.statSync(file).mtime.toISOString() : null,
    };
  }
  function snapshot() {
    return Object.fromEntries(VALID_KEYS.map((key) => [key, read(key)]));
  }
  function metadata() {
    return read(metadataKey) || { coachEnabled: false, conflicts: [], receipts: [] };
  }
  function commit(updates, meta = metadata()) {
    recover();
    for (const conflict of meta.conflicts) {
      if (conflict.resolvedAt || !Object.hasOwn(updates, conflict.key)) continue;
      const current = proposal(valueAt(updates[conflict.key], conflict.path));
      if (!equal(current, conflict.remote)) {
        conflict.previousRemotes = [...(conflict.previousRemotes || []), conflict.remote];
        conflict.remote = current;
      }
    }
    const ordered = Object.fromEntries(
      ['th_templates', 'th_workouts', 'th_schedule', 'th_logs', 'th_active', 'th_yt_links']
        .filter((key) => Object.hasOwn(updates, key)).map((key) => [key, updates[key]]),
    );
    atomicWrite('sync_transaction', { updates: { ...ordered, [metadataKey]: meta } });
    recover();
  }
  function sync(updates, bases, unknownBases = []) {
    recover();
    const meta = metadata();
    const writes = {};
    for (const [key, data] of Object.entries(updates)) {
      const remote = read(key);
      const result = unknownBases.includes(key) && remote !== null && !equal(data, remote)
        ? { data: remote, conflicts: [{ path: [], reason: 'baseline-unavailable', base: proposal(null), local: proposal(data), remote: proposal(remote) }] }
        : mergeChanges(bases[key] ?? null, data, remote);
      if (!equal(result.data, remote)) writes[key] = result.data ?? null;
      for (const conflict of result.conflicts) {
        const duplicate = meta.conflicts.some((existing) =>
          !existing.resolvedAt && existing.key === key && equal(existing.path, conflict.path) &&
          equal(existing.local, conflict.local) && equal(existing.remote, conflict.remote),
        );
        if (!duplicate) meta.conflicts.push({ id: randomUUID(), key, ...conflict, createdAt: new Date().toISOString() });
      }
    }
    commit(writes, meta);
    return meta.conflicts.filter((conflict) => !conflict.resolvedAt);
  }
  recover();
  return {
    read, entry, snapshot, metadata, commit, sync, recover,
    revision: () => createHash('sha256').update(canonical(snapshot())).digest('hex'),
  };
}
