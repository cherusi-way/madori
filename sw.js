/* 間取りプランナー — service worker
 * Offline-first PWA shell cache. All paths are RELATIVE so this works whether the
 * app is served from a domain root or a GitHub Pages subpath (/<repo>/).
 *
 * VERSION is replaced at build time with a content hash of the built app, so every
 * deploy gets a fresh cache and clients update on their next visit. If you edit this
 * file by hand outside the build, bump VERSION yourself to invalidate old caches.
 */
const VERSION = '090041996def';
const CACHE = 'madori-' + VERSION;

// App shell — the single-file app needs no network at runtime, so this is everything.
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Tolerant precache: one missing asset shouldn't abort the whole install.
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function fromCacheWithRefresh(request, fallbackUrl) {
  return caches.open(CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') cache.put(request, res.clone());
          return res;
        })
        .catch(() => null);
      return cached || network.then((res) => res || (fallbackUrl ? cache.match(fallbackUrl) : undefined));
    })
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // app is fully self-contained; ignore cross-origin

  // Navigations → serve the cached shell instantly (offline-capable), refresh in the background.
  if (req.mode === 'navigate') {
    event.respondWith(fromCacheWithRefresh(req, './index.html'));
    return;
  }
  // Same-origin assets (icons, manifest) → cache-first with background refresh.
  event.respondWith(fromCacheWithRefresh(req));
});
