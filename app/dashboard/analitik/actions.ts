// Lokasi: app/dashboard/akademik/analitik/actions.ts
'use server'

import { dbUpdate, parseJsonCol } from '@/utils/db'
import { getDB } from '@/utils/db-server'
import { revalidatePath } from 'next/cache'
import { SEMESTER_KEYS } from '@/app/dashboard/akademik/nilai/constants'
import { requireActionAccess } from '@/lib/action-security'
import { publicServerError } from '@/lib/security-log'
import { z } from 'zod'
import { isImportChunkWithinLimits } from '@/lib/payload-limits'

const ADMINISTRATIVE_ROLES = ['super_admin', 'admin_tu', 'kepsek', 'wakamad'] as const
const pengaturanSchema = z.object({
  mapel_snbp: z.array(z.string().trim().min(1).max(120)).max(100),
  mapel_span: z.array(z.string().trim().min(1).max(120)).max(100),
  bobot_rapor: z.number().finite().min(0).max(100),
  bobot_um: z.number().finite().min(0).max(100),
}).strict()
const excelRowSchema = z.record(z.string().max(160), z.union([
  z.string().max(500), z.number().finite(), z.boolean(), z.null(), z.undefined(),
]))

function isValidNilaiColumn(targetKolom: string): targetKolom is typeof SEMESTER_KEYS[number] {
  return SEMESTER_KEYS.includes(targetKolom)
}

// ============================================================
// 1. PENGATURAN AKADEMIK (singleton row 'global')
// ============================================================
export async function getPengaturanAkademik() {
  await requireActionAccess('analitik', 'read')
  const db = await getDB()
  const row = await db
    .prepare('SELECT * FROM pengaturan_akademik WHERE id = ?')
    .bind('global')
    .first<any>()

  if (!row) return null

  return {
    ...row,
    mapel_snbp: parseJsonCol<string[]>(row.mapel_snbp, []),
    mapel_span: parseJsonCol<string[]>(row.mapel_span, []),
    daftar_jurusan: parseJsonCol<string[]>(row.daftar_jurusan, [
      'MIPA',
      'SOSHUM',
      'KEAGAMAAN',
      'UMUM',
    ]),
  }
}

export async function simpanPengaturanAkademik(payload: unknown) {
  await requireActionAccess('analitik', 'update', { allowedRoles: [...ADMINISTRATIVE_ROLES] })
  const parsed = pengaturanSchema.safeParse(payload)
  if (!parsed.success) return { error: 'Data pengaturan tidak valid.' }
  const settings = parsed.data
  const db = await getDB()
  const result = await dbUpdate(
    db,
    'pengaturan_akademik',
    {
      mapel_snbp: JSON.stringify(settings.mapel_snbp),
      mapel_span: JSON.stringify(settings.mapel_span),
      bobot_rapor: settings.bobot_rapor,
      bobot_um: settings.bobot_um,
      updated_at: new Date().toISOString(),
    },
    { id: 'global' }
  )

  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/akademik/analitik')
  return { success: 'Pengaturan rumus dan mata pelajaran berhasil disimpan!' }
}

// ============================================================
// 2. IMPORT NILAI DARI EXCEL
// FIX: Chunk upsert per 50 baris agar tidak spike memory di Worker
// ============================================================
export async function importNilaiDariExcel(dataExcel: unknown[], targetKolom: string) {
  await requireActionAccess('analitik', 'create', { allowedRoles: [...ADMINISTRATIVE_ROLES] })
  if (!isImportChunkWithinLimits(dataExcel)) {
    return { error: 'Data impor maksimal 500 baris dan 1 MB per chunk.', logs: [] }
  }
  const parsedRows = z.array(excelRowSchema).max(500).safeParse(dataExcel)
  if (!parsedRows.success) return { error: 'Format data impor tidak valid.', logs: [] }
  const validatedRows = parsedRows.data
  if (!isValidNilaiColumn(targetKolom)) return { error: 'Kolom target tidak valid.', logs: [] }
  const db = await getDB()

  const [dbSiswa, dbMapel] = await Promise.all([
    db.prepare('SELECT id, nisn, nama_lengkap FROM siswa').all<any>(),
    db.prepare('SELECT nama_mapel, kode_mapel FROM mata_pelajaran').all<any>(),
  ])

  if (!dbSiswa.results.length) return { error: 'Gagal memuat database siswa', logs: [] }

  // Bangun kamus mapel (nama & kode → nama canonical)
  const kamusMapel = new Map<string, string>()
  dbMapel.results.forEach((m: any) => {
    kamusMapel.set(m.nama_mapel.toLowerCase().trim(), m.nama_mapel)
    if (m.kode_mapel) kamusMapel.set(m.kode_mapel.toLowerCase().trim(), m.nama_mapel)
  })

  // Bersihkan spasi dari NISN di DB agar pasti match
  const nisnMap = new Map<string, string>(
    dbSiswa.results.map((s: any) => [s.nisn ? String(s.nisn).trim() : '', s.id])
  )

  const toUpsert: any[] = []
  const errorLogs: string[] = []

  for (let i = 0; i < validatedRows.length; i++) {
    const row = validatedRows[i]

    const nisnKey = Object.keys(row).find((k) => k.toUpperCase().trim() === 'NISN')
    const nisn = nisnKey ? String(row[nisnKey]).trim() : ''

    if (!nisn) {
      errorLogs.push(`Baris ${i + 2}: NISN kosong, dilewati`)
      continue
    }

    const siswaId = nisnMap.get(nisn)
    if (!siswaId) {
      errorLogs.push(`Baris ${i + 2}: NISN ${nisn} tidak ditemukan`)
      continue
    }

    // Ambil semua kolom nilai dari baris Excel (kecuali NISN dan NAMA)
    const nilaiObj: Record<string, number> = {}
    for (const [key, val] of Object.entries(row)) {
      const upperKey = key.toUpperCase().trim()
      if (['NISN', 'NAMA', 'NAMA_LENGKAP', 'NO'].includes(upperKey)) continue
      const mapelCanonical = kamusMapel.get(key.toLowerCase().trim())
      if (mapelCanonical && val !== '' && val !== null && val !== undefined) {
        const num = parseFloat(String(val))
        if (!isNaN(num)) nilaiObj[mapelCanonical] = num
      }
    }

    if (Object.keys(nilaiObj).length === 0) continue

    toUpsert.push({ siswaId, nilaiObj })
  }

  if (toUpsert.length === 0) {
    return {
      error:
        errorLogs.length > 0
          ? `Tidak ada data valid. Error: ${errorLogs.slice(0, 3).join('; ')}`
          : 'Tidak ada data nilai yang bisa diimport.',
      logs: errorLogs,
    }
  }

  // Ambil rekap nilai yang sudah ada untuk di-merge
  const existingIds = toUpsert.map((u) => u.siswaId)
  // Chunk fetch agar tidak over-limit query parameter
  const existingMap = new Map<string, any>()
  const fetchChunk = 50
  for (let i = 0; i < existingIds.length; i += fetchChunk) {
    const chunk = existingIds.slice(i, i + fetchChunk)
    const placeholders = chunk.map(() => '?').join(',')
    const rows = await db
      .prepare(`SELECT siswa_id, ${targetKolom} FROM rekap_nilai_akademik WHERE siswa_id IN (${placeholders})`)
      .bind(...chunk)
      .all<any>()
    rows.results.forEach((r: any) => existingMap.set(r.siswa_id, r))
  }

  // Build upsert statements
  const now = new Date().toISOString()
  const stmts = toUpsert.map(({ siswaId, nilaiObj }) => {
    const existing = existingMap.get(siswaId)
    const existingNilai = existing ? parseJsonCol<Record<string, number>>(existing[targetKolom], {}) : {}
    const merged = { ...existingNilai, ...nilaiObj }

    if (existing) {
      return db
        .prepare(
          `UPDATE rekap_nilai_akademik SET ${targetKolom} = ?, updated_at = ? WHERE siswa_id = ?`
        )
        .bind(JSON.stringify(merged), now, siswaId)
    } else {
      return db
        .prepare(
          `INSERT INTO rekap_nilai_akademik (siswa_id, ${targetKolom}, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(siswa_id) DO UPDATE SET ${targetKolom} = excluded.${targetKolom}, updated_at = excluded.updated_at`
        )
        .bind(siswaId, JSON.stringify(merged), now)
    }
  })

  // Chunk batch per 50 agar tidak melebihi D1 limit
  const chunkSize = 50
  let successCount = 0
  for (let i = 0; i < stmts.length; i += chunkSize) {
    const results = await db.batch(stmts.slice(i, i + chunkSize))
    successCount += results.filter((r) => r.success).length
  }

  revalidatePath('/dashboard/akademik/analitik')

  let successMsg = `Selesai! Berhasil memploting nilai ${targetKolom} untuk ${successCount} siswa.`
  if (errorLogs.length > 0) {
    successMsg += ` Terdapat ${errorLogs.length} notifikasi baris yang dilewati (lihat log).`
  }

  return {
    error: successCount === 0 ? 'Tidak ada data yang berhasil diimport.' : null,
    success: successMsg,
    logs: errorLogs,
  }
}

// ============================================================
// 3. RESET NILAI SATU KOLOM
// ============================================================
export async function resetNilaiKolom(targetKolom: string) {
  await requireActionAccess('analitik', 'delete', { allowedRoles: [...ADMINISTRATIVE_ROLES] })
  if (!isValidNilaiColumn(targetKolom)) return { error: 'Kolom target tidak valid.' }
  const db = await getDB()
  try {
    await db
      .prepare(`UPDATE rekap_nilai_akademik SET ${targetKolom} = '{}', updated_at = ?`)
      .bind(new Date().toISOString())
      .run()
  } catch (error) {
    return publicServerError('analitik.reset_nilai', error)
  }
  revalidatePath('/dashboard/akademik/analitik')
  return { success: `Kolom ${targetKolom} berhasil direset.` }
}
