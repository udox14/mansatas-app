// Lokasi: lib/offline-cache.ts
// Utility penyimpan cache data lokal untuk dukungan Hybrid Offline Mode

import { Preferences } from '@capacitor/preferences'

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttlMs: number
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24 jam default

/**
 * Menyimpan data ke cache lokal (Preferences / LocalStorage)
 */
export async function setOfflineCache<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttlMs,
    }
    const serialized = JSON.stringify(entry)

    // Coba simpan ke Capacitor Preferences
    await Preferences.set({ key: `cache_${key}`, value: serialized }).catch(() => {
      // Fallback ke localStorage jika di browser
      if (typeof window !== 'undefined') {
        localStorage.setItem(`cache_${key}`, serialized)
      }
    })
  } catch (error) {
    console.warn('[OfflineCache] Gagal menyimpan cache:', error)
  }
}

/**
 * Membaca data dari cache lokal (mengembalikan null jika expired atau tidak ada)
 */
export async function getOfflineCache<T>(key: string, ignoreExpiration: boolean = false): Promise<T | null> {
  try {
    let serialized: string | null = null

    // Coba baca dari Capacitor Preferences
    try {
      const res = await Preferences.get({ key: `cache_${key}` })
      serialized = res.value
    } catch {
      // Fallback ke localStorage jika di browser
      if (typeof window !== 'undefined') {
        serialized = localStorage.getItem(`cache_${key}`)
      }
    }

    if (!serialized) return null

    const entry: CacheEntry<T> = JSON.parse(serialized)
    const isExpired = Date.now() - entry.timestamp > entry.ttlMs

    if (isExpired && !ignoreExpiration) {
      return null
    }

    return entry.data
  } catch (error) {
    console.warn('[OfflineCache] Gagal membaca cache:', error)
    return null
  }
}

/**
 * Menghapus cache tertentu
 */
export async function removeOfflineCache(key: string): Promise<void> {
  try {
    await Preferences.remove({ key: `cache_${key}` }).catch(() => {})
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`cache_${key}`)
    }
  } catch (error) {
    console.warn('[OfflineCache] Gagal menghapus cache:', error)
  }
}
