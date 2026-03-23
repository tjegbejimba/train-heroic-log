const CACHE_NAME = 'trainlog-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn('Failed to cache app shell:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
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

// Fetch event - cache-first strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (request.url.startsWith('http') && !request.url.startsWith(self.location.origin)) {
    return;
  }

  // Cache-first strategy
  event.respondWith(
    caches.match(request).then((response) => {
      // Return from cache if found
      if (response) {
        return response;
      }

      // Try network
      return fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response && response.status === 200 && response.type !== 'error') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to index.html for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return null;
        });
    })
  );
});
