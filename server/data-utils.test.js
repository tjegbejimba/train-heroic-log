import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  VALID_KEYS,
  isValidKey,
  dataFilePath,
  safeParseJSON,
  validateBulkPayload,
  isValidReminderTime,
  buildCronExpression,
} from './data-utils.js';

// ---------------------------------------------------------------------------
// VALID_KEYS
// ---------------------------------------------------------------------------
describe('VALID_KEYS', () => {
  it('contains all six expected storage keys', () => {
    expect(VALID_KEYS).toEqual([
      'th_workouts',
      'th_schedule',
      'th_yt_links',
      'th_logs',
      'th_active',
      'th_templates',
    ]);
  });

  it('has exactly 6 entries', () => {
    expect(VALID_KEYS).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// isValidKey
// ---------------------------------------------------------------------------
describe('isValidKey', () => {
  it('accepts every valid key', () => {
    for (const key of VALID_KEYS) {
      expect(isValidKey(key)).toBe(true);
    }
  });

  it('rejects an unknown key', () => {
    expect(isValidKey('th_unknown')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidKey('')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidKey(undefined)).toBe(false);
  });

  it('rejects a key with a path traversal attempt', () => {
    expect(isValidKey('../etc/passwd')).toBe(false);
  });

  it('rejects a key that is a substring of a valid key', () => {
    expect(isValidKey('th_work')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dataFilePath
// ---------------------------------------------------------------------------
describe('dataFilePath', () => {
  it('appends .json to the key inside the data directory', () => {
    const result = dataFilePath('/srv/data', 'th_logs');
    expect(result).toBe(path.join('/srv/data', 'th_logs.json'));
  });

  it('works with a trailing-slash data dir', () => {
    // path.join normalizes this
    const result = dataFilePath('/srv/data/', 'th_workouts');
    expect(result).toBe(path.join('/srv/data', 'th_workouts.json'));
  });

  it('builds a correct relative path when dataDir is relative', () => {
    const result = dataFilePath('data', 'th_active');
    expect(result).toBe(path.join('data', 'th_active.json'));
  });
});

// ---------------------------------------------------------------------------
// safeParseJSON
// ---------------------------------------------------------------------------
describe('safeParseJSON', () => {
  it('parses a valid JSON object', () => {
    expect(safeParseJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses a valid JSON array', () => {
    expect(safeParseJSON('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('parses a JSON string value', () => {
    expect(safeParseJSON('"hello"')).toBe('hello');
  });

  it('parses null literal', () => {
    expect(safeParseJSON('null')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(safeParseJSON('{bad json}')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(safeParseJSON('')).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(safeParseJSON(undefined)).toBeNull();
  });

  it('returns null for a truncated JSON object', () => {
    expect(safeParseJSON('{"key": "val')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateBulkPayload
// ---------------------------------------------------------------------------
describe('validateBulkPayload', () => {
  it('returns all keys as valid when payload has only valid keys', () => {
    const payload = { th_workouts: {}, th_logs: [] };
    const result = validateBulkPayload(payload);
    expect(result.validKeys).toEqual(['th_workouts', 'th_logs']);
    expect(result.ignoredKeys).toEqual([]);
  });

  it('separates invalid keys into ignoredKeys', () => {
    const payload = { th_workouts: {}, bad_key: 'nope' };
    const result = validateBulkPayload(payload);
    expect(result.validKeys).toEqual(['th_workouts']);
    expect(result.ignoredKeys).toEqual(['bad_key']);
  });

  it('returns empty arrays for null payload', () => {
    const result = validateBulkPayload(null);
    expect(result.validKeys).toEqual([]);
    expect(result.ignoredKeys).toEqual([]);
  });

  it('returns empty arrays for undefined payload', () => {
    const result = validateBulkPayload(undefined);
    expect(result.validKeys).toEqual([]);
    expect(result.ignoredKeys).toEqual([]);
  });

  it('returns empty arrays for a non-object payload', () => {
    const result = validateBulkPayload('string');
    // String has no own enumerable keys via Object.keys, so both empty
    expect(result.validKeys).toEqual([]);
    expect(result.ignoredKeys).toEqual([]);
  });

  it('handles an empty object', () => {
    const result = validateBulkPayload({});
    expect(result.validKeys).toEqual([]);
    expect(result.ignoredKeys).toEqual([]);
  });

  it('handles a payload with all six valid keys', () => {
    const payload = Object.fromEntries(VALID_KEYS.map((k) => [k, null]));
    const result = validateBulkPayload(payload);
    expect(result.validKeys).toHaveLength(6);
    expect(result.ignoredKeys).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isValidReminderTime
// ---------------------------------------------------------------------------
describe('isValidReminderTime', () => {
  it('accepts 09:30', () => {
    expect(isValidReminderTime('09:30')).toBe(true);
  });

  it('accepts 23:59', () => {
    expect(isValidReminderTime('23:59')).toBe(true);
  });

  it('accepts 00:00', () => {
    expect(isValidReminderTime('00:00')).toBe(true);
  });

  it('rejects single-digit hour (9:30)', () => {
    expect(isValidReminderTime('9:30')).toBe(false);
  });

  it('rejects missing minutes', () => {
    expect(isValidReminderTime('09')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidReminderTime('')).toBe(false);
  });

  it('rejects non-numeric characters', () => {
    expect(isValidReminderTime('ab:cd')).toBe(false);
  });

  it('rejects three-digit hour', () => {
    expect(isValidReminderTime('123:45')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildCronExpression
// ---------------------------------------------------------------------------
describe('buildCronExpression', () => {
  it('converts 14:30 to "30 14 * * *"', () => {
    expect(buildCronExpression('14:30')).toBe('30 14 * * *');
  });

  it('converts 00:00 to "00 00 * * *"', () => {
    expect(buildCronExpression('00:00')).toBe('00 00 * * *');
  });

  it('converts 08:05 to "05 08 * * *"', () => {
    expect(buildCronExpression('08:05')).toBe('05 08 * * *');
  });

  it('preserves leading zeros', () => {
    expect(buildCronExpression('06:09')).toBe('09 06 * * *');
  });
});
