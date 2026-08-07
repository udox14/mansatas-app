// Lokasi: app/dashboard/tka/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { revalidatePath } from 'next/cache'
import { getMemCache, setMemCache, clearMemCachePrefix } from '@/utils/mem-cache'

export type KelasItem = {
  id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
  wali_kelas_id: string | null
}

export type TkaMapelRow = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  kelas_id: string | null
  mapel_pilihan1: string | null
  mapel_pilihan2: string | null
}

export type TkaSiswaRekapRow = {
  siswa_id: string
  nisn: string
  nama_lengkap: string
  jenis_kelamin: string
  kelas_id: string | null
  tingkat: number | null
  nomor_kelas: string | null
  kelompok: string | null
  mapel_pilihan1: string | null
  mapel_pilihan2: string | null
}

export type TkaRekapItem = {
  mapel: string
  jumlah: number
}

export type RekapFilter = {
  kelas_id?: string
  mapel?: string
  pilihan?: 1 | 2
  search?: string
}

// ============================================================
// CACHE KEYS (TKA)
// ============================================================
const CACHE_TTL = 60_000 // 60 detik
const rekapJumlahKey = (taId: string) => `tka:rekap:jumlah:${taId}`
const rekapSiswaKey = (taId: string, filter: RekapFilter) =>
  `tka:rekap:siswa:${taId}:${JSON.stringify(filter)}`

// ============================================================
// INITIAL DATA (2 query paralel — kelas 12 saja)
// ============================================================
export async function getInitialDataTka() {
  const db = await getDB()

  const [taRes, kelasRes] = await Promise.all([
    db.prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string; nama: string; semester: string }>(),
    db.prepare(`
      SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id
      FROM kelas k
      WHERE k.tingkat = 12
      ORDER BY k.tingkat ASC, k.nomor_kelas ASC, k.kelompok ASC
    `).all<KelasItem>(),
  ])

  return {
    tahunAjaranAktif: taRes,
    kelasList: kelasRes.results || [],
  }
}

// ============================================================
// GET SISWA BY KELAS (lazy load)
// ============================================================
export async function getSiswaByKelasForTka(kelasId: string, tahunAjaranId: string) {
  const db = await getDB()

  // Query utama: siswa yang punya kelas_id langsung
  const rows = await db.prepare(`
    SELECT
      s.id as siswa_id,
      s.nama_lengkap,
      s.nisn,
      s.kelas_id,
      tmp.mapel_pilihan1,
      tmp.mapel_pilihan2
    FROM siswa s
    LEFT JOIN tka_mapel_pilihan tmp
      ON tmp.siswa_id = s.id AND tmp.tahun_ajaran_id = ?
    WHERE s.kelas_id = ? AND s.status = 'aktif'
    ORDER BY s.nama_lengkap COLLATE NOCASE ASC
  `).bind(tahunAjaranId, kelasId).all<TkaMapelRow>()

  if (rows.results && rows.results.length > 0) {
    return rows.results
  }

  // Fallback: cari lewat riwayat_kelas (sistem multi-tahun ajaran)
  const fallback = await db.prepare(`
    SELECT
      s.id as siswa_id,
      s.nama_lengkap,
      s.nisn,
      s.kelas_id,
      tmp.mapel_pilihan1,
      tmp.mapel_pilihan2
    FROM riwayat_kelas rk
    JOIN siswa s ON s.id = rk.siswa_id
    LEFT JOIN tka_mapel_pilihan tmp
      ON tmp.siswa_id = s.id AND tmp.tahun_ajaran_id = ?
    WHERE rk.kelas_id = ? AND rk.tahun_ajaran_id = ? AND s.status = 'aktif'
    ORDER BY s.nama_lengkap COLLATE NOCASE ASC
  `).bind(tahunAjaranId, kelasId, tahunAjaranId).all<TkaMapelRow>()

  return fallback.results || []
}

// ============================================================
// SEARCH SISWA KELAS 12 (lazy, enter-triggered)
// ============================================================
export async function searchSiswaKelas12ForTka(query: string, tahunAjaranId: string) {
  const db = await getDB()
  const like = `%${query}%`

  // Query: siswa aktif di kelas tingkat 12, dengan fallback riwayat_kelas
  const rows = await db.prepare(`
    SELECT
      s.id as siswa_id,
      s.nama_lengkap,
      s.nisn,
      s.kelas_id,
      tmp.mapel_pilihan1,
      tmp.mapel_pilihan2
    FROM siswa s
    JOIN kelas k ON k.id = s.kelas_id
    LEFT JOIN tka_mapel_pilihan tmp
      ON tmp.siswa_id = s.id AND tmp.tahun_ajaran_id = ?
    WHERE s.status = 'aktif'
      AND k.tingkat = 12
      AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)
    ORDER BY s.nama_lengkap COLLATE NOCASE ASC
    LIMIT 50
  `).bind(tahunAjaranId, like, like).all<TkaMapelRow>()

  if (rows.results && rows.results.length > 0) {
    return rows.results
  }

  // Fallback: siswa yang ada di riwayat kelas 12 tahun ajaran ini
  const fallback = await db.prepare(`
    SELECT
      s.id as siswa_id,
      s.nama_lengkap,
      s.nisn,
      s.kelas_id,
      tmp.mapel_pilihan1,
      tmp.mapel_pilihan2
    FROM siswa s
    JOIN riwayat_kelas rk ON rk.siswa_id = s.id AND rk.tahun_ajaran_id = ?
    JOIN kelas k ON k.id = rk.kelas_id
    LEFT JOIN tka_mapel_pilihan tmp
      ON tmp.siswa_id = s.id AND tmp.tahun_ajaran_id = ?
    WHERE s.status = 'aktif'
      AND k.tingkat = 12
      AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)
    ORDER BY s.nama_lengkap COLLATE NOCASE ASC
    LIMIT 50
  `).bind(tahunAjaranId, tahunAjaranId, like, like).all<TkaMapelRow>()

  return fallback.results || []
}

// ============================================================
// BATCH SAVE MAPEL PILIHAN
// ============================================================
export async function batchSaveMapelPilihan(
  items: { siswa_id: string; mapel_pilihan1: string | null; mapel_pilihan2: string | null }[],
  tahunAjaranId: string
) {
  if (items.length === 0) return { success: true, saved: 0 }
  const db = await getDB()

  const stmts = items.map(item =>
    db.prepare(`
      INSERT INTO tka_mapel_pilihan (siswa_id, tahun_ajaran_id, mapel_pilihan1, mapel_pilihan2, updated_at)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(siswa_id, tahun_ajaran_id) DO UPDATE SET
        mapel_pilihan1 = excluded.mapel_pilihan1,
        mapel_pilihan2 = excluded.mapel_pilihan2,
        updated_at = excluded.updated_at
    `).bind(item.siswa_id, tahunAjaranId, item.mapel_pilihan1 ?? null, item.mapel_pilihan2 ?? null)
  )

  try {
    // Chunking per 100 (batasan batch D1)
    const chunkSize = 100
    for (let i = 0; i < stmts.length; i += chunkSize) {
      await db.batch(stmts.slice(i, i + chunkSize))
    }
    // Invalidate cache rekap agar data baru langsung terbaca
    clearMemCachePrefix('tka:')
    revalidatePath('/dashboard/tka')
    return { success: true, saved: items.length }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ============================================================
// REKAP JUMLAH MAPEL PILIHAN (1 & 2) — di-cache per tahun ajaran
// ============================================================
export async function getRekapMapelPilihan(tahunAjaranId: string) {
  const cacheKey = rekapJumlahKey(tahunAjaranId)
  const cached = getMemCache<{ pilihan1: TkaRekapItem[]; pilihan2: TkaRekapItem[] }>(cacheKey)
  if (cached) return cached

  const db = await getDB()

  const [rekap1, rekap2] = await Promise.all([
    db.prepare(`
      SELECT mapel_pilihan1 as mapel, COUNT(*) as jumlah
      FROM tka_mapel_pilihan
      WHERE tahun_ajaran_id = ? AND mapel_pilihan1 IS NOT NULL AND mapel_pilihan1 != ''
      GROUP BY mapel_pilihan1
    `).bind(tahunAjaranId).all<TkaRekapItem>(),
    db.prepare(`
      SELECT mapel_pilihan2 as mapel, COUNT(*) as jumlah
      FROM tka_mapel_pilihan
      WHERE tahun_ajaran_id = ? AND mapel_pilihan2 IS NOT NULL AND mapel_pilihan2 != ''
      GROUP BY mapel_pilihan2
    `).bind(tahunAjaranId).all<TkaRekapItem>(),
  ])

  const result = {
    pilihan1: rekap1.results || [],
    pilihan2: rekap2.results || [],
  }
  setMemCache(cacheKey, result, CACHE_TTL)
  return result
}

// ============================================================
// REKAP SISWA (dipakai tabel rekap + data cetak) — di-cache per filter
// Satu query ber-index; paginasi & natural sort dilakukan di client
// (skala data kecil: siswa kelas 12, maks ~300 baris).
// ============================================================
export async function getSiswaRekapTka(tahunAjaranId: string, filter: RekapFilter = {}) {
  const cacheKey = rekapSiswaKey(tahunAjaranId, filter)
  const cached = getMemCache<TkaSiswaRekapRow[]>(cacheKey)
  if (cached) return cached

  const db = await getDB()

  const conditions: string[] = ['tmp.tahun_ajaran_id = ?']
  const params: any[] = [tahunAjaranId]

  const { kelas_id, mapel, pilihan, search } = filter

  if (pilihan === 1 || pilihan === 2) {
    const col = pilihan === 1 ? 'tmp.mapel_pilihan1' : 'tmp.mapel_pilihan2'
    conditions.push(`${col} IS NOT NULL AND ${col} != ''`)
    if (mapel) {
      conditions.push(`${col} = ?`)
      params.push(mapel)
    }
  } else {
    // Tanpa filter pilihan: siswa yang sudah memilih minimal satu mapel
    conditions.push(`(
      tmp.mapel_pilihan1 IS NOT NULL AND tmp.mapel_pilihan1 != ''
      OR tmp.mapel_pilihan2 IS NOT NULL AND tmp.mapel_pilihan2 != ''
    )`)
  }

  if (kelas_id) {
    conditions.push('(s.kelas_id = ? OR rk.kelas_id = ?)')
    params.push(kelas_id, kelas_id)
  }

  if (search) {
    conditions.push('(s.nama_lengkap LIKE ? OR s.nisn LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }

  const where = conditions.join(' AND ')

  const res = await db.prepare(`
    SELECT
      s.id as siswa_id,
      s.nisn,
      s.nama_lengkap,
      s.jenis_kelamin,
      s.kelas_id,
      COALESCE(k.tingkat, rk.kelas_tingkat) as tingkat,
      COALESCE(k.nomor_kelas, rk.kelas_nomor) as nomor_kelas,
      COALESCE(k.kelompok, rk.kelas_kelompok) as kelompok,
      tmp.mapel_pilihan1,
      tmp.mapel_pilihan2
    FROM tka_mapel_pilihan tmp
    JOIN siswa s ON s.id = tmp.siswa_id
    LEFT JOIN kelas k ON k.id = s.kelas_id
    LEFT JOIN riwayat_kelas rk
      ON rk.siswa_id = s.id AND rk.tahun_ajaran_id = tmp.tahun_ajaran_id
    WHERE ${where}
    ORDER BY s.nama_lengkap COLLATE NOCASE ASC
  `).bind(...params).all<TkaSiswaRekapRow>()

  const rows = res.results || []
  setMemCache(cacheKey, rows, CACHE_TTL)
  return rows
}
