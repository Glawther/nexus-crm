/**
 * Nexus CRM - Enterprise Service Worker (PWA & Offline Resilience)
 * Tríade CID: Disponibilidade (D)
 */

const CACHE_NAME = 'nexus-crm-v1.4.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icon.svg',
  '/css/design-tokens.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/animations.css',
  '/js/config.js',
  '/js/theme-manager.js',
  '/js/auth-service.js',
  '/js/employee-service.js',
  '/js/crm-store.js',
  '/js/storage-manager.js',
  '/js/firebase-service.js',
  '/js/gemini-service.js',
  '/js/export-service.js',
  '/js/ui-renderer.js',
  '/js/app.js'
];

// Install: Cache core application assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate for app assets; Network-only for Google Cloud APIs
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Do not intercept or cache Google Cloud / Firebase / Gemini real-time requests
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('generativelanguage.googleapis.com')
  ) {
    return;
  }

  // Handle local app shell requests
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch new version in background (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {
          // Offline, use cached
        });
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests when offline
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html', { ignoreSearch: true });
        }
      });
    })
  );
});
