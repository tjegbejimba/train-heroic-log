const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Returns true if the browser supports Web Push Notifications.
 * Covers: iOS < 16.4, non-HTTPS contexts, older WebViews.
 */
export function notificationsSupported() {
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Request notification permission.
 * Returns 'granted' | 'denied' | 'default' | 'unavailable'
 */
export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unavailable';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'unavailable';
  }
}

/**
 * Fetch VAPID public key, subscribe via pushManager, POST to server.
 * Returns true on success, false on any failure.
 */
export async function subscribeToPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const keyRes = await fetch(`${API_BASE}/push/vapid-public-key`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!keyRes.ok) return false;
    const { publicKey } = await keyRes.json();

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const subRes = await fetch(`${API_BASE}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
      signal: AbortSignal.timeout(5000),
    });
    return subRes.ok;
  } catch (err) {
    console.warn('Push subscription failed:', err);
    return false;
  }
}

/**
 * Remove push subscription from browser and server.
 */
export async function unsubscribeFromPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await fetch(`${API_BASE}/push/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
      await subscription.unsubscribe();
    }
    return true;
  } catch (err) {
    console.warn('Push unsubscribe failed:', err);
    return false;
  }
}

/**
 * Save (or clear) the daily workout reminder config on the server.
 * @param {string|null} time — "HH:MM" in 24h, or null to disable
 * @returns {boolean} success
 */
export async function saveReminderConfig(time) {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch(`${API_BASE}/push/reminder-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time, timezone }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch (err) {
    console.warn('saveReminderConfig failed:', err);
    return false;
  }
}

/**
 * Show a local notification via the SW registration — no server round-trip.
 * Works offline. Silently no-ops if unsupported or permission not granted.
 */
export async function showLocalNotification(title, options = {}) {
  if (!notificationsSupported()) return;
  if (Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'trainlog',
      renotify: false,
      silent: false,
      ...options,
    });
  } catch (err) {
    console.warn('showLocalNotification failed:', err);
  }
}
