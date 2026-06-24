// Shizu Service Worker — shell/asset caching + offline fallback
// Version: bump CACHE_VERSION when cache-breaking changes are deployed.
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `shizu-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `shizu-assets-${CACHE_VERSION}`;

// Pre-cached at install time so the offline page is always available.
const PRECACHE = ['/offline.html', '/icons/icon-192.png'];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Let API calls go straight to the network — no caching.
  if (url.pathname.startsWith('/api/')) return;

  // Navigation: network-first, fall back to offline page when unreachable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html')),
    );
    return;
  }

  // Next.js static chunks (_next/static/): cache-first, immutable filenames.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Public icons/assets: cache-first.
  if (
    url.pathname.startsWith('/icons/') ||
    /\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }
});

// ── Push handlers (reserved — not implemented in this build) ──────────────────
// Uncomment and implement when WhatsApp-independent push notifications are added.
//
// self.addEventListener('push', (event) => {
//   const data = event.data?.json() ?? {};
//   event.waitUntil(
//     self.registration.showNotification(data.title ?? 'Shizu', {
//       body: data.body,
//       icon: '/icons/icon-192.png',
//       badge: '/icons/icon-192.png',
//       data: { url: data.url ?? '/fr' },
//     }),
//   );
// });
//
// self.addEventListener('notificationclick', (event) => {
//   event.notification.close();
//   event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/fr'));
// });
// ─────────────────────────────────────────────────────────────────────────────
