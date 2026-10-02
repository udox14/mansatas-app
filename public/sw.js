// Service Worker MANSATAS PWA & Capacitor Hybrid.
// Aset publik memakai cache statis. Halaman/data akun yang sudah dibuka memakai
// cache privat perangkat dan selalu dibersihkan ketika pengguna logout/login ulang.

const CACHE_NAME = 'mansatas-static-v10'
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
  // Status agenda harus berasal dari server. Jangan menampilkan snapshot lama
  // (termasuk snapshot offline) sebagai bukti hadir atau belum input.
  if (sameOrigin && (url.pathname === '/dashboard/agenda' || url.pathname.startsWith('/dashboard/agenda/') ||
    url.pathname === '/dashboard/monitoring-agenda' || url.pathname.startsWith('/dashboard/monitoring-agenda/'))) {
    event.respondWith(fetch(event.request).catch(() =>
      event.request.mode === 'navigate' ? offlineResponse() : new Response('Koneksi terputus. Status agenda tidak tersedia.', { status: 503 })
    ))
    return
  }
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
    !url.pathname.startsWith('/api/agenda/') &&
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
  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="theme-color" content="#0d4f4a" />
  <title>Perangkat Offline | MANSATAS App</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
      color: #0f172a; background: #f8fafc;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    main {
      width: min(100%, 420px); padding: 28px; border: 1px solid #e2e8f0;
      border-radius: 18px; background: #fff; text-align: center;
      box-shadow: 0 12px 36px rgba(15, 23, 42, .07);
    }
    .mark {
      display: grid; place-items: center; width: 48px; height: 48px; margin: 0 auto 16px;
      border-radius: 14px; color: #fff; background: #0f766e; font-size: 24px; font-weight: bold;
    }
    h1 { margin: 0; font-size: 20px; font-weight: 700; color: #0f172a; }
    p { margin: 10px 0 20px; color: #64748b; font-size: 14px; line-height: 1.6; }
    button {
      border: 0; border-radius: 10px; padding: 12px 24px; color: #fff;
      background: #0f766e; font-weight: 700; font-size: 14px; cursor: pointer;
      transition: background 0.2s;
    }
    button:active { background: #115e59; }
  </style>
</head>
<body>
  <main>
    <div class="mark" aria-hidden="true">!</div>
    <h1>Perangkat sedang offline</h1>
    <p>
      MANSATAS App memerlukan koneksi internet untuk mengambil data madrasah terbaru.
      Periksa jaringan Anda, lalu coba kembali.
    </p>
    <button type="button" onclick="retry()">Coba Lagi</button>
  </main>
  <script>
    function retry() {
      window.location.href = '${self.location.origin}/';
    }
    window.addEventListener('online', retry);
    setInterval(function() {
      if (navigator.onLine) retry();
    }, 4000);
  </script>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
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
