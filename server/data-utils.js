/**
 * Pure utility functions for the TrainLog data API.
 * Extracted from index.js for testability.
 */

import path from 'path';

// Valid storage keys (mirrors localStorage keys in the frontend)
export const VALID_KEYS = [
  'th_workouts',
  'th_schedule',
  'th_yt_links',
  'th_logs',
  'th_active',
  'th_templates',
];

/**
 * Returns true if the given key is in the VALID_KEYS allow-list.
 */
export function isValidKey(key) {
  return VALID_KEYS.includes(key);
}

/**
 * Build the absolute file path for a given data key.
 * @param {string} dataDir - The data directory path
 * @param {string} key - The storage key
 * @returns {string} Absolute path to the JSON file
 */
export function dataFilePath(dataDir, key) {
  return path.join(dataDir, `${key}.json`);
}

/**
 * Safely parse JSON, returning null on failure.
 * This is the pure core of readData — the caller handles fs.
 * @param {string} raw - Raw file contents
 * @returns {any|null} Parsed value, or null if invalid JSON
 */
export function safeParseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Validate a bulk write payload: only VALID_KEYS are accepted.
 * Returns an object with { validKeys, ignoredKeys }.
 * @param {object} payload - The request body for bulk write
 * @returns {{ validKeys: string[], ignoredKeys: string[] }}
 */
export function validateBulkPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { validKeys: [], ignoredKeys: [] };
  }
  const validKeys = [];
  const ignoredKeys = [];
  for (const key of Object.keys(payload)) {
    if (VALID_KEYS.includes(key)) {
      validKeys.push(key);
    } else {
      ignoredKeys.push(key);
    }
  }
  return { validKeys, ignoredKeys };
}

/**
 * Validate reminder time format (HH:MM, 24-hour).
 * @param {string} time
 * @returns {boolean}
 */
export function isValidReminderTime(time) {
  return /^\d{2}:\d{2}$/.test(time);
}

/**
 * Build a cron expression from an HH:MM time string.
 * @param {string} time - "HH:MM" format
 * @returns {string} Cron expression like "30 14 * * *"
 */
export function buildCronExpression(time) {
  const [hour, minute] = time.split(':');
  return `${minute} ${hour} * * *`;
}
