import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const SRC = dirname(fileURLToPath(import.meta.url));

// The active Workout view was contracted to rendering + Session intentions
// (issue #68). The next-incomplete-Set decision is owned by exactly one
// implementation — `findNextSet` in the Session module (src/session/session.js),
// which also handles the superset round-by-round rule. The standalone
// `src/utils/findNextIncompleteSet.js` duplicate (linear scan, no superset
// interleaving, and with no production caller) was retired. This guard keeps the
// duplicate from silently reappearing and diverging from the Session module.

const RETIRED_PATHS = [
  'utils/findNextIncompleteSet.js',
  'utils/findNextIncompleteSet.test.js',
];

// Import specifiers that would re-couple code to the retired duplicate.
const FORBIDDEN_IMPORT_RE =
  /(?:from|require\(|import\()\s*['"][^'"]*findNextIncompleteSet/;

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

describe('single next-incomplete-Set implementation', () => {
  it('has removed the duplicate findNextIncompleteSet util and its test', () => {
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
    expect(offenders, 'files still importing the retired duplicate').toEqual([]);
  });
});
