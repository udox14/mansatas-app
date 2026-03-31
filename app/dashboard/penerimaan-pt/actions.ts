// app/dashboard/penerimaan-pt/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { revalidatePath } from 'next/cache'
import type { JalurPT, StatusPenerimaan, PenerimaanRow } from './types'
import kampusData from '@/data/kampus.json'

const KAMPUS_LIST = kampusData as Array<{ id: string; nama: string; singkatan: string; kota: string; provinsi: string; jenis: string }>

// ── Helper fuzzy match kampus ─────────────────────────────────────────
function findClosestKampus(kampusNama: string): { id: string; nama: string } | null {
  const normalized = kampusNama.toLowerCase().trim()
  // Cari persis
  const exact = KAMPUS_LIST.find(k => k.nama.toLowerCase() === normalized)
  if (exact) return { id: exact.id, nama: exact.nama }

  // Cari mengandung
  const contains = KAMPUS_LIST.find(k => k.nama.toLowerCase().includes(normalized) || normalized.includes(k.nama.toLowerCase()))
  if (contains) return { id: contains.id, nama: contains.nama }

  // Cari dengan menghapus spasi dan tanda baca
  const clean = normalized.replace(/[^a-z0-9]/g, '')
  const similar = KAMPUS_LIST.find(k => k.nama.toLowerCase().replace(/[^a-z0-9]/g, '') === clean)
  if (similar) return { id: similar.id, nama: similar.nama }

  return null
}

// ── Initial Data (1 batch query) ───────────────────────────────────────
export async function getInitialDataPenerimaanPT() {
  const db = await getDB()
  const taAktif = await db
    .prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<{ id: string; nama: string; semester: number }>()
  return { taAktif }
}

// ── Siswa Kelas 12 (original, tanpa pagination) ────────────────────────
export async function getSiswaKelas12(tahun_ajaran_id: string) {
  const db = await getDB()
  const res = await db.prepare(`
    SELECT
      s.id, s.nama_lengkap, s.nisn, s.foto_url,
      k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok,
      COUNT(p.id) as jumlah_diterima
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    LEFT JOIN penerimaan_pt p ON p.siswa_id = s.id
      AND p.tahun_ajaran_id = ?
      AND p.status = 'DITERIMA'
    WHERE k.tingkat = 12
      AND s.status = 'aktif'
    GROUP BY s.id
    ORDER BY k.nomor_kelas ASC, s.nama_lengkap ASC
  `).bind(tahun_ajaran_id).all<any>()
  return res.results || []
}

// ── Pagination & filter untuk siswa kelas 12 ───────────────────────────
export async function getSiswaKelas12Paginated(params: {
  tahun_ajaran_id: string
  limit: number
  offset: number
  kelas_filter?: string
  search?: string
  jalur?: JalurPT
}) {
  const db = await getDB()
  let query = `
    SELECT
      s.id, s.nama_lengkap, s.nisn, s.foto_url,
      k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok,
      COUNT(CASE WHEN p.status = 'DITERIMA' AND p.jalur = ? THEN 1 END) as jumlah_diterima
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    LEFT JOIN penerimaan_pt p ON p.siswa_id = s.id AND p.tahun_ajaran_id = ?
    WHERE k.tingkat = 12 AND s.status = 'aktif'
  `
  const binds: any[] = [params.jalur || '', params.tahun_ajaran_id]

  if (params.kelas_filter) {
    query += ` AND k.nomor_kelas = ?`
    binds.push(params.kelas_filter)
  }
  if (params.search && params.search.trim().length >= 2) {
    query += ` AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)`
    binds.push(`%${params.search}%`, `%${params.search}%`)
  }

  query += ` GROUP BY s.id ORDER BY k.nomor_kelas ASC, s.nama_lengkap ASC LIMIT ? OFFSET ?`
  binds.push(params.limit, params.offset)

  const res = await db.prepare(query).bind(...binds).all<any>()
  return res.results || []
}

export async function getTotalSiswaKelas12Filtered(params: {
  tahun_ajaran_id: string
  kelas_filter?: string
  search?: string
}) {
  const db = await getDB()
  let query = `
    SELECT COUNT(*) as total
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE k.tingkat = 12 AND s.status = 'aktif'
  `
  const binds: any[] = []
  if (params.kelas_filter) {
    query += ` AND k.nomor_kelas = ?`
    binds.push(params.kelas_filter)
  }
  if (params.search && params.search.trim().length >= 2) {
    query += ` AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)`
    binds.push(`%${params.search}%`, `%${params.search}%`)
  }
  const res = await db.prepare(query).bind(...binds).first<{ total: number }>()
  return res?.total || 0
}

export async function getKelasUnik(tahun_ajaran_id: string) {
  const db = await getDB()
  const res = await db.prepare(`
    SELECT DISTINCT k.nomor_kelas
    FROM siswa s
    JOIN kelas k ON s.kelas_id = k.id
    WHERE k.tingkat = 12 AND s.status = 'aktif'
    ORDER BY k.nomor_kelas ASC
  `).all<{ nomor_kelas: string }>()
  return res.results?.map(r => r.nomor_kelas) || []
}

// ── Penerimaan by Jalur (hemat query, 1 call) ──────────────────────────
export async function getPenerimaanByJalur(jalur: JalurPT, tahun_ajaran_id: string) {
  const db = await getDB()
  const res = await db.prepare(`
    SELECT
      p.*,
      s.nama_lengkap, s.nisn, s.foto_url,
      k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok
    FROM penerimaan_pt p
    JOIN siswa s ON p.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE p.jalur = ? AND p.tahun_ajaran_id = ?
    ORDER BY s.nama_lengkap ASC
  `).bind(jalur, tahun_ajaran_id).all<PenerimaanRow>()
  return res.results || []
}

// ── Penerimaan by Siswa ────────────────────────────────────────────────
export async function getPenerimaanSiswa(siswa_id: string, tahun_ajaran_id: string) {
  const db = await getDB()
  const res = await db.prepare(`
    SELECT * FROM penerimaan_pt
    WHERE siswa_id = ? AND tahun_ajaran_id = ?
    ORDER BY jalur ASC, created_at ASC
  `).bind(siswa_id, tahun_ajaran_id).all<PenerimaanRow>()
  return res.results || []
}

// ── Penerimaan by Kampus ───────────────────────────────────────────────
export async function getPenerimaanByKampus(kampus_id: string, tahun_ajaran_id: string) {
  const db = await getDB()
  const res = await db.prepare(`
    SELECT
      p.*,
      s.nama_lengkap, s.nisn, s.foto_url,
      k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok
    FROM penerimaan_pt p
    JOIN siswa s ON p.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE p.kampus_id = ? AND p.tahun_ajaran_id = ?
    ORDER BY p.jalur ASC, s.nama_lengkap ASC
  `).bind(kampus_id, tahun_ajaran_id).all<PenerimaanRow>()
  return res.results || []
}

// ── Semua Penerimaan (untuk export & analitik) ─────────────────────────
export async function getSemuaPenerimaan(tahun_ajaran_id: string) {
  const db = await getDB()
  const res = await db.prepare(`
    SELECT
      p.*,
      s.nama_lengkap, s.nisn,
      k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok
    FROM penerimaan_pt p
    JOIN siswa s ON p.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE p.tahun_ajaran_id = ?
    ORDER BY p.jalur ASC, s.nama_lengkap ASC
  `).bind(tahun_ajaran_id).all<PenerimaanRow>()
  return res.results || []
}

// ── Analitik (1 query batch) ───────────────────────────────────────────
export async function getAnalitikPenerimaan(tahun_ajaran_id: string) {
  const db = await getDB()

  // Total siswa kelas 12
  const totalSiswa = await db
    .prepare(`SELECT COUNT(*) as total FROM siswa s JOIN kelas k ON s.kelas_id = k.id WHERE k.tingkat = 12 AND s.status = 'aktif'`)
    .first<{ total: number }>()

  // Per jalur
  const perJalur = await db.prepare(`
    SELECT jalur, status, COUNT(*) as total
    FROM penerimaan_pt WHERE tahun_ajaran_id = ?
    GROUP BY jalur, status ORDER BY jalur ASC
  `).bind(tahun_ajaran_id).all<{ jalur: string; status: string; total: number }>()

  // Top kampus (diterima)
  const topKampus = await db.prepare(`
    SELECT kampus_id, kampus_nama, COUNT(*) as total
    FROM penerimaan_pt
    WHERE tahun_ajaran_id = ? AND status = 'DITERIMA'
    GROUP BY kampus_id, kampus_nama
    ORDER BY total DESC
    LIMIT 15
  `).bind(tahun_ajaran_id).all<{ kampus_id: string; kampus_nama: string; total: number }>()

  // Siswa sudah ada data
  const sudahData = await db
    .prepare(`SELECT COUNT(DISTINCT siswa_id) as total FROM penerimaan_pt WHERE tahun_ajaran_id = ?`)
    .bind(tahun_ajaran_id)
    .first<{ total: number }>()

  return {
    totalSiswa: totalSiswa?.total ?? 0,
    sudahData: sudahData?.total ?? 0,
    perJalur: perJalur.results || [],
    topKampus: topKampus.results || [],
  }
}

// ── CRUD ───────────────────────────────────────────────────────────────
export async function tambahPenerimaan(payload: {
  siswa_id: string
  tahun_ajaran_id: string
  jalur: JalurPT
  kampus_id: string
  kampus_nama: string
  program_studi?: string
  status: StatusPenerimaan
  catatan?: string
}) {
  const db = await getDB()
  const result = await dbInsert(db, 'penerimaan_pt', {
    ...payload,
    program_studi: payload.program_studi || null,
    catatan: payload.catatan || null,
  })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/penerimaan-pt')
  return { success: 'Data berhasil disimpan.', id: (result.data as any)?.id }
}

export async function updatePenerimaan(id: string, payload: {
  kampus_id?: string
  kampus_nama?: string
  program_studi?: string
  status?: StatusPenerimaan
  catatan?: string
}) {
  const db = await getDB()
  const result = await dbUpdate(db, 'penerimaan_pt', {
    ...payload,
    updated_at: new Date().toISOString(),
  }, { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/penerimaan-pt')
  return { success: 'Data berhasil diperbarui.' }
}

export async function hapusPenerimaan(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'penerimaan_pt', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/penerimaan-pt')
  return { success: 'Data berhasil dihapus.' }
}

// ── Import data dari Excel (melalui API) ───────────────────────────────
export async function importPenerimaanFromData(
  data: Array<{
    nisn: string
    jalur: JalurPT
    kampus_nama: string
    program_studi?: string
    status: StatusPenerimaan
  }>,
  tahun_ajaran_id: string
) {
  const db = await getDB()
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
    skipped: 0,
  }

  // Ambil semua siswa kelas 12 aktif berdasarkan NISN (untuk validasi)
  const siswaMap = new Map<string, { id: string; nama_lengkap: string }>()
  const siswaRows = await db
    .prepare(`
      SELECT s.id, s.nama_lengkap, s.nisn
      FROM siswa s
      JOIN kelas k ON s.kelas_id = k.id
      WHERE k.tingkat = 12 AND s.status = 'aktif'
    `)
    .all<{ id: string; nama_lengkap: string; nisn: string }>()
  for (const s of siswaRows.results || []) {
    siswaMap.set(s.nisn, { id: s.id, nama_lengkap: s.nama_lengkap })
  }

  // Loop data
  for (const item of data) {
    const siswa = siswaMap.get(item.nisn)
    if (!siswa) {
      results.failed++
      results.errors.push(`NISN ${item.nisn} tidak ditemukan atau bukan siswa kelas 12 aktif.`)
      continue
    }

    // Cari kampus_id
    const kampus = findClosestKampus(item.kampus_nama)
    if (!kampus) {
      results.failed++
      results.errors.push(`Kampus "${item.kampus_nama}" tidak dikenali. Silakan perbaiki di preview.`)
      continue
    }

    // Cek apakah data sudah ada (siswa_id, tahun_ajaran_id, jalur, kampus_id)
    const existing = await db
      .prepare(`
        SELECT id FROM penerimaan_pt
        WHERE siswa_id = ? AND tahun_ajaran_id = ? AND jalur = ? AND kampus_id = ?
      `)
      .bind(siswa.id, tahun_ajaran_id, item.jalur, kampus.id)
      .first<{ id: string }>()

    if (existing) {
      // Update
      await dbUpdate(db, 'penerimaan_pt', {
        kampus_nama: kampus.nama,
        program_studi: item.program_studi || null,
        status: item.status,
        catatan: null,
        updated_at: new Date().toISOString(),
      }, { id: existing.id })
      results.success++
    } else {
      // Insert
      const insertResult = await dbInsert(db, 'penerimaan_pt', {
        siswa_id: siswa.id,
        tahun_ajaran_id,
        jalur: item.jalur,
        kampus_id: kampus.id,
        kampus_nama: kampus.nama,
        program_studi: item.program_studi || null,
        status: item.status,
        catatan: null,
      })
      if (insertResult.error) {
        results.failed++
        results.errors.push(`Gagal menyimpan untuk ${siswa.nama_lengkap} (${item.jalur}): ${insertResult.error}`)
      } else {
        results.success++
      }
    }
  }

  revalidatePath('/dashboard/penerimaan-pt')
  return results
}