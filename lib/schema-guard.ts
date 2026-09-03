// lib/schema-guard.ts
// Mencegah DDL (CREATE TABLE/INDEX IF NOT EXISTS) dijalankan berulang-ulang di
// setiap request. Sebelumnya banyak fungsi ensure*Table mengeksekusi 1-11
// statement D1 PER PANGGILAN, padahal tabel sudah ada sejak lama — ini boros
// CPU/subrequest (dulu jadi penyumbang besar quota CPU ms).
//
// Cara kerja (defensif, tidak mengubah perilaku fitur):
//   1. Flag in-memory per-isolate — setelah ensure jalan sekali, request lain di
//      isolate yang sama langsung skip tanpa sentuh KV/D1.
//   2. Sentinel KV (NEXT_INC_CACHE_KV) dengan TTL — DDL cukup jalan ~sekali per
//      deployment di seluruh isolate. TTL memberi jaring pengaman: bila suatu
//      saat DB direstore kosong, flag kedaluwarsa dan DDL akan dijalankan lagi.
//   3. Bila KV tidak tersedia/gagal, fallback ke perilaku lama (DDL jalan).
//
// PENTING: bila suatu guard menambahkan tabel/index BARU, naikkan konstanta
// SCHEMA_VERSION di bawah ini supaya deployment berikutnya menjalankan DDL
// yang baru. Jangan ubah SCHEMA_VERSION tanpa menambah schema.

import { getCloudflareContext } from '@opennextjs/cloudflare'

const SCHEMA_VERSION = 'v2'
const KV_FLAG_TTL = 90 * 24 * 60 * 60 // 90 hari

const moduleFlags = new Map<string, Promise<void>>()

async function getKV(): Promise<KVNamespace | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return (env.NEXT_INC_CACHE_KV as KVNamespace) ?? null
  } catch {
    return null
  }
}

export async function ensureSchemaOnce(key: string, ensure: () => Promise<unknown>): Promise<void> {
  const flagKey = `schema:${key}:${SCHEMA_VERSION}`

  const existing = moduleFlags.get(flagKey)
  if (existing) return existing

  const run = (async () => {
    const kv = await getKV()
    if (kv) {
      try {
        const done = await kv.get(flagKey)
        if (done === '1') return
      } catch {
        // abai — lanjut ke ensure
      }
    }
    await ensure()
    if (kv) {
      try {
        await kv.put(flagKey, '1', { expirationTtl: KV_FLAG_TTL })
      } catch {
        // non-fatal — ensure tetap sudah jalan
      }
    }
  })().catch((error) => {
    moduleFlags.delete(flagKey)
    throw error
  })

  moduleFlags.set(flagKey, run)
  return run
}
