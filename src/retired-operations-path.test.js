import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const SRC = dirname(fileURLToPath(import.meta.url));

// The unused "Training Plan operations" path (src/operations/* + the
// useDataLayer adapter hook) was retired in favour of the single wired
// lifecycle in src/orchestrator.js. This guard keeps the duplicate from
// silently reappearing and diverging from production.

const RETIRED_PATHS = [
  'operations',
  'hooks/useDataLayer.js',
  'data/DESIGN.md',
];

// Import specifiers that would re-couple code to the retired path.
const FORBIDDEN_IMPORT_RE =
  /(?:from|require\(|import\()\s*['"][^'"]*(?:\/operations(?:\/|['"])|useDataLayer)/;

function collectSourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (/\.(?:js|jsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('retired Training Plan operations path', () => {
  it('has removed the unused implementation, adapter hook, and design doc', () => {
    for (const rel of RETIRED_PATHS) {
      expect(existsSync(join(SRC, rel)), `${rel} should be deleted`).toBe(false);
    }
  });

  it('is not imported by any source file', () => {
    const offenders = [];
    for (const file of collectSourceFiles(SRC)) {
      if (file === fileURLToPath(import.meta.url)) continue;
      const source = readFileSync(file, 'utf8');
      if (FORBIDDEN_IMPORT_RE.test(source)) {
        offenders.push(relative(SRC, file));
      }
    }
    expect(offenders, 'files still importing the retired path').toEqual([]);
  });
});
