/**
 * Thin wrapper over localStorage with JSON serialization
 */

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
