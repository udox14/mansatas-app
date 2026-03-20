// utils/cache.ts
// Helper query untuk data statis — dipanggil dari Server Components
// Next.js 16 + Cloudflare Workers: cache dihandle di level page via revalidatePath
// Tidak menggunakan unstable_cache / 'use cache' directive agar kompatibel

import { getDB } from './db'

// ============================================================
// TAHUN AJARAN AKTIF
// ============================================================
export async function getTahunAjaranAktifCached() {
  const db = await getDB()
  const row = await db
    .prepare('SELECT id, nama, semester, daftar_jurusan FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<any>()
  return row ?? null
}

// ============================================================
// MASTER PELANGGARAN
// ============================================================
export async function getMasterPelanggaranCached() {
  const db = await getDB()
  const result = await db
    .prepare('SELECT id, kategori, nama_pelanggaran, poin FROM master_pelanggaran ORDER BY poin ASC')
    .all<any>()
  return result.results ?? []
}

// ============================================================
// DAFTAR MAPEL
// ============================================================
export async function getDaftarMapelCached() {
  const db = await getDB()
  const result = await db
    .prepare('SELECT id, nama_mapel, kode_mapel, kelompok, tingkat, kategori FROM mata_pelajaran ORDER BY nama_mapel ASC')
    .all<any>()
  return result.results ?? []
}

