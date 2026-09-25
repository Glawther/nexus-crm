/**
 * Nexus CRM - Enterprise Service Worker (PWA & Offline Resilience)
 * Tríade CID: Disponibilidade (D)
 */

const CACHE_NAME = 'nexus-crm-v2.0.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/landing.html',
  '/manifest.json',
  '/assets/icon.svg',
  '/css/design-tokens.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/animations.css',
  '/js/app.js',
  '/js/core/config.js',
  '/js/core/crm-store.js',
  '/js/core/storage-manager.js',
  '/js/core/theme-manager.js',
  '/js/ui/ui-renderer.js',
  '/js/services/auth-service.js',
  '/js/services/employee-service.js',
  '/js/services/billing-service.js',
  '/js/services/audit-service.js',
  '/js/services/notification-service.js',
  '/js/services/team-invite-service.js',
  '/js/services/whatsapp-service.js',
  '/js/services/webhook-service.js',
  '/js/services/firebase-service.js',
  '/js/services/gemini-service.js',
  '/js/services/export-service.js',
  '/js/config.js',
  '/js/theme-manager.js',
  '/js/auth-service.js',
  '/js/employee-service.js',
  '/js/billing-service.js',
  '/js/audit-service.js',
  '/js/notification-service.js',
  '/js/team-invite-service.js',
  '/js/whatsapp-service.js',
  '/js/webhook-service.js',
  '/js/crm-store.js',
  '/js/storage-manager.js',
  '/js/firebase-service.js',
  '/js/gemini-service.js',
  '/js/export-service.js',
  '/js/ui-renderer.js'
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
