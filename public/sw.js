/*
 * SpendCheck service worker: keeps the app itself (not your data) so it opens without a network.
 * - Pages: the network first, so a new version is picked up at once; the saved copy is used when the
 *   network is down or slow (3 seconds).
 * - Built files and icons (named by content, so they never change): saved and reused.
 * - Fonts: reused while a fresh copy is fetched.
 * Calls to the server (/.netlify/functions) are never touched: data always comes from the network, and
 * the app paints its own saved snapshot when offline.
 */
const VERSION = 'v1';
const PAGES = `spendcheck-pages-${VERSION}`;
const FILES = `spendcheck-files-${VERSION}`;
const FONTS = `spendcheck-fonts-${VERSION}`;
const KEEP = [PAGES, FILES, FONTS];
const SLOW_MS = 3000;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter(n => n.startsWith('spendcheck-') && !KEEP.includes(n)).map(n => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/.netlify/')) return;
    if (req.mode === 'navigate') return void event.respondWith(page(req));
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) return void event.respondWith(cacheFirst(req));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function page(req) {
  const cache = await caches.open(PAGES);
  const network = fetch(req).then(res => {
    if (res.ok) cache.put('/index.html', res.clone());
    return res;
  });
  try {
    return await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), SLOW_MS)),
    ]);
  } catch {
    const saved = await cache.match('/index.html');
    if (saved) return saved;
    return network;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(FILES);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then(res => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit ?? fresh;
}
