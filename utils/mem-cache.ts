// utils/mem-cache.ts
// Cache in-memory per-isolate (bukan KV) dengan TTL untuk hasil komputasi berat
// yang hanya dibaca (report/dashboard). Tujuan: kurangi pengulangan query D1 +
// agregasi JS pada request-request berdekatan tanpa menambah operasi KV.
//
// - Ber-TTL sehingga data otomatis segar kembali (di sini default 60 detik).
// - Bounded (maksimum entri) supaya memory worker tidak membengkak.
// - clearMemCache() dipanggil dari aksi tulis absensi supaya penulis langsung
//   melihat data baru; isolate lain paling lambat 60 detik segar (sesuai toleransi).
// - Karena in-memory, tidak ada serialisasi — nilai asli (termasuk Map) disimpan.

type CacheEntry = { expires: number; value: unknown }

const MAX_ENTRIES = 60
const DEFAULT_TTL_MS = 60_000

const store = new Map<string, CacheEntry>()

function sweepIfNeeded() {
  if (store.size < MAX_ENTRIES) return
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.expires <= now) store.delete(key)
  }
  if (store.size >= MAX_ENTRIES) {
    let oldestKey: string | null = null
    let oldestExp = Infinity
    for (const [key, entry] of store) {
      if (entry.expires < oldestExp) {
        oldestExp = entry.expires
        oldestKey = key
      }
    }
    if (oldestKey) store.delete(oldestKey)
  }
}

export function getMemCache<T>(key: string): T | undefined {
  const entry = store.get(key)
  if (!entry) return undefined
  if (entry.expires <= Date.now()) {
    store.delete(key)
    return undefined
  }
  return entry.value as T
}

export function setMemCache<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  sweepIfNeeded()
  store.set(key, { expires: Date.now() + ttlMs, value })
}

export function clearMemCache(): void {
  store.clear()
}

export function deleteMemCache(key: string): void {
  store.delete(key)
}

/** Hapus semua entri yang key-nya diawali prefix (mis. invalidasi per modul). */
export function clearMemCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
