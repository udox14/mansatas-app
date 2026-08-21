// app/dashboard/penerimaan-pt/actions.ts
'use server'

import { dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { getDB } from '@/utils/db-server'
import { revalidatePath } from 'next/cache'
import type { JalurPT, StatusPenerimaan, PenerimaanRow } from './types'
import {
  ADMINISTRATIVE_ROLES,
  assertStudentScope,
  isAdministrativeActor,
  requireActionAccess,
  type AuthenticatedActor,
} from '@/lib/action-security'
import { isImportChunkWithinLimits } from '@/lib/payload-limits'
import { z } from 'zod'

const penerimaanStatusSchema = z.enum(['DITERIMA', 'TIDAK_DITERIMA', 'MENGUNDURKAN_DIRI'])
const jalurSchema = z.enum(['SNBP', 'SNBT', 'SPAN-PTKIN', 'UM-PTKIN', 'MANDIRI', 'KEDINASAN', 'LAINNYA'])
const penerimaanCreateSchema = z.object({
  siswa_id: z.string().trim().min(1).max(100),
  tahun_ajaran_id: z.string().trim().min(1).max(100),
  jalur: jalurSchema,
  kampus_id: z.string().trim().min(1).max(100),
  kampus_nama: z.string().trim().min(1).max(200),
  program_studi: z.string().trim().max(200).optional(),
  status: penerimaanStatusSchema,
  catatan: z.string().trim().max(2000).optional(),
}).strict()
const penerimaanUpdateSchema = penerimaanCreateSchema.pick({
  kampus_id: true,
  kampus_nama: true,
  program_studi: true,
  status: true,
  catatan: true,
}).partial().strict()
const penerimaanImportRowSchema = penerimaanCreateSchema.pick({
  jalur: true,
  kampus_id: true,
  kampus_nama: true,
  program_studi: true,
  status: true,
}).extend({ nisn: z.string().trim().min(1).max(30) }).strict()

function studentScope(actor: AuthenticatedActor, siswaAlias = 's', kelasAlias = 'k') {
  if (actor.kind !== 'staff' || isAdministrativeActor(actor)) return { sql: '', params: [] as string[] }
  return {
    sql: `AND (
      ${kelasAlias}.wali_kelas_id = ?
      OR EXISTS (SELECT 1 FROM kelas_binaan_bk kb WHERE kb.kelas_id = ${siswaAlias}.kelas_id AND kb.guru_bk_id = ?)
      OR EXISTS (SELECT 1 FROM penugasan_mengajar pm WHERE pm.kelas_id = ${siswaAlias}.kelas_id AND pm.guru_id = ?)
    )`,
    params: [actor.id, actor.id, actor.id],
  }
}

// ── Initial Data (1 batch query) ───────────────────────────────────────
export async function getInitialDataPenerimaanPT() {
  await requireActionAccess('penerimaan-pt', 'read')
  const db = await getDB()
  const taAktif = await db
    .prepare('SELECT id, nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<{ id: string; nama: string; semester: number }>()
  return { taAktif }
}

// ── Siswa Kelas 12 (original, tanpa pagination) ────────────────────────
export async function getSiswaKelas12(tahun_ajaran_id: string) {
  const actor = await requireActionAccess('penerimaan-pt', 'read')
  const scope = studentScope(actor)
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
      AND p.jenis_data = 'HASIL'
    WHERE k.tingkat = 12
      AND s.status = 'aktif'
      ${scope.sql}
    GROUP BY s.id
    ORDER BY k.nomor_kelas ASC, s.nama_lengkap ASC
  `).bind(tahun_ajaran_id, ...scope.params).all<any>()
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
  const actor = await requireActionAccess('penerimaan-pt', 'read')
  const scope = studentScope(actor)
  const db = await getDB()
  let query = `
    SELECT
      s.id, s.nama_lengkap, s.nisn, s.foto_url,
      k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok,
      COUNT(CASE WHEN p.status = 'DITERIMA' AND p.jalur = ? THEN 1 END) as jumlah_diterima
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    LEFT JOIN penerimaan_pt p ON p.siswa_id = s.id AND p.tahun_ajaran_id = ? AND p.jenis_data = 'HASIL'
    WHERE k.tingkat = 12 AND s.status = 'aktif'
  `
  const binds: any[] = [params.jalur || '', params.tahun_ajaran_id]
  query += ` ${scope.sql}`
  binds.push(...scope.params)
  params.limit = Math.min(100, Math.max(1, Math.floor(params.limit)))
  params.offset = Math.max(0, Math.floor(params.offset))

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
  const actor = await requireActionAccess('penerimaan-pt', 'read')
  const scope = studentScope(actor)
  const db = await getDB()
  let query = `
    SELECT COUNT(*) as total
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE k.tingkat = 12 AND s.status = 'aktif'
  `
  const binds: any[] = []
  query += ` ${scope.sql}`
  binds.push(...scope.params)
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
  const actor = await requireActionAccess('penerimaan-pt', 'read')
  const scope = studentScope(actor)
  const db = await getDB()
  const res = await db.prepare(`
    SELECT DISTINCT k.nomor_kelas
    FROM siswa s
    JOIN kelas k ON s.kelas_id = k.id
    WHERE k.tingkat = 12 AND s.status = 'aktif'
    ${scope.sql}
    ORDER BY k.nomor_kelas ASC
  `).bind(...scope.params).all<{ nomor_kelas: string }>()
  return res.results?.map(r => r.nomor_kelas) || []
}

// ── Penerimaan by Jalur ────────────────────────────────────────────────
export async function getPenerimaanByJalur(jalur: JalurPT, tahun_ajaran_id: string) {
  const actor = await requireActionAccess('penerimaan-pt', 'read')
  const scope = studentScope(actor)
  const db = await getDB()
  const res = await db.prepare(`
    SELECT
      p.*,
      s.nama_lengkap, s.nisn, s.foto_url,
      k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok
    FROM penerimaan_pt p
    JOIN siswa s ON p.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE p.jalur = ? AND p.tahun_ajaran_id = ? AND p.jenis_data = 'HASIL'
    ${scope.sql}
    ORDER BY s.nama_lengkap ASC
  `).bind(jalur, tahun_ajaran_id, ...scope.params).all<PenerimaanRow>()
  return res.results || []
}

// ── Penerimaan by Siswa ────────────────────────────────────────────────
export async function getPenerimaanSiswa(siswa_id: string, tahun_ajaran_id: string) {
  const actor = await requireActionAccess('penerimaan-pt', 'read')
  await assertStudentScope(actor, siswa_id, 'penerimaan-pt')
  const db = await getDB()
  const res = await db.prepare(`
    SELECT * FROM penerimaan_pt
    WHERE siswa_id = ? AND tahun_ajaran_id = ? AND jenis_data = 'HASIL'
    ORDER BY jalur ASC, created_at ASC
  `).bind(siswa_id, tahun_ajaran_id).all<PenerimaanRow>()
  return res.results || []
}

// ── Penerimaan by Kampus ───────────────────────────────────────────────
export async function getPenerimaanByKampus(kampus_id: string, tahun_ajaran_id: string) {
  const actor = await requireActionAccess('penerimaan-pt', 'read')
  const scope = studentScope(actor)
  const db = await getDB()
  const res = await db.prepare(`
    SELECT
      p.*,
      s.nama_lengkap, s.nisn, s.foto_url,
      k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok
    FROM penerimaan_pt p
    JOIN siswa s ON p.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE p.kampus_id = ? AND p.tahun_ajaran_id = ? AND p.jenis_data = 'HASIL'
    ${scope.sql}
    ORDER BY p.jalur ASC, s.nama_lengkap ASC
  `).bind(kampus_id, tahun_ajaran_id, ...scope.params).all<PenerimaanRow>()
  return res.results || []
}

// ── Semua Penerimaan (untuk export & analitik) ─────────────────────────
export async function getSemuaPenerimaan(tahun_ajaran_id: string) {
  const actor = await requireActionAccess('penerimaan-pt', 'read')
  const scope = studentScope(actor)
  const db = await getDB()
  const res = await db.prepare(`
    SELECT
      p.*,
      s.nama_lengkap, s.nisn,
      k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok
    FROM penerimaan_pt p
    JOIN siswa s ON p.siswa_id = s.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE p.tahun_ajaran_id = ? AND p.jenis_data = 'HASIL'
    ${scope.sql}
    ORDER BY p.jalur ASC, s.nama_lengkap ASC
  `).bind(tahun_ajaran_id, ...scope.params).all<PenerimaanRow>()
  return res.results || []
}

// ── Analitik (1 query batch) ───────────────────────────────────────────
export async function getAnalitikPenerimaan(tahun_ajaran_id: string) {
  const actor = await requireActionAccess('penerimaan-pt', 'read')
  const scope = studentScope(actor)
  const db = await getDB()

  const totalSiswa = await db
    .prepare(`SELECT COUNT(*) as total FROM siswa s JOIN kelas k ON s.kelas_id = k.id WHERE k.tingkat = 12 AND s.status = 'aktif' ${scope.sql}`)
    .bind(...scope.params)
    .first<{ total: number }>()

  const perJalur = await db.prepare(`
    SELECT jalur, status, COUNT(*) as total
    FROM penerimaan_pt p JOIN siswa s ON p.siswa_id = s.id LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE p.tahun_ajaran_id = ? AND p.jenis_data = 'HASIL' ${scope.sql}
    GROUP BY jalur, status ORDER BY jalur ASC
  `).bind(tahun_ajaran_id, ...scope.params).all<{ jalur: string; status: string; total: number }>()

  const topKampus = await db.prepare(`
    SELECT kampus_id, kampus_nama, COUNT(*) as total
    FROM penerimaan_pt p JOIN siswa s ON p.siswa_id = s.id LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE p.tahun_ajaran_id = ? AND p.status = 'DITERIMA' AND p.jenis_data = 'HASIL' ${scope.sql}
    GROUP BY kampus_id, kampus_nama
    ORDER BY total DESC
    LIMIT 15
  `).bind(tahun_ajaran_id, ...scope.params).all<{ kampus_id: string; kampus_nama: string; total: number }>()

  const sudahData = await db
    .prepare(`SELECT COUNT(DISTINCT p.siswa_id) as total FROM penerimaan_pt p JOIN siswa s ON p.siswa_id = s.id LEFT JOIN kelas k ON s.kelas_id = k.id WHERE p.tahun_ajaran_id = ? AND p.jenis_data = 'HASIL' ${scope.sql}`)
    .bind(tahun_ajaran_id, ...scope.params)
    .first<{ total: number }>()

  return {
    totalSiswa: totalSiswa?.total ?? 0,
    sudahData: sudahData?.total ?? 0,
    perJalur: perJalur.results || [],
    topKampus: topKampus.results || [],
  }
}

// ── CRUD ───────────────────────────────────────────────────────────────
export async function tambahPenerimaan(payload: unknown) {
  const actor = await requireActionAccess('penerimaan-pt', 'create')
  const parsed = penerimaanCreateSchema.safeParse(payload)
  if (!parsed.success) return { error: 'Data penerimaan tidak valid.' }
  const safePayload = parsed.data
  await assertStudentScope(actor, safePayload.siswa_id, 'penerimaan-pt')
  const db = await getDB()
  const result = await dbInsert(db, 'penerimaan_pt', {
    ...safePayload,
    jenis_data: 'HASIL',
    program_studi: safePayload.program_studi || null,
    catatan: safePayload.catatan || null,
  })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/penerimaan-pt')
  return { success: 'Data berhasil disimpan.', id: (result.data as any)?.id }
}

export async function updatePenerimaan(id: string, payload: unknown) {
  const actor = await requireActionAccess('penerimaan-pt', 'update')
  const parsed = penerimaanUpdateSchema.safeParse(payload)
  if (!parsed.success || Object.keys(parsed.data).length === 0) return { error: 'Data penerimaan tidak valid.' }
  const db = await getDB()
  const existing = await db.prepare('SELECT siswa_id FROM penerimaan_pt WHERE id = ? AND jenis_data = ?').bind(id, 'HASIL').first<{ siswa_id: string }>()
  if (!existing) return { error: 'Data tidak ditemukan.' }
  await assertStudentScope(actor, existing.siswa_id, 'penerimaan-pt')
  const safePayload = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }
  const result = await dbUpdate(db, 'penerimaan_pt', safePayload, { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/penerimaan-pt')
  return { success: 'Data berhasil diperbarui.' }
}

export async function hapusPenerimaan(id: string) {
  const actor = await requireActionAccess('penerimaan-pt', 'delete')
  const db = await getDB()
  const existing = await db.prepare('SELECT siswa_id FROM penerimaan_pt WHERE id = ? AND jenis_data = ?').bind(id, 'HASIL').first<{ siswa_id: string }>()
  if (!existing) return { error: 'Data tidak ditemukan.' }
  await assertStudentScope(actor, existing.siswa_id, 'penerimaan-pt')
  const result = await dbDelete(db, 'penerimaan_pt', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/penerimaan-pt')
  return { success: 'Data berhasil dihapus.' }
}

// ── Import data dari Excel (melalui API) ───────────────────────────────
export async function importPenerimaanFromData(
  data: unknown[],
  tahun_ajaran_id: string
) {
  await requireActionAccess('penerimaan-pt', 'create', { allowedRoles: ADMINISTRATIVE_ROLES })
  if (!isImportChunkWithinLimits(data)) {
    return { success: 0, failed: Array.isArray(data) ? data.length : 0, errors: ['Data impor maksimal 500 baris dan 1 MB per chunk.'] }
  }
  const parsedRows = z.array(penerimaanImportRowSchema).min(1).max(500).safeParse(data)
  if (!parsedRows.success) return { success: 0, failed: data.length, errors: ['Format data impor tidak valid.'] }
  const db = await getDB()
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  }

  // Ambil semua siswa kelas 12 aktif berdasarkan NISN
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

  for (const item of parsedRows.data) {
    const siswa = siswaMap.get(item.nisn)
    if (!siswa) {
      results.failed++
      results.errors.push(`NISN ${item.nisn} tidak ditemukan atau bukan siswa kelas 12 aktif.`)
      continue
    }

    // Cek apakah data sudah ada (siswa_id, tahun_ajaran_id, jalur, kampus_id)
    const existing = await db
      .prepare(`
        SELECT id FROM penerimaan_pt
        WHERE siswa_id = ? AND tahun_ajaran_id = ? AND jalur = ? AND kampus_id = ?
          AND jenis_data = 'HASIL'
      `)
      .bind(siswa.id, tahun_ajaran_id, item.jalur, item.kampus_id)
      .first<{ id: string }>()

    if (existing) {
      // Update
      await dbUpdate(db, 'penerimaan_pt', {
        kampus_nama: item.kampus_nama,
        program_studi: item.program_studi || null,
        status: item.status,
        catatan: null,
        jenis_data: 'HASIL',
        updated_at: new Date().toISOString(),
      }, { id: existing.id })
      results.success++
    } else {
      // Insert
      const insertResult = await dbInsert(db, 'penerimaan_pt', {
        siswa_id: siswa.id,
        tahun_ajaran_id,
        jalur: item.jalur,
        kampus_id: item.kampus_id,
        kampus_nama: item.kampus_nama,
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
