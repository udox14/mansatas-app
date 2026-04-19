// app/dashboard/akademik/nilai/actions.ts
'use server'

import { getDB, parseJsonCol } from '@/utils/db'
import { revalidatePath } from 'next/cache'
import { SEMESTER_MAP, SEMESTER_KEYS } from './constants'

// ============================================================
// IMPORT NILAI DARI EXCEL (dipertahankan dari MANSATAS)
// Chunk upsert per 50 baris agar tidak spike memory di Worker
// ============================================================
export async function validateImportNilai(dataExcel: any[], targetKolom: string) {
  if (!SEMESTER_KEYS.includes(targetKolom)) {
    return { error: `Kolom target "${targetKolom}" tidak valid.` }
  }

  const db = await getDB()
  const [dbSiswa, dbMapel] = await Promise.all([
    db.prepare(`
      SELECT s.id, s.nisn, s.nama_lengkap, k.tingkat, k.nomor_kelas, k.kelompok 
      FROM siswa s 
      LEFT JOIN kelas k ON s.kelas_id = k.id 
      WHERE s.status = 'aktif'
    `).all<any>(),
    db.prepare('SELECT nama_mapel, kode_mapel FROM mata_pelajaran').all<any>(),
  ])

  if (!dbSiswa.results.length) return { error: 'Gagal memuat database siswa' }
  const siswaList = dbSiswa.results

  const kamusMapel = new Map<string, string>()
  dbMapel.results.forEach((m: any) => {
    kamusMapel.set(m.nama_mapel.toLowerCase().trim(), m.nama_mapel)
    if (m.kode_mapel) kamusMapel.set(m.kode_mapel.toLowerCase().trim(), m.nama_mapel)
  })

  const nisnMap = new Map<string, any>()
  siswaList.forEach((s: any) => {
    if (s.nisn) nisnMap.set(String(s.nisn).trim(), s)
  })

  const readyToImport: any[] = []
  const needsVerification: any[] = []
  const errorLogs: string[] = []

  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]
    if (!row) continue

    const nisnKey = Object.keys(row).find((k) => k.toUpperCase().trim() === 'NISN')
    const nisn = nisnKey ? String(row[nisnKey]).trim() : ''
    
    const namaKey = Object.keys(row).find((k) => {
      const up = k.toUpperCase().trim()
      return up === 'NAMA' || up === 'NAMA LENGKAP' || up === 'NAMA_LENGKAP' || up === 'NAMA SISWA'
    })
    const namaExcel = namaKey ? String(row[namaKey]).trim() : `Baris ${i+2}`

    const nilaiObj: Record<string, number> = {}
    for (const [key, val] of Object.entries(row)) {
      const upperKey = key.toUpperCase().trim()
      if (['NISN', 'NAMA', 'NAMA_LENGKAP', 'NAMA SISWA', 'NO'].includes(upperKey)) continue
      const mapelCanonical = kamusMapel.get(key.toLowerCase().trim())
      if (mapelCanonical && val !== '' && val !== null && val !== undefined) {
        const num = parseFloat(String(val))
        if (!isNaN(num)) nilaiObj[mapelCanonical] = num
      }
    }

    if (Object.keys(nilaiObj).length === 0) {
      if (nisn) errorLogs.push(`Baris ${i + 2}: Tidak ada nilai yang cocok dengan mata pelajaran sistem untuk ${namaExcel}`)
      continue
    }

    const exactStudent = nisn ? nisnMap.get(nisn) : undefined
    
    if (exactStudent) {
      readyToImport.push({
        siswaId: exactStudent.id,
        namaExcel,
        namaDb: exactStudent.nama_lengkap,
        nisn,
        nilaiObj
      })
    } else {
      // Fuzzy string match
      const searchExcel = namaExcel.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
      
      const suggestedMatches = siswaList.filter((s:any) => {
        const dName = s.nama_lengkap.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
        if (searchExcel.length < 3 || dName.length < 3) return false
        return dName.includes(searchExcel) || searchExcel.includes(dName)
      }).slice(0, 5)

      if (suggestedMatches.length > 0) {
        needsVerification.push({
          rowId: i,
          namaExcel,
          nisnExcel: nisn,
          suggestedMatches,
          nilaiObj
        })
      } else {
         errorLogs.push(`Baris ${i + 2}: NISN '${nisn}' salah & tidak ada kemiripan pada nama '${namaExcel}'`)
      }
    }
  }

  return { readyToImport, needsVerification, errorLogs }
}

// Eksekusi Pukulan Akhir
export async function simpanImportNilai(preparedRows: { siswaId: string, nilaiObj: Record<string, number> }[], targetKolom: string) {
  if (!SEMESTER_KEYS.includes(targetKolom)) return { error: `Kolom target tidak valid.` }
  if (preparedRows.length === 0) return { error: 'Daftar penyisipan kosong.' }
  
  const db = await getDB()
  const existingIds = preparedRows.map((u) => u.siswaId)
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

  const now = new Date().toISOString()
  const stmts = preparedRows.map(({ siswaId, nilaiObj }) => {
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

  let successCount = 0
  const chunkSize = 50
  for (let i = 0; i < stmts.length; i += chunkSize) {
    const results = await db.batch(stmts.slice(i, i + chunkSize))
    successCount += results.filter((r) => r.success).length
  }

  revalidatePath('/dashboard/akademik/nilai')
  revalidatePath('/dashboard/siswa')
  
  return { success: `Berhasil import nilai untuk ${successCount} santri ke kolom ${SEMESTER_MAP[targetKolom as keyof typeof SEMESTER_MAP]}.` }
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
