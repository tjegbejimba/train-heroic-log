// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Criterion: "No production write path imports a legacy push, retry, or flush
 * helper directly."
 *
 * The persistence authority (`src/storage/`) is the single owner of the
 * replication engine (`src/storage/sync.js`). Any app code outside the storage
 * layer must reach replication through the authority facade, never by importing
 * the sync engine or its push/retry/flush helpers directly.
 */

const SRC_DIR = fileURLToPath(new URL('..', import.meta.url)); // -> src/

// Legacy replication helpers that must not be imported outside the storage layer.
const LEGACY_HELPERS = [
  'pushToServer',
  'pushAllToServer',
  'flushPendingPushes',
  'retryFailedPushes',
  'clearServerData',
  'hasPendingPushes',
];

function collectSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (!/\.(js|jsx)$/.test(entry)) continue;
    if (/\.test\.(js|jsx)$/.test(entry)) continue; // tests may import the engine
    // The storage layer IS the persistence authority + engine — exempt.
    if (relative(SRC_DIR, full).startsWith('storage/')) continue;
    out.push(full);
  }
  return out;
}

describe('replication ownership — the authority is the single seam', () => {
  const files = collectSourceFiles(SRC_DIR);

  it('finds application source files to inspect', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('no app file imports the sync replication engine directly', () => {
    const offenders = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      // Any import from a module path ending in "/sync" (the replication engine).
      if (/from\s+['"][^'"]*\/sync['"]/.test(src)) {
        offenders.push(relative(SRC_DIR, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no app file imports a legacy push/retry/flush helper by name', () => {
    const offenders = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const helper of LEGACY_HELPERS) {
        const importsHelper = new RegExp(
          `import[^;]*\\b${helper}\\b[^;]*from\\s+['"][^'"]*sync['"]`,
          's'
        );
        if (importsHelper.test(src)) {
          offenders.push(`${relative(SRC_DIR, file)} -> ${helper}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
