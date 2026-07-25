// Lokasi: public/sw.js
// Service Worker MANSATAS PWA & Capacitor Hybrid Cache
// Strategy: Stale-While-Revalidate untuk static assets & JS bundles (Buka UI 0 Detik),
// Network-First dengan Cache Fallback untuk HTML & API data (Data Fresh + Support Offline).

const CACHE_NAME = 'mansatas-v5'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
]

// Listen message SKIP_WAITING
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Install — cache static core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

// Activate — hapus cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET dan non-http(s)
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith('http')) return

  const url = new URL(event.request.url)

  // ── Strategy 1: Stale-While-Revalidate untuk static bundle Next.js, font, dan image asset ──
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|eot|css)$/i)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request)
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone())
            }
            return networkResponse
          })
          .catch(() => cachedResponse)

        // Return cache instan jika ada, atau tunggu fetch jika belum pernah di-cache
        return cachedResponse || fetchPromise
      })
    )
    return
  }

  // ── Strategy 2: Network-First dengan Cache Fallback untuk Halaman HTML & API Data ──
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Jika response sukses (200), simpan clone-nya ke cache
        if (response && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(async () => {
        // Jika network gagal / offline -> ambil dari cache sebagai fallback
        const cached = await caches.match(event.request)
        if (cached) return cached

        // Jika halaman utama yang diakses offline & belum ada cache, fallback ke root '/'
        if (event.request.mode === 'navigate') {
          const rootCache = await caches.match('/')
          if (rootCache) return rootCache
        }

        return new Response('Offline: Data tidak tersedia di cache', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      })
  )
})

// ==========================================
// Web Push Notifications
// ==========================================

self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
        url: data.url,
      },
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true,
        })
        .then(function (clientList) {
          if (clients.openWindow) {
            return clients.openWindow(event.notification.data.url)
          }
        })
    )
  } else {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(function (clientList) {
        for (let i = 0; i < clientList.length; i++) {
          let client = clientList[i]
          if (client.url == '/' && 'focus' in client) return client.focus()
        }
        if (clients.openWindow) {
          return clients.openWindow('/')
        }
      })
    )
  }
})
