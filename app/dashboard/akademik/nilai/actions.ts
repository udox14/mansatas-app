// app/dashboard/akademik/nilai/actions.ts
'use server'

import { getDB, parseJsonCol } from '@/utils/db'
import { revalidatePath } from 'next/cache'
import { SEMESTER_MAP, SEMESTER_KEYS } from './constants'

// ============================================================
// IMPORT NILAI DARI EXCEL (dipertahankan dari MANSATAS)
// Chunk upsert per 50 baris agar tidak spike memory di Worker
// ============================================================
export async function importNilaiDariExcel(dataExcel: any[], targetKolom: string) {
  if (!SEMESTER_KEYS.includes(targetKolom)) {
    return { error: `Kolom target "${targetKolom}" tidak valid.`, logs: [] }
  }

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

  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]

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
      error: errorLogs.length > 0
        ? `Tidak ada data valid. Error: ${errorLogs.slice(0, 3).join('; ')}`
        : 'Tidak ada data nilai yang bisa diimport.',
      logs: errorLogs,
    }
  }

  // Ambil rekap nilai yang sudah ada untuk di-merge
  const existingIds = toUpsert.map((u) => u.siswaId)
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
        .prepare(`UPDATE rekap_nilai_akademik SET ${targetKolom} = ?, updated_at = ? WHERE siswa_id = ?`)
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

  // Chunk batch per 50
  const chunkSize = 50
  let successCount = 0
  for (let i = 0; i < stmts.length; i += chunkSize) {
    const results = await db.batch(stmts.slice(i, i + chunkSize))
    successCount += results.filter((r) => r.success).length
  }

  revalidatePath('/dashboard/akademik/nilai')
  revalidatePath('/dashboard/siswa')

  let successMsg = `Berhasil import ${SEMESTER_MAP[targetKolom]} untuk ${successCount} siswa.`
  if (errorLogs.length > 0) {
    successMsg += ` ${errorLogs.length} baris dilewati (lihat log).`
  }

  return {
    error: successCount === 0 ? 'Tidak ada data yang berhasil diimport.' : null,
    success: successMsg,
    logs: errorLogs,
  }
}

// ============================================================
// RESET NILAI SATU KOLOM
// ============================================================
export async function resetNilaiKolom(targetKolom: string) {
  if (!SEMESTER_KEYS.includes(targetKolom)) return { error: 'Kolom tidak valid.' }
  const db = await getDB()
  try {
    await db
      .prepare(`UPDATE rekap_nilai_akademik SET ${targetKolom} = '{}', updated_at = ?`)
      .bind(new Date().toISOString())
      .run()
  } catch (e: any) {
    return { error: e.message }
  }
  revalidatePath('/dashboard/akademik/nilai')
  return { success: `Kolom ${SEMESTER_MAP[targetKolom]} berhasil direset.` }
}

// ============================================================
// GET REKAP UNTUK SATU SISWA (dipakai di detail siswa)
// ============================================================
export async function getRekapNilaiSiswa(siswaId: string) {
  const db = await getDB()
  const row = await db
    .prepare('SELECT * FROM rekap_nilai_akademik WHERE siswa_id = ?')
    .bind(siswaId)
    .first<any>()
  if (!row) return null
  return {
    nilai_smt1: parseJsonCol<Record<string, number>>(row.nilai_smt1, {}),
    nilai_smt2: parseJsonCol<Record<string, number>>(row.nilai_smt2, {}),
    nilai_smt3: parseJsonCol<Record<string, number>>(row.nilai_smt3, {}),
    nilai_smt4: parseJsonCol<Record<string, number>>(row.nilai_smt4, {}),
    nilai_smt5: parseJsonCol<Record<string, number>>(row.nilai_smt5, {}),
    nilai_smt6: parseJsonCol<Record<string, number>>(row.nilai_smt6, {}),
  }
}

// ============================================================
// GET RINGKASAN IMPORT (berapa siswa sudah ada nilainya per semester)
// ============================================================
export async function getRingkasanImport() {
  const db = await getDB()
  const rows = await db.prepare(`
    SELECT
      SUM(CASE WHEN nilai_smt1 != '{}' AND nilai_smt1 IS NOT NULL THEN 1 ELSE 0 END) as smt1,
      SUM(CASE WHEN nilai_smt2 != '{}' AND nilai_smt2 IS NOT NULL THEN 1 ELSE 0 END) as smt2,
      SUM(CASE WHEN nilai_smt3 != '{}' AND nilai_smt3 IS NOT NULL THEN 1 ELSE 0 END) as smt3,
      SUM(CASE WHEN nilai_smt4 != '{}' AND nilai_smt4 IS NOT NULL THEN 1 ELSE 0 END) as smt4,
      SUM(CASE WHEN nilai_smt5 != '{}' AND nilai_smt5 IS NOT NULL THEN 1 ELSE 0 END) as smt5,
      SUM(CASE WHEN nilai_smt6 != '{}' AND nilai_smt6 IS NOT NULL THEN 1 ELSE 0 END) as smt6,
      COUNT(*) as total
    FROM rekap_nilai_akademik
  `).first<any>()
  return rows
}
