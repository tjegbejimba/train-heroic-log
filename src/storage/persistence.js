/**
 * Offline-persistence seam.
 *
 * A thin, compatibility-preserving coordinator that owns TrainLog's durable
 * data through swappable adapters. It combines:
 *
 *   - the shared {@link module:storage/registry} (what to persist, what syncs,
 *     what is backed up), and
 *   - a browser-storage adapter + a server-transport adapter (how to persist
 *     and sync).
 *
 * Because every dependency is injected, the whole seam runs against the
 * deterministic in-memory fakes in tests, and against `localStorage` + `fetch`
 * in production. It deliberately mirrors the existing `readLS`/`writeLS`
 * semantics — malformed stored data degrades to the section default, and a
 * quota-exceeded write returns a structured failure instead of throwing — so it
 * can take ownership of the data path without changing observable behavior.
 *
 * @module storage/persistence
 */

import { SECTIONS, getSection } from './registry';

function requireSection(sectionId) {
  const section = getSection(sectionId);
  if (!section) {
    throw new Error(`persistence: unknown section "${sectionId}"`);
  }
  return section;
}

/**
 * @param {Object} deps
 * @param {import('./adapters/browserStorage').StorageAdapter} deps.storage
 * @param {import('./adapters/serverTransport').TransportAdapter} deps.transport
 */
export function createPersistence({ storage, transport }) {
  if (!storage) throw new Error('createPersistence: storage adapter is required');
  if (!transport) throw new Error('createPersistence: transport adapter is required');

  /** Read a section, returning its default on absence or malformed data. */
  function read(sectionId) {
    const section = requireSection(sectionId);
    const raw = storage.getItem(section.key);
    if (raw === null || raw === undefined) return clone(section.defaultValue);
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`persistence: malformed stored data for "${section.key}" — using default`, e);
      return clone(section.defaultValue);
    }
  }

  /**
   * Write a section locally, then push it to the server if the section syncs.
   *
   * @returns {Promise<{ok: boolean, reason?: string, synced: boolean, pushed: boolean}>}
   *   `ok:false, reason:'quota'` when the local write is rejected for quota.
   */
  async function write(sectionId, value) {
    const section = requireSection(sectionId);
    try {
      storage.setItem(section.key, JSON.stringify(value));
    } catch (e) {
      if (e && e.name === 'QuotaExceededError') {
        return { ok: false, reason: 'quota', synced: false, pushed: false };
      }
      return { ok: false, reason: 'write-failed', synced: false, pushed: false };
    }
    if (!section.synced) return { ok: true, synced: false, pushed: false };
    const res = await transport.push(section.key, value);
    return { ok: true, synced: true, pushed: res.ok };
  }

  /** Remove a section locally, then push a null deletion if the section syncs. */
  async function remove(sectionId) {
    const section = requireSection(sectionId);
    storage.removeItem(section.key);
    if (!section.synced) return { ok: true, synced: false, pushed: false };
    const res = await transport.push(section.key, null);
    return { ok: true, synced: true, pushed: res.ok };
  }

  /** Read every registered section, keyed by its stable id. */
  function snapshot() {
    const out = {};
    for (const section of SECTIONS) {
      out[section.id] = read(section.id);
    }
    return out;
  }

  /**
   * Build a backup keyed by localStorage key, covering only backup sections
   * (the recovery session is excluded). Empty sections default to `{}` so a
   * restore reproduces the snapshot rather than leaving stale data behind.
   */
  function buildBackup() {
    const out = {};
    for (const section of SECTIONS) {
      if (!section.backup) continue;
      out[section.key] = read(section.id);
    }
    return out;
  }

  return { read, write, remove, snapshot, buildBackup };
}

/** Structured-clone-ish default so callers can't mutate the frozen registry defaults. */
function clone(value) {
  if (value === null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}
