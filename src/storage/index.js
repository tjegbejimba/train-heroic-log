/**
 * Thin wrapper over localStorage with JSON serialization.
 * Automatically triggers background sync to server on writes.
 */

import { pushToServer } from './sync';

export function readLS(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`Error reading localStorage key "${key}":`, e);
    return fallback;
  }
}

export function writeLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    // Background sync to server (fire-and-forget)
    pushToServer(key, value);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.error(`localStorage quota exceeded for key "${key}"`, e);
      alert('Storage limit exceeded. Try clearing old workouts.');
    } else {
      console.error(`Error writing localStorage key "${key}":`, e);
    }
    return false;
  }
}

export function removeLS(key) {
  try {
    localStorage.removeItem(key);
    // Sync removal (push null)
    pushToServer(key, null);
    return true;
  } catch (e) {
    console.error(`Error removing localStorage key "${key}":`, e);
    return false;
  }
}

export function clearLS() {
  try {
    localStorage.clear();
    return true;
  } catch (e) {
    console.error('Error clearing localStorage:', e);
    return false;
  }
}
