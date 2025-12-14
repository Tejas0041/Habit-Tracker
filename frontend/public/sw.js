// Service Worker for Habit Tracker PWA
const CACHE_NAME = 'habit-tracker-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy
  event.respondWith(
    fetch(event.request)
      .then(response => response)
      .catch(() => {
        return caches.match(event.request).then(cachedResponse => {
          return cachedResponse || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});
