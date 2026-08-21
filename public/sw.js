// Service Worker MANSATAS PWA & Capacitor Hybrid.
// Aset publik memakai cache statis. Halaman/data akun yang sudah dibuka memakai
// cache privat perangkat dan selalu dibersihkan ketika pengguna logout/login ulang.

const CACHE_NAME = 'mansatas-static-v9'
const PRIVATE_CACHE_PREFIX = 'mansatas-private-v2-'
const PRIVATE_META_CACHE = 'mansatas-private-meta-v2'
const PRIVATE_CONTEXT_KEY = new Request(`${self.location.origin}/__mansatas_cache_context`)
const PRIVATE_CACHE_LIMIT = 100
const PRIVATE_CACHE_TTL = 24 * 60 * 60 * 1000
let activePrivateContext = null
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
  if (event.data && event.data.type === 'SET_CACHE_CONTEXT') {
    event.waitUntil(setPrivateContext(event.data.context))
  }
  if (event.data && event.data.type === 'CLEAR_PRIVATE_CACHE') {
    event.waitUntil(clearPrivateCaches())
  }
})

function isValidPrivateContext(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{8,160}$/.test(value)
}

async function getPrivateContext() {
  if (activePrivateContext) return activePrivateContext
  const response = await (await caches.open(PRIVATE_META_CACHE)).match(PRIVATE_CONTEXT_KEY)
  const value = response ? await response.text() : ''
  if (isValidPrivateContext(value)) activePrivateContext = value
  return activePrivateContext
}

async function setPrivateContext(context) {
  if (!isValidPrivateContext(context)) return
  const previous = await getPrivateContext()
  activePrivateContext = context
  await (await caches.open(PRIVATE_META_CACHE)).put(PRIVATE_CONTEXT_KEY, new Response(context))
  if (previous && previous !== context) await caches.delete(PRIVATE_CACHE_PREFIX + previous)
}

async function clearPrivateCaches() {
  activePrivateContext = null
  const keys = await caches.keys()
  await Promise.all(keys.filter(key => key.startsWith(PRIVATE_CACHE_PREFIX) || key === PRIVATE_META_CACHE).map(key => caches.delete(key)))
}

async function openPrivateCache() {
  const context = await getPrivateContext()
  return context ? caches.open(PRIVATE_CACHE_PREFIX + context) : null
}

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
          .filter((key) =>
            (key.startsWith('mansatas-static-') && key !== CACHE_NAME) ||
            key.startsWith('mansatas-private-v1')
          )
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return

  const url = new URL(event.request.url)
  const sameOrigin = url.origin === self.location.origin
  if (event.request.method !== 'GET') {
    if (sameOrigin && url.pathname.startsWith('/api/auth/sign-out')) {
      event.respondWith(fetch(event.request).then(async response => {
        await clearPrivateCaches()
        return response
      }))
    }
    return
  }
  const isAuthenticatedPath =
    url.pathname.startsWith('/dashboard') ||
    (url.pathname.startsWith('/portal-ortu') && !url.pathname.startsWith('/portal-ortu/login'))
  const isLoginPath =
    url.pathname === '/login' ||
    url.pathname.startsWith('/portal-ortu/login') ||
    url.pathname.startsWith('/api/auth/sign-out')
  const isStaticAsset =
    sameOrigin &&
    !url.pathname.startsWith('/api/') &&
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
            if (canStorePrivate(networkResponse)) {
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
    event.waitUntil(clearPrivateCaches())
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
    !url.pathname.startsWith('/api/pdf/') &&
    !url.pathname.startsWith('/api/media/') &&
    !url.pathname.startsWith('/api/komite/') &&
    !url.pathname.includes('/download') &&
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
  if (/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('cache-control') || '')) return false
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
  if (!cache || !canStorePrivate(response)) return
  const clone = response.clone()
  const headers = new Headers(clone.headers)
  headers.set('x-mansatas-cache-time', String(Date.now()))
  await cache.put(key, new Response(clone.body, {
    status: clone.status,
    statusText: clone.statusText,
    headers,
  })).catch(() => {})
  await trimPrivateCache(cache)
}

async function readFreshPrivate(cache, key) {
  if (!cache) return null
  const response = await cache.match(key)
  if (!response) return null
  const storedAt = Number(response.headers.get('x-mansatas-cache-time') || 0)
  if (!storedAt || Date.now() - storedAt > PRIVATE_CACHE_TTL) {
    await cache.delete(key)
    return null
  }
  return response
}

async function clearOnAuthFailure(response) {
  let redirectedToLogin = false
  try {
    const finalUrl = new URL(response.url)
    redirectedToLogin = finalUrl.pathname === '/login' || finalUrl.pathname.startsWith('/portal-ortu/login')
  } catch {}
  if (response.status === 401 || response.status === 403 || redirectedToLogin) await clearPrivateCaches()
}

async function staleWhileRevalidatePrivate(request, event) {
  const cache = await openPrivateCache()
  const cached = await readFreshPrivate(cache, request)
  const refresh = fetch(request)
    .then(async (response) => {
      await clearOnAuthFailure(response)
      await storePrivate(cache, request, response)
      return response
    })
    .catch(() => null)

  event.waitUntil(refresh.then(() => undefined))
  if (cached) return cached
  return (await refresh) || (await caches.match('/offline.html')) || offlineResponse()
}

async function networkFirstPrivate(request, cacheKey, event) {
  const cache = await openPrivateCache()
  try {
    const response = await fetch(request)
    await clearOnAuthFailure(response)
    event.waitUntil(storePrivate(cache, cacheKey, response))
    return response
  } catch {
    return (await readFreshPrivate(cache, cacheKey)) || offlineResponse()
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
