// Lokasi: app/dashboard/tka/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { revalidatePath } from 'next/cache'

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

export type TkaHasilRow = {
  id: string
  siswa_id: string
  nama_lengkap: string
  nisn: string
  kelas_id: string | null
  tingkat: number | null
  nomor_kelas: string | null
  kelas_kelompok: string | null
  nomor_peserta: string | null
  nilai_bind: number | null
  kategori_bind: string | null
  nilai_mat: number | null
  kategori_mat: string | null
  nilai_bing: number | null
  kategori_bing: string | null
  mapel_pilihan1: string | null
  nilai_pilihan1: number | null
  kategori_pilihan1: string | null
  mapel_pilihan2: string | null
  nilai_pilihan2: number | null
  kategori_pilihan2: string | null
  updated_at: string
}

export type TkaRekapItem = {
  mapel: string
  pilihan: 1 | 2
  jumlah: number
}

// ============================================================
// INITIAL DATA (1 query batch)
// ============================================================
export async function getInitialDataTka(userRole: string, userId: string) {
  const db = await getDB()

  // Ambil tahun ajaran aktif + kelas list (kelas 12 saja untuk penentuan mapel)
  const [taRes, kelasRes, hasHasilRes] = await Promise.all([
    db.prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string; nama: string; semester: string }>(),
    db.prepare(`
      SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id
      FROM kelas k
      ORDER BY k.tingkat ASC, k.kelompok ASC, k.nomor_kelas ASC
    `).all<KelasItem>(),
    db.prepare('SELECT COUNT(*) as c FROM tka_hasil LIMIT 1').first<{ c: number }>(),
  ])

  // Untuk wali kelas: filter kelas yang menjadi binaannya
  let allowedKelasIds: string[] | null = null
  if (userRole === 'guru') {
    const waliRes = await db.prepare(
      'SELECT id FROM kelas WHERE wali_kelas_id = ?'
    ).bind(userId).all<{ id: string }>()
    allowedKelasIds = waliRes.results.map(k => k.id)
  }

  const allKelas = kelasRes.results || []
  const kelas12 = allKelas.filter(k => k.tingkat === 3)

  const filteredKelas = allowedKelasIds
    ? kelas12.filter(k => allowedKelasIds!.includes(k.id))
    : kelas12

  return {
    tahunAjaranAktif: taRes,
    kelasList: filteredKelas,
    hasHasil: (hasHasilRes?.c ?? 0) > 0,
  }
}

// ============================================================
// GET SISWA BY KELAS (lazy load)
// ============================================================
export async function getSiswaByKelasForTka(kelasId: string, tahunAjaranId: string) {
  const db = await getDB()

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
    ORDER BY s.nama_lengkap ASC
  `).bind(tahunAjaranId, kelasId).all<TkaMapelRow>()

  return rows.results || []
}

// ============================================================
// SEARCH SISWA KELAS 12 (lazy, enter-triggered)
// ============================================================
export async function searchSiswaKelas12ForTka(query: string, tahunAjaranId: string) {
  const db = await getDB()
  const like = `%${query}%`

  const rows = await db.prepare(`
    SELECT
      s.id as siswa_id,
      s.nama_lengkap,
      s.nisn,
      s.kelas_id,
      tmp.mapel_pilihan1,
      tmp.mapel_pilihan2
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    LEFT JOIN tka_mapel_pilihan tmp
      ON tmp.siswa_id = s.id AND tmp.tahun_ajaran_id = ?
    WHERE s.status = 'aktif'
      AND k.tingkat = 3
      AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)
    ORDER BY s.nama_lengkap ASC
    LIMIT 50
  `).bind(tahunAjaranId, like, like).all<TkaMapelRow>()

  return rows.results || []
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
    // Chunking per 100
    const chunkSize = 100
    for (let i = 0; i < stmts.length; i += chunkSize) {
      await db.batch(stmts.slice(i, i + chunkSize))
    }
    revalidatePath('/dashboard/tka')
    return { success: true, saved: items.length }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ============================================================
// REKAPITULASI MAPEL PILIHAN
// ============================================================
export async function getRekapMapelPilihan(tahunAjaranId: string) {
  const db = await getDB()

  const [rekap1, rekap2] = await Promise.all([
    db.prepare(`
      SELECT mapel_pilihan1 as mapel, COUNT(*) as jumlah
      FROM tka_mapel_pilihan
      WHERE tahun_ajaran_id = ? AND mapel_pilihan1 IS NOT NULL AND mapel_pilihan1 != ''
      GROUP BY mapel_pilihan1
      ORDER BY jumlah DESC
    `).bind(tahunAjaranId).all<{ mapel: string; jumlah: number }>(),
    db.prepare(`
      SELECT mapel_pilihan2 as mapel, COUNT(*) as jumlah
      FROM tka_mapel_pilihan
      WHERE tahun_ajaran_id = ? AND mapel_pilihan2 IS NOT NULL AND mapel_pilihan2 != ''
      GROUP BY mapel_pilihan2
      ORDER BY jumlah DESC
    `).bind(tahunAjaranId).all<{ mapel: string; jumlah: number }>(),
  ])

  return {
    pilihan1: rekap1.results || [],
    pilihan2: rekap2.results || [],
  }
}

// ============================================================
// GET SISWA BY MAPEL (untuk modal detail rekap)
// ============================================================
export async function getSiswaByMapel(
  tahunAjaranId: string,
  mapel: string,
  pilihan: 1 | 2,
  page: number = 1,
  pageSize: number = 20
) {
  const db = await getDB()
  const col = pilihan === 1 ? 'mapel_pilihan1' : 'mapel_pilihan2'
  const offset = (page - 1) * pageSize

  const [dataRes, countRes] = await Promise.all([
    db.prepare(`
      SELECT s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas, k.kelompok
      FROM tka_mapel_pilihan tmp
      JOIN siswa s ON s.id = tmp.siswa_id
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE tmp.tahun_ajaran_id = ? AND tmp.${col} = ?
      ORDER BY s.nama_lengkap ASC
      LIMIT ? OFFSET ?
    `).bind(tahunAjaranId, mapel, pageSize, offset).all<{
      nama_lengkap: string; nisn: string;
      tingkat: number | null; nomor_kelas: string | null; kelompok: string | null
    }>(),
    db.prepare(`
      SELECT COUNT(*) as total
      FROM tka_mapel_pilihan
      WHERE tahun_ajaran_id = ? AND ${col} = ?
    `).bind(tahunAjaranId, mapel).first<{ total: number }>(),
  ])

  return {
    data: dataRes.results || [],
    total: countRes?.total ?? 0,
  }
}

// ============================================================
// IMPORT HASIL TKA (dari parsing PDF di client)
// ============================================================
export async function importHasilTka(
  rows: {
    siswa_id: string
    nomor_peserta: string
    nilai_bind: number | null; kategori_bind: string | null
    nilai_mat: number | null; kategori_mat: string | null
    nilai_bing: number | null; kategori_bing: string | null
    mapel_pilihan1: string | null; nilai_pilihan1: number | null; kategori_pilihan1: string | null
    mapel_pilihan2: string | null; nilai_pilihan2: number | null; kategori_pilihan2: string | null
  }[],
  tahunAjaranId: string
) {
  if (rows.length === 0) return { success: true, saved: 0 }
  const db = await getDB()

  const stmts = rows.map(row =>
    db.prepare(`
      INSERT INTO tka_hasil (
        siswa_id, tahun_ajaran_id, nomor_peserta,
        nilai_bind, kategori_bind, nilai_mat, kategori_mat, nilai_bing, kategori_bing,
        mapel_pilihan1, nilai_pilihan1, kategori_pilihan1,
        mapel_pilihan2, nilai_pilihan2, kategori_pilihan2,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(siswa_id, tahun_ajaran_id) DO UPDATE SET
        nomor_peserta = excluded.nomor_peserta,
        nilai_bind = excluded.nilai_bind, kategori_bind = excluded.kategori_bind,
        nilai_mat = excluded.nilai_mat, kategori_mat = excluded.kategori_mat,
        nilai_bing = excluded.nilai_bing, kategori_bing = excluded.kategori_bing,
        mapel_pilihan1 = excluded.mapel_pilihan1, nilai_pilihan1 = excluded.nilai_pilihan1,
        kategori_pilihan1 = excluded.kategori_pilihan1,
        mapel_pilihan2 = excluded.mapel_pilihan2, nilai_pilihan2 = excluded.nilai_pilihan2,
        kategori_pilihan2 = excluded.kategori_pilihan2,
        updated_at = excluded.updated_at
    `).bind(
      row.siswa_id, tahunAjaranId, row.nomor_peserta,
      row.nilai_bind, row.kategori_bind, row.nilai_mat, row.kategori_mat,
      row.nilai_bing, row.kategori_bing,
      row.mapel_pilihan1, row.nilai_pilihan1, row.kategori_pilihan1,
      row.mapel_pilihan2, row.nilai_pilihan2, row.kategori_pilihan2
    )
  )

  try {
    const chunkSize = 100
    for (let i = 0; i < stmts.length; i += chunkSize) {
      await db.batch(stmts.slice(i, i + chunkSize))
    }
    revalidatePath('/dashboard/tka')
    return { success: true, saved: rows.length }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ============================================================
// GET LIST HASIL TKA (paginated)
// ============================================================
export async function getListHasilTka(
  tahunAjaranId: string,
  filter: { kelas_id?: string; search?: string },
  page: number = 1,
  pageSize: number = 25
) {
  const db = await getDB()
  const offset = (page - 1) * pageSize

  const conditions: string[] = ['h.tahun_ajaran_id = ?']
  const params: any[] = [tahunAjaranId]

  if (filter.kelas_id) {
    conditions.push('s.kelas_id = ?')
    params.push(filter.kelas_id)
  }
  if (filter.search) {
    conditions.push('(s.nama_lengkap LIKE ? OR s.nisn LIKE ?)')
    params.push(`%${filter.search}%`, `%${filter.search}%`)
  }

  const where = conditions.join(' AND ')

  const [dataRes, countRes] = await Promise.all([
    db.prepare(`
      SELECT
        h.id, h.siswa_id, s.nama_lengkap, s.nisn, s.kelas_id,
        k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok,
        h.nomor_peserta,
        h.nilai_bind, h.kategori_bind, h.nilai_mat, h.kategori_mat,
        h.nilai_bing, h.kategori_bing,
        h.mapel_pilihan1, h.nilai_pilihan1, h.kategori_pilihan1,
        h.mapel_pilihan2, h.nilai_pilihan2, h.kategori_pilihan2,
        h.updated_at
      FROM tka_hasil h
      JOIN siswa s ON s.id = h.siswa_id
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE ${where}
      ORDER BY s.nama_lengkap ASC
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, offset).all<TkaHasilRow>(),
    db.prepare(`
      SELECT COUNT(*) as total
      FROM tka_hasil h
      JOIN siswa s ON s.id = h.siswa_id
      WHERE ${where}
    `).bind(...params).first<{ total: number }>(),
  ])

  return {
    data: dataRes.results || [],
    total: countRes?.total ?? 0,
  }
}

// ============================================================
// GET ANALITIK TKA
// ============================================================
export async function getAnalitikTka(tahunAjaranId: string) {
  const db = await getDB()

  const [statRes, distribBindRes, distribMatRes, distribBingRes, topMapel1Res, topMapel2Res, perkelasRes] = await Promise.all([
    // Statistik dasar
    db.prepare(`
      SELECT
        COUNT(*) as total,
        ROUND(AVG(nilai_bind), 2) as avg_bind,
        ROUND(AVG(nilai_mat), 2) as avg_mat,
        ROUND(AVG(nilai_bing), 2) as avg_bing,
        ROUND(MAX(nilai_bind), 2) as max_bind,
        ROUND(MAX(nilai_mat), 2) as max_mat,
        ROUND(MAX(nilai_bing), 2) as max_bing,
        SUM(CASE WHEN kategori_bind = 'Istimewa' THEN 1 ELSE 0 END) as istimewa_bind,
        SUM(CASE WHEN kategori_mat = 'Istimewa' THEN 1 ELSE 0 END) as istimewa_mat,
        SUM(CASE WHEN kategori_bing = 'Istimewa' THEN 1 ELSE 0 END) as istimewa_bing
      FROM tka_hasil WHERE tahun_ajaran_id = ?
    `).bind(tahunAjaranId).first<any>(),

    // Distribusi kategori Bahasa Indonesia
    db.prepare(`
      SELECT kategori_bind as kategori, COUNT(*) as jumlah
      FROM tka_hasil WHERE tahun_ajaran_id = ? AND kategori_bind IS NOT NULL
      GROUP BY kategori_bind ORDER BY jumlah DESC
    `).bind(tahunAjaranId).all<{ kategori: string; jumlah: number }>(),

    // Distribusi kategori Matematika
    db.prepare(`
      SELECT kategori_mat as kategori, COUNT(*) as jumlah
      FROM tka_hasil WHERE tahun_ajaran_id = ? AND kategori_mat IS NOT NULL
      GROUP BY kategori_mat ORDER BY jumlah DESC
    `).bind(tahunAjaranId).all<{ kategori: string; jumlah: number }>(),

    // Distribusi kategori Bahasa Inggris
    db.prepare(`
      SELECT kategori_bing as kategori, COUNT(*) as jumlah
      FROM tka_hasil WHERE tahun_ajaran_id = ? AND kategori_bing IS NOT NULL
      GROUP BY kategori_bing ORDER BY jumlah DESC
    `).bind(tahunAjaranId).all<{ kategori: string; jumlah: number }>(),

    // Top mapel pilihan 1 dari hasil
    db.prepare(`
      SELECT mapel_pilihan1 as mapel, COUNT(*) as jumlah,
        ROUND(AVG(nilai_pilihan1), 2) as avg_nilai
      FROM tka_hasil
      WHERE tahun_ajaran_id = ? AND mapel_pilihan1 IS NOT NULL
      GROUP BY mapel_pilihan1 ORDER BY jumlah DESC LIMIT 10
    `).bind(tahunAjaranId).all<{ mapel: string; jumlah: number; avg_nilai: number }>(),

    // Top mapel pilihan 2 dari hasil
    db.prepare(`
      SELECT mapel_pilihan2 as mapel, COUNT(*) as jumlah,
        ROUND(AVG(nilai_pilihan2), 2) as avg_nilai
      FROM tka_hasil
      WHERE tahun_ajaran_id = ? AND mapel_pilihan2 IS NOT NULL
      GROUP BY mapel_pilihan2 ORDER BY jumlah DESC LIMIT 10
    `).bind(tahunAjaranId).all<{ mapel: string; jumlah: number; avg_nilai: number }>(),

    // Rata-rata per kelas (hanya yang ada hasilnya)
    db.prepare(`
      SELECT
        k.tingkat, k.nomor_kelas, k.kelompok,
        COUNT(*) as jumlah_siswa,
        ROUND(AVG(h.nilai_bind), 2) as avg_bind,
        ROUND(AVG(h.nilai_mat), 2) as avg_mat,
        ROUND(AVG(h.nilai_bing), 2) as avg_bing
      FROM tka_hasil h
      JOIN siswa s ON s.id = h.siswa_id
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE h.tahun_ajaran_id = ?
      GROUP BY s.kelas_id
      ORDER BY k.tingkat, k.nomor_kelas
    `).bind(tahunAjaranId).all<any>(),
  ])

  return {
    stats: statRes,
    distribBind: distribBindRes.results || [],
    distribMat: distribMatRes.results || [],
    distribBing: distribBingRes.results || [],
    topMapel1: topMapel1Res.results || [],
    topMapel2: topMapel2Res.results || [],
    perKelas: perkelasRes.results || [],
  }
}

// ============================================================
// FUZZY MATCH NAMA (untuk matching PDF -> siswa)
// ============================================================
export async function fuzzyMatchNamaTka(namaPdf: string, tahunAjaranId: string) {
  const db = await getDB()

  // Ambil semua siswa kelas 12 aktif
  const rows = await db.prepare(`
    SELECT s.id, s.nama_lengkap, s.nisn
    FROM siswa s
    JOIN kelas k ON k.id = s.kelas_id
    WHERE k.tingkat = 3 AND s.status = 'aktif'
  `).all<{ id: string; nama_lengkap: string; nisn: string }>()

  const candidates = rows.results || []
  const normalize = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()

  const target = normalize(namaPdf)
  let best: { id: string; nama_lengkap: string; nisn: string; score: number } | null = null

  for (const c of candidates) {
    const src = normalize(c.nama_lengkap)
    // Token matching sederhana
    const tTokens = target.split(' ')
    const sTokens = src.split(' ')
    const matched = tTokens.filter(t => sTokens.some(s => s === t || s.startsWith(t) || t.startsWith(s))).length
    const score = matched / Math.max(tTokens.length, sTokens.length)

    if (!best || score > best.score) {
      best = { ...c, score }
    }
  }

  return best && best.score >= 0.5 ? best : null
}

// ============================================================
// GET ALL SISWA KELAS 12 FOR MATCHING (batch call dari client)
// ============================================================
export async function getAllSiswaKelas12() {
  const db = await getDB()
  const rows = await db.prepare(`
    SELECT s.id, s.nama_lengkap, s.nisn
    FROM siswa s
    JOIN kelas k ON k.id = s.kelas_id
    WHERE k.tingkat = 3 AND s.status = 'aktif'
    ORDER BY s.nama_lengkap ASC
  `).all<{ id: string; nama_lengkap: string; nisn: string }>()

  return rows.results || []
}
