// Service Worker MANSATAS PWA & Capacitor Hybrid.
// Aset publik memakai cache statis. Halaman/data akun yang sudah dibuka memakai
// cache privat perangkat dan selalu dibersihkan ketika pengguna logout/login ulang.

const CACHE_NAME = 'mansatas-static-v8'
const PRIVATE_CACHE_NAME = 'mansatas-private-v1'
const PRIVATE_CACHE_LIMIT = 100
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
  if (event.data && event.data.type === 'CLEAR_PRIVATE_CACHE') {
    event.waitUntil(caches.delete(PRIVATE_CACHE_NAME))
  }
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
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== PRIVATE_CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return

  const url = new URL(event.request.url)
  const sameOrigin = url.origin === self.location.origin
  const isAuthenticatedPath =
    url.pathname.startsWith('/dashboard') ||
    (url.pathname.startsWith('/portal-ortu') && !url.pathname.startsWith('/portal-ortu/login'))
  const isLoginPath =
    url.pathname === '/login' ||
    url.pathname.startsWith('/portal-ortu/login') ||
    url.pathname.startsWith('/api/auth/sign-out')
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

  if (sameOrigin && isLoginPath) {
    event.waitUntil(caches.delete(PRIVATE_CACHE_NAME))
  }

  // Halaman akun yang pernah dibuka tampil seketika dari cache, lalu diperbarui
  // diam-diam dari jaringan untuk kunjungan berikutnya.
  if (sameOrigin && isAuthenticatedPath && event.request.mode === 'navigate') {
    event.respondWith(
      staleWhileRevalidatePrivate(event.request, event)
    )
    return
  }

  // Next.js memakai request RSC ketika berpindah menu. Simpan versi terakhir per
  // URL agar perpindahan ke menu yang pernah dibuka masih mungkin saat offline.
  const isRscRequest =
    sameOrigin &&
    isAuthenticatedPath &&
    (event.request.headers.get('RSC') === '1' || url.searchParams.has('_rsc'))
  if (isRscRequest) {
    event.respondWith(networkFirstPrivate(event.request, normalizedRscKey(url), event))
    return
  }

  // GET API saja yang boleh masuk cache privat. Mutasi POST/PUT/DELETE tetap wajib online.
  const isPrivateApi =
    sameOrigin &&
    url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/api/auth/') &&
    !url.pathname.startsWith('/api/fcm/') &&
    !url.pathname.startsWith('/api/health')
  if (isPrivateApi) {
    event.respondWith(networkFirstPrivate(event.request, event.request, event))
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () =>
        (await caches.match('/offline.html')) || offlineResponse()
      )
    )
  }
})

function offlineResponse() {
  return new Response('Offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

function normalizedRscKey(url) {
  const keyUrl = new URL(url.href)
  keyUrl.searchParams.delete('_rsc')
  keyUrl.searchParams.set('__mansatas_cached_rsc', '1')
  return new Request(keyUrl.href, { method: 'GET' })
}

function canStorePrivate(response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return false
  try {
    const finalUrl = new URL(response.url)
    return finalUrl.pathname !== '/login' && !finalUrl.pathname.startsWith('/portal-ortu/login')
  } catch {
    return true
  }
}

async function trimPrivateCache(cache) {
  const keys = await cache.keys()
  if (keys.length <= PRIVATE_CACHE_LIMIT) return
  await Promise.all(keys.slice(0, keys.length - PRIVATE_CACHE_LIMIT).map((key) => cache.delete(key)))
}

async function storePrivate(cache, key, response) {
  if (!canStorePrivate(response)) return
  await cache.put(key, response.clone()).catch(() => {})
  await trimPrivateCache(cache)
}

async function staleWhileRevalidatePrivate(request, event) {
  const cache = await caches.open(PRIVATE_CACHE_NAME)
  const cached = await cache.match(request)
  const refresh = fetch(request)
    .then(async (response) => {
      await storePrivate(cache, request, response)
      return response
    })
    .catch(() => null)

  event.waitUntil(refresh.then(() => undefined))
  if (cached) return cached
  return (await refresh) || (await caches.match('/offline.html')) || offlineResponse()
}

async function networkFirstPrivate(request, cacheKey, event) {
  const cache = await caches.open(PRIVATE_CACHE_NAME)
  try {
    const response = await fetch(request)
    event.waitUntil(storePrivate(cache, cacheKey, response))
    return response
  } catch {
    return (await cache.match(cacheKey)) || offlineResponse()
  }
}

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
