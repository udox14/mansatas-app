// app/dashboard/akademik/nilai/actions.ts
'use server'

import { getDB, parseJsonCol } from '@/utils/db'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { revalidatePath } from 'next/cache'
import { SEMESTER_MAP, SEMESTER_KEYS } from './constants'
import { getCurrentUser } from '@/utils/auth/server'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'

// ============================================================
// KV CACHE — rekap nilai jarang berubah (update per semester).
// Invalidasi manual saat import/reset, bukan TTL pendek.
// ============================================================
const REKAP_TABEL_KEY = 'rekap:nilai:tabel:v3'
const REKAP_TABEL_TTL = 86400 // 24 jam (safety net; sumber kebenaran = invalidasi saat tulis)
const NILAI_MANAGER_ROLES = ['super_admin', 'admin_tu', 'kepsek', 'wakamad']

async function getNilaiAccess(db: D1Database) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')

  const [allowed, roles] = await Promise.all([
    checkFeatureAccess(db, user.id, 'akademik-nilai'),
    getUserRoles(db, user.id),
  ])
  if (!allowed) throw new Error('Anda tidak memiliki akses Rekap Nilai.')

  return {
    user,
    roles,
    canManage: roles.some((role) => NILAI_MANAGER_ROLES.includes(role)),
  }
}

async function requireNilaiManager(db: D1Database) {
  const access = await getNilaiAccess(db)
  if (!access.canManage) throw new Error('Hanya pengelola akademik yang dapat mengubah rekap nilai.')
  return access
}

async function getRekapKV(): Promise<KVNamespace | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return (env.NEXT_INC_CACHE_KV as KVNamespace) ?? null
  } catch {
    return null
  }
}

async function invalidateRekapCache() {
  const kv = await getRekapKV()
  if (kv) {
    try {
      await kv.delete(REKAP_TABEL_KEY)
    } catch {
      // abaikan; TTL akan kedaluwarsa sendiri
    }
  }
}

// ============================================================
// IMPORT NILAI DARI EXCEL (dipertahankan dari MANSATAS)
// Chunk upsert per 50 baris agar tidak spike memory di Worker
// ============================================================
export async function validateImportNilai(dataExcel: any[], targetKolom: string) {
  if (!SEMESTER_KEYS.includes(targetKolom)) {
    return { error: `Kolom target "${targetKolom}" tidak valid.` }
  }

  const db = await getDB()
  await requireNilaiManager(db)
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
export async function simpanImportNilai(preparedRows: { siswaId: string, nilaiObj: Record<string, number>, newNisn?: string }[], targetKolom: string) {
  if (!SEMESTER_KEYS.includes(targetKolom)) return { error: `Kolom target tidak valid.` }
  if (preparedRows.length === 0) return { error: 'Daftar penyisipan kosong.' }
  
  const db = await getDB()
  await requireNilaiManager(db)
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

  // Tambahkan statement untuk update NISN jika ada
  preparedRows.forEach(({ siswaId, newNisn }) => {
    if (newNisn) {
      stmts.push(db.prepare('UPDATE siswa SET nisn = ?, updated_at = ? WHERE id = ?').bind(newNisn, now, siswaId))
    }
  })

  let successCount = 0
  const chunkSize = 50
  for (let i = 0; i < stmts.length; i += chunkSize) {
    const results = await db.batch(stmts.slice(i, i + chunkSize))
    // Filter results to only count updates/inserts to rekap_nilai_akademik roughly by checking chunk size or we just count preparedRows.
    // For simplicity, we just count based on preparedRows instead of db.batch results since db.batch either succeeds or throws on D1.
  }
  successCount = preparedRows.length

  await invalidateRekapCache()
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
  await requireNilaiManager(db)
  try {
    await db
      .prepare(`UPDATE rekap_nilai_akademik SET ${targetKolom} = '{}', updated_at = ?`)
      .bind(new Date().toISOString())
      .run()
  } catch (e: any) {
    return { error: e.message }
  }
  await invalidateRekapCache()
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
// GET REKAP NILAI TABEL (lihat semua siswa per kelas, nilai per mapel)
// ============================================================
export type RekapSiswaRow = {
  id: string
  nisn: string
  nama_lengkap: string
  jenis_kelamin: string
  kelas_id: string | null
  tingkat: number | null
  nomor_kelas: string | null
  kelompok: string | null
  nilai: Record<string, Record<string, number>> // { nilai_smt1: {...}, ... }
}

export type RekapTabelPayload = {
  siswa: RekapSiswaRow[]
  mapelOrder: string[]
  kodeByMapel: Record<string, string> // nama_mapel -> kode_mapel (RDM) dari pusat akademik
  scopedToTeachingAssignments: boolean
}

export async function getRekapNilaiTabel(): Promise<RekapTabelPayload> {
  const db = await getDB()
  const access = await getNilaiAccess(db)
  const scopedToTeachingAssignments = !access.canManage
  const kv = scopedToTeachingAssignments ? null : await getRekapKV()

  if (kv) {
    try {
      const cached = await kv.get<RekapTabelPayload>(REKAP_TABEL_KEY, 'json')
      if (cached) return cached
    } catch {
      // abaikan error baca, fallback ke D1
    }
  }

  let siswaRes: D1Result<any>
  let mapelRows: Array<{ nama_mapel: string; kode_mapel: string | null; kelas_id?: string }> = []
  const allowedMapelByKelas = new Map<string, Set<string>>()

  if (scopedToTeachingAssignments) {
    const assignmentRes = await db.prepare(`
      SELECT DISTINCT pm.kelas_id, mp.nama_mapel, mp.kode_mapel, mp.kategori
      FROM penugasan_mengajar pm
      JOIN tahun_ajaran ta ON ta.id = pm.tahun_ajaran_id AND ta.is_active = 1
      JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
      WHERE pm.guru_id = ?
      ORDER BY mp.kategori, mp.nama_mapel
    `).bind(access.user.id).all<any>()

    mapelRows = assignmentRes.results || []
    for (const row of mapelRows) {
      const existing = allowedMapelByKelas.get(row.kelas_id!) || new Set<string>()
      existing.add(row.nama_mapel)
      allowedMapelByKelas.set(row.kelas_id!, existing)
    }

    const kelasIds = Array.from(allowedMapelByKelas.keys())
    if (kelasIds.length === 0) {
      siswaRes = { results: [], success: true, meta: {} } as D1Result<any>
    } else {
      const placeholders = kelasIds.map(() => '?').join(',')
      siswaRes = await db.prepare(`
        SELECT s.id, s.nisn, s.nama_lengkap, s.jenis_kelamin,
               k.id AS kelas_id, k.tingkat, k.nomor_kelas, k.kelompok,
               r.nilai_smt1, r.nilai_smt2, r.nilai_smt3,
               r.nilai_smt4, r.nilai_smt5, r.nilai_smt6
        FROM siswa s
        JOIN kelas k ON s.kelas_id = k.id
        LEFT JOIN rekap_nilai_akademik r ON r.siswa_id = s.id
        WHERE s.status = 'aktif' AND k.id IN (${placeholders})
        ORDER BY k.tingkat, k.kelompok, k.nomor_kelas, s.nama_lengkap
      `).bind(...kelasIds).all<any>()
    }
  } else {
    const [allSiswaRes, mapelRes] = await Promise.all([
      db.prepare(`
        SELECT s.id, s.nisn, s.nama_lengkap, s.jenis_kelamin,
               k.id AS kelas_id, k.tingkat, k.nomor_kelas, k.kelompok,
               r.nilai_smt1, r.nilai_smt2, r.nilai_smt3,
               r.nilai_smt4, r.nilai_smt5, r.nilai_smt6
        FROM siswa s
        LEFT JOIN kelas k ON s.kelas_id = k.id
        LEFT JOIN rekap_nilai_akademik r ON r.siswa_id = s.id
        WHERE s.status = 'aktif'
        ORDER BY k.tingkat, k.kelompok, k.nomor_kelas, s.nama_lengkap
      `).all<any>(),
      db.prepare('SELECT nama_mapel, kode_mapel FROM mata_pelajaran ORDER BY kategori, nama_mapel').all<any>(),
    ])
    siswaRes = allSiswaRes
    mapelRows = mapelRes.results || []
  }

  const filterNilai = (raw: string | null | undefined, kelasId: string | null) => {
    const nilai = parseJsonCol<Record<string, number>>(raw, {})
    if (!scopedToTeachingAssignments || !kelasId) return nilai
    const allowedMapel = allowedMapelByKelas.get(kelasId) || new Set<string>()
    return Object.fromEntries(Object.entries(nilai).filter(([mapel]) => allowedMapel.has(mapel)))
  }

  const siswa: RekapSiswaRow[] = siswaRes.results.map((s: any) => ({
    id: s.id,
    nisn: s.nisn,
    nama_lengkap: s.nama_lengkap,
    jenis_kelamin: s.jenis_kelamin,
    kelas_id: s.kelas_id,
    tingkat: s.tingkat,
    nomor_kelas: s.nomor_kelas,
    kelompok: s.kelompok,
    nilai: {
      nilai_smt1: filterNilai(s.nilai_smt1, s.kelas_id),
      nilai_smt2: filterNilai(s.nilai_smt2, s.kelas_id),
      nilai_smt3: filterNilai(s.nilai_smt3, s.kelas_id),
      nilai_smt4: filterNilai(s.nilai_smt4, s.kelas_id),
      nilai_smt5: filterNilai(s.nilai_smt5, s.kelas_id),
      nilai_smt6: filterNilai(s.nilai_smt6, s.kelas_id),
    },
  }))

  const kodeByMapel: Record<string, string> = {}
  for (const m of mapelRows) {
    if (m.kode_mapel) kodeByMapel[m.nama_mapel] = String(m.kode_mapel).trim()
  }

  const mapelOrder = Array.from(new Set(mapelRows.map((m) => m.nama_mapel)))

  const payload: RekapTabelPayload = {
    siswa,
    mapelOrder,
    kodeByMapel,
    scopedToTeachingAssignments,
  }

  if (kv) {
    try {
      await kv.put(REKAP_TABEL_KEY, JSON.stringify(payload), { expirationTtl: REKAP_TABEL_TTL })
    } catch {
      // abaikan error tulis cache
    }
  }

  return payload
}

// ============================================================
// GET RINGKASAN IMPORT (berapa siswa sudah ada nilainya per semester)
// ============================================================
export async function getRingkasanImport() {
  const db = await getDB()
  await requireNilaiManager(db)
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
