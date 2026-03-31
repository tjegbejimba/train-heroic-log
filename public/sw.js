const CACHE_VERSION = 3;
const CACHE_NAME = `trainlog-v${CACHE_VERSION}`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install event - cache app shell and skip waiting to activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn('Failed to cache app shell:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up ALL old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network-first for HTML/JS/CSS, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (request.url.startsWith('http') && !request.url.startsWith(self.location.origin)) return;

  // API requests — pass through to network. Sync pulls (cache: 'reload') update the SW
  // cache on success so the app shell can load API data on repeat visits, but we never
  // serve stale cached API data: a failed pull returns { ok: false } and local data is
  // left untouched, preventing stale-cache from overwriting newer local changes.
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    if (request.cache === 'reload') {
      // Sync pull — always fetch fresh; cache the result for the app shell, never fall back
      event.respondWith(
        fetch(request).then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request.url, response.clone()));
          }
          return response;
        })
      );
    }
    // All other API calls (health checks, pushes intercepted as GET, etc.) pass through
    // to the network with no SW involvement — fast-fail when offline is the right behavior.
    return;
  }

  // Navigation requests and JS/CSS: network-first (so updates are picked up)
  if (request.mode === 'navigate' || request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(request).then((cached) => {
            return cached || (request.mode === 'navigate' ? caches.match('/index.html') : null);
          });
        })
    );
    return;
  }

  // Images and other assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type !== 'error') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      }).catch(() => null);
    })
  );
});

// Handle server-sent push notifications (Web Push / VAPID)
self.addEventListener('push', (event) => {
  let data = { title: 'TrainLog', body: '' };
  try {
    data = event.data ? event.data.json() : data;
  } catch {
    data.body = event.data ? event.data.text() : '';
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'trainlog-push',
      data: data.data || {},
    })
  );
});

// Bring app to focus (or open it) when a notification is tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow?.('/');
    })
  );
});
