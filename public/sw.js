// Lokasi: public/sw.js
// Service Worker MANSATAS PWA
// Strategy: cache-first untuk static assets, network-first untuk halaman

const CACHE_NAME = 'mansatas-v1'
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
]

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
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

// Fetch — network-first untuk semua request (data selalu fresh)
// Fallback ke cache jika offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET dan chrome-extension
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith('http')) return

  // Static assets (_next/static) → cache-first
  if (event.request.url.includes('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return response
        })
      })
    )
    return
  }

  // Semua request lain → network-first, fallback offline page
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request)
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
        url: data.url // URL untuk di-redirect saat notifikasi diklik
      }
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(function (clientList) {
      // Buka URL jika ada di data notifikasi
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    }))
  } else {
    event.waitUntil(
      clients.matchAll({
        type: "window"
      }).then(function (clientList) {
        for (let i = 0; i < clientList.length; i++) {
          let client = clientList[i]
          if (client.url == '/' && 'focus' in client)
            return client.focus()
        }
        if (clients.openWindow) {
          return clients.openWindow('/')
        }
      })
    )
  }
})
