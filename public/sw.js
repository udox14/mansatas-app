// Service Worker MANSATAS PWA & Capacitor Hybrid.
// Hanya aset publik yang disimpan. Halaman terautentikasi dan API tidak di-cache
// agar data akun tidak tertinggal di Cache Storage pada perangkat bersama.

const CACHE_NAME = 'mansatas-static-v7'
const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return

  const url = new URL(event.request.url)
  const sameOrigin = url.origin === self.location.origin
  const isStaticAsset =
    sameOrigin &&
    (
      url.pathname.startsWith('/_next/static/') ||
      url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|eot|css)$/i)
    )

  if (isStaticAsset) {
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

        return cachedResponse || fetchPromise
      })
    )
    return
  }

  // Navigasi selalu dari jaringan. Fallback offline tidak memuat data pengguna.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => (
        (await caches.match('/offline.html')) ||
        new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      ))
    )
  }
  // API dan request non-aset lainnya sengaja tidak diintersepsi.
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'MANSATAS App', body: event.data.text() }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      url: data.url || '/',
    },
  }
  event.waitUntil(self.registration.showNotification(data.title || 'MANSATAS App', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            await client.focus()
            if ('navigate' in client) await client.navigate(targetUrl)
            return
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
      })
  )
})
