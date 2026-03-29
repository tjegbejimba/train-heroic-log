import { useState } from 'react';

const LS_SETTINGS = 'th_settings';
const DEFAULTS = { restDuration: 90, notificationsEnabled: false, reminderTime: null };

/**
 * Hook for managing local app preferences (not synced to server).
 */
export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_SETTINGS);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  });

  function updateSettings(updates) {
    const next = { ...settings, ...updates };
    localStorage.setItem(LS_SETTINGS, JSON.stringify(next));
    setSettings(next);
  }

  return { settings, updateSettings };
}
