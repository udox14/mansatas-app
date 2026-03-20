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
