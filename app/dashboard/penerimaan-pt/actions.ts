// Lokasi: app/dashboard/penerimaan-pt/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { revalidatePath } from 'next/cache'

// ── Types ──────────────────────────────────────────────────────────────
export type JalurPT =
  | 'SNBP' | 'SNBT' | 'SPAN_PTKIN' | 'UM_PTKIN'
  | 'MANDIRI' | 'PMB_PTS' | 'LAINNYA'

export type StatusPenerimaan = 'DITERIMA' | 'TIDAK_DITERIMA' | 'MENGUNDURKAN_DIRI'

export type PenerimaanRow = {
  id: string
  siswa_id: string
  tahun_ajaran_id: string
  jalur: JalurPT
  kampus_id: string
  kampus_nama: string
  program_studi: string | null
  status: StatusPenerimaan
  catatan: string | null
  created_at: string
  updated_at: string
  // joined
  nama_lengkap?: string
  nisn?: string
  tingkat?: number
  nomor_kelas?: string
  kelas_kelompok?: string
}

export const JALUR_LIST: { value: JalurPT; label: string; color: string }[] = [
  { value: 'SNBP',      label: 'SNBP',       color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'SNBT',      label: 'SNBT',       color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'SPAN_PTKIN',label: 'SPAN-PTKIN', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'UM_PTKIN',  label: 'UM-PTKIN',  color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'MANDIRI',   label: 'Mandiri',    color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'PMB_PTS',   label: 'PMB PTS',   color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'LAINNYA',   label: 'Lainnya',   color: 'bg-slate-100 text-slate-600 border-slate-200' },
]

export const STATUS_LIST: { value: StatusPenerimaan; label: string; color: string }[] = [
  { value: 'DITERIMA',           label: 'Diterima',            color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'TIDAK_DITERIMA',     label: 'Tidak Diterima',      color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'MENGUNDURKAN_DIRI',  label: 'Mengundurkan Diri',   color: 'bg-amber-50 text-amber-700 border-amber-200' },
]

// ── Initial Data (1 batch query) ───────────────────────────────────────
export async function getInitialDataPenerimaanPT() {
  const db = await getDB()
  const taAktif = await db
    .prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<{ id: string; nama: string; semester: number }>()
  return { taAktif }
}

// ── Siswa Kelas 12 (lazy, dipanggil client) ────────────────────────────
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