// sw.js – Service Worker L'Ardoise des Vacances
const CACHE_NAME = 'ardoise-v1';
const TICKET_CACHE = 'ardoise-tickets-v1';

// Ressources à pré-cacher au premier chargement
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/src/css/app.css',
  '/src/js/app.js',
  '/src/js/modules/supabase.js',
  '/src/js/modules/auth.js',
  '/src/js/modules/planning.js',
  '/src/js/modules/ideas.js',
  '/src/js/modules/tickets.js',
  '/src/js/modules/photos.js',
  '/src/js/modules/ui.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ======== INSTALL =========
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ======== ACTIVATE =========
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== TICKET_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ======== FETCH =========
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Tickets & photos from Supabase Storage → cache-first (offline priority)
  if (url.hostname.includes('supabase') && url.pathname.includes('/storage/')) {
    event.respondWith(
      caches.open(TICKET_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // App shell & static assets → cache-first, network fallback
  if (PRECACHE_ASSETS.some(a => url.pathname === a || url.pathname.endsWith(a.split('/').pop()))) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // API calls (Supabase REST) → network-first, no cache
  if (url.hostname.includes('supabase') && url.pathname.includes('/rest/')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('{"error":"offline"}', {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Navigation → serve index.html for SPA
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then(cached => cached || fetch(event.request))
    );
    return;
  }

  // Default: network then cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ======== MESSAGE – cache ticket on demand =========
self.addEventListener('message', event => {
  if (event.data?.type === 'CACHE_TICKET') {
    const url = event.data.url;
    caches.open(TICKET_CACHE).then(cache => {
      fetch(url).then(response => {
        if (response.ok) cache.put(url, response);
      }).catch(() => {});
    });
  }
});
