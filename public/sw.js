// Service worker RéviCam — Phase P5 (offline-first, bas-débit).
//
// Stratégie prudente, compatible avec l'ISR :
//   - navigations (documents) : network-first, repli sur le cache puis
//     sur la page /offline si le réseau échoue ;
//   - assets statiques same-origin (/_next/static, images, icônes) :
//     stale-while-revalidate ;
//   - jamais de mise en cache des requêtes non-GET ni des routes /api.
//
// Le versionnage du cache (CACHE) force le nettoyage des anciennes versions.

const CACHE = 'revicam-v1';
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icon') ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|gif|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigations : network-first + repli offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Assets statiques : stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
