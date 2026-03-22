// Lokasi: app/dashboard/akademik/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { revalidatePath } from 'next/cache'

// ============================================================
// 1. MAPEL ACTIONS
// ============================================================
export async function tambahMapel(prevState: any, formData: FormData) {
  const db = await getDB()
  const payload = {
    nama_mapel: formData.get('nama_mapel') as string,
    kode_mapel: (formData.get('kode_mapel') as string) || null,
    kelompok: formData.get('kelompok') as string,
    tingkat: formData.get('tingkat') as string,
    kategori: formData.get('kategori') as string,
  }
  const result = await dbInsert(db, 'mata_pelajaran', payload)
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/akademik')
  return { success: 'Mata pelajaran berhasil ditambahkan' }
}

export async function editMapel(prevState: any, formData: FormData) {
  const db = await getDB()
  const id = formData.get('id') as string
  const payload = {
    nama_mapel: formData.get('nama_mapel') as string,
    kode_mapel: (formData.get('kode_mapel') as string) || null,
    kelompok: formData.get('kelompok') as string,
    tingkat: formData.get('tingkat') as string,
    kategori: formData.get('kategori') as string,
  }
  const result = await dbUpdate(db, 'mata_pelajaran', payload, { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/akademik')
  return { success: 'Mata pelajaran berhasil diperbarui' }
}

export async function hapusMapel(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'mata_pelajaran', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/akademik')
  return { success: 'Mata pelajaran berhasil dihapus' }
}

export async function importMapelMassal(dataExcel: any[]) {
  const db = await getDB()
  const toInsert = dataExcel
    .map((row) => ({
      nama_mapel: String(row.NAMA_MAPEL).trim(),
      kode_mapel: row.KODE_RDM ? String(row.KODE_RDM).trim() : null,
      kelompok: String(row.KELOMPOK || 'UMUM').trim(),
      tingkat: String(row.TINGKAT || 'Semua').trim(),
      kategori: String(row.KATEGORI || 'Umum').trim(),
    }))
    .filter((item) => item.nama_mapel && item.nama_mapel !== 'undefined')

  if (toInsert.length === 0) return { error: 'Tidak ada data valid untuk diimport.' }

  const { successCount, error } = await (await import('@/utils/db')).dbBatchInsert(db, 'mata_pelajaran', toInsert)
  if (error) return { error }
  revalidatePath('/dashboard/akademik')
  return { success: `Berhasil mengimport ${successCount} mata pelajaran.` }
}

// ============================================================
// 2. PENUGASAN ACTIONS
// ============================================================
export async function tambahPenugasan(prevState: any, formData: FormData) {
  const db = await getDB()
  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<any>()
  if (!ta) return { error: 'Tahun Ajaran aktif belum diatur.' }

  const payload = {
    guru_id: formData.get('guru_id') as string,
    mapel_id: formData.get('mapel_id') as string,
    kelas_id: formData.get('kelas_id') as string,
    tahun_ajaran_id: ta.id,
  }
  if (!payload.guru_id || !payload.mapel_id || !payload.kelas_id) return { error: 'Semua field wajib diisi.' }

  const result = await dbInsert(db, 'penugasan_mengajar', payload)
  if (result.error) {
    return { error: result.error.includes('UNIQUE') ? 'Penugasan ini sudah ada.' : result.error }
  }
  revalidatePath('/dashboard/akademik')
  return { success: 'Penugasan berhasil ditambahkan.' }
}

export async function hapusPenugasan(id: string) {
  const db = await getDB()
  // Jadwal ikut terhapus via CASCADE
  const result = await dbDelete(db, 'penugasan_mengajar', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/akademik')
  return { success: 'Penugasan (dan jadwal terkait) berhasil dihapus.' }
}

export async function resetPenugasanSemesterIni(tahun_ajaran_id: string) {
  const db = await getDB()
  try {
    // Jadwal ikut terhapus via CASCADE
    await db.prepare('DELETE FROM penugasan_mengajar WHERE tahun_ajaran_id = ?').bind(tahun_ajaran_id).run()
    revalidatePath('/dashboard/akademik')
    return { success: 'Semua penugasan & jadwal semester ini berhasil dihapus.' }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ============================================================
// 3. IMPORT XML ASC → PENUGASAN + JADWAL SEKALIGUS
//    Satu fungsi, satu transaksi, hemat reads
// ============================================================
export async function importJadwalASC(xmlText: string): Promise<{
  success: string | null
  error: string | null
  logs: string[]
  stats: { penugasan: number; jadwal: number }
}> {
  const db = await getDB()

  // Ambil TA aktif + lookup data dalam 1 batch
  const [taRow, guruAll, mapelAll, kelasAll] = await Promise.all([
    db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>(),
    db.prepare('SELECT id, LOWER(TRIM(nama_lengkap)) as nama FROM "user" WHERE nama_lengkap IS NOT NULL').all<any>(),
    db.prepare('SELECT id, LOWER(TRIM(nama_mapel)) as nama FROM mata_pelajaran').all<any>(),
    db.prepare('SELECT id, CAST(tingkat AS INTEGER) as tingkat, TRIM(nomor_kelas) as nomor FROM kelas').all<any>(),
  ])

  if (!taRow) return { success: null, error: 'Tahun Ajaran aktif belum diatur.', logs: [], stats: { penugasan: 0, jadwal: 0 } }
  const taId = taRow.id

  // Build lookup maps
  const guruMap = new Map<string, string>()
  for (const g of guruAll.results || []) guruMap.set(g.nama, g.id)

  const mapelMap = new Map<string, string>()
  for (const m of mapelAll.results || []) mapelMap.set(m.nama, m.id)

  // kelas: key = "tingkat-nomor" → id (asumsi unique per tingkat+nomor)
  const kelasMap = new Map<string, string>()
  for (const k of kelasAll.results || []) kelasMap.set(`${k.tingkat}-${String(k.nomor).trim()}`, k.id)

  // ── Parse XML ──────────────────────────────────────────────────────────
  // Pakai DOMParser / regex ringan karena tidak ada xml lib di edge runtime
  const parseAttrs = (tag: string): Map<string, string> => {
    const map = new Map<string, string>()
    const re = /(\w+)="([^"]*)"/g
    let m: RegExpExecArray | null
    while ((m = re.exec(tag)) !== null) map.set(m[1], m[2])
    return map
  }

  // Helper: konversi nama kelas ASC → tingkat + nomor
  // X-1→10-1, XI-5→11-5, XII-16→12-16
  const parseKelasName = (name: string): { tingkat: number; nomor: string } | null => {
    const upper = name.toUpperCase().trim()
    let tingkat = 0
    let rest = ''
    if (upper.startsWith('XII-')) { tingkat = 12; rest = upper.slice(4) }
    else if (upper.startsWith('XI-')) { tingkat = 11; rest = upper.slice(3) }
    else if (upper.startsWith('X-')) { tingkat = 10; rest = upper.slice(2) }
    else return null
    const nomor = rest.trim()
    if (!nomor) return null
    return { tingkat, nomor }
  }

  // Days bitmask → hari integer (1=Senin..6=Sabtu)
  const daysToHari = (days: string): number => {
    if (days === '100000') return 1
    if (days === '010000') return 2
    if (days === '001000') return 3
    if (days === '000100') return 4
    if (days === '000010') return 5
    if (days === '000001') return 6
    return 0
  }

  // Extract semua tag dari XML
  const extractTags = (xml: string, tagName: string): string[] => {
    const re = new RegExp(`<${tagName}\\s[^>]*/?>`, 'g')
    return xml.match(re) || []
  }

  const logs: string[] = []

  // Parse subjects, teachers, classes
  const xmlSubjects = new Map<string, string>() // id → name
  for (const tag of extractTags(xmlText, 'subject')) {
    const a = parseAttrs(tag)
    if (a.get('id') && a.get('name')) xmlSubjects.set(a.get('id')!, a.get('name')!)
  }

  const xmlTeachers = new Map<string, string>() // id → name
  for (const tag of extractTags(xmlText, 'teacher')) {
    const a = parseAttrs(tag)
    if (a.get('id') && a.get('name')) xmlTeachers.set(a.get('id')!, a.get('name')!)
  }

  const xmlClasses = new Map<string, string>() // id → name
  for (const tag of extractTags(xmlText, 'class')) {
    const a = parseAttrs(tag)
    if (a.get('id') && a.get('name')) xmlClasses.set(a.get('id')!, a.get('name')!)
  }

  // Parse lessons
  type LessonInfo = { classId: string; subjectId: string; teacherId: string }
  const xmlLessons = new Map<string, LessonInfo>()
  for (const tag of extractTags(xmlText, 'lesson')) {
    const a = parseAttrs(tag)
    const id = a.get('id')
    const classids = a.get('classids') || ''
    const subjectid = a.get('subjectid') || ''
    const teacherids = a.get('teacherids') || ''
    if (id && classids && subjectid && teacherids) {
      xmlLessons.set(id, { classId: classids, subjectId: subjectid, teacherId: teacherids })
    }
  }

  // Parse cards → flatten ke rows
  type JadwalRow = { guruId: string; mapelId: string; kelasId: string; hari: number; jamKe: number }
  const jadwalRows: JadwalRow[] = []
  const skipped = { noLesson: 0, noGuru: 0, noMapel: 0, noKelas: 0, noHari: 0 }

  for (const tag of extractTags(xmlText, 'card')) {
    const a = parseAttrs(tag)
    const lessonId = a.get('lessonid') || ''
    const period = parseInt(a.get('period') || '0')
    const days = a.get('days') || ''

    if (!lessonId || !period || !days) continue

    const lesson = xmlLessons.get(lessonId)
    if (!lesson) { skipped.noLesson++; continue }

    const hari = daysToHari(days)
    if (!hari) { skipped.noHari++; continue }

    // Resolve guru
    const guruNamaXml = xmlTeachers.get(lesson.teacherId) || ''
    let guruId = guruMap.get(guruNamaXml.toLowerCase().trim())
    if (!guruId) {
      // Fuzzy: cari yang include
      for (const [nama, id] of guruMap) {
        const a = guruNamaXml.toLowerCase()
        if (a.includes(nama) || nama.includes(a)) { guruId = id; break }
      }
    }
    if (!guruId) { skipped.noGuru++; logs.push(`Guru tidak ditemukan: "${guruNamaXml}"`); continue }

    // Resolve mapel
    const mapelNamaXml = xmlSubjects.get(lesson.subjectId) || ''
    let mapelId = mapelMap.get(mapelNamaXml.toLowerCase().trim())
    if (!mapelId) {
      for (const [nama, id] of mapelMap) {
        const a = mapelNamaXml.toLowerCase()
        if (a.includes(nama) || nama.includes(a)) { mapelId = id; break }
      }
    }
    if (!mapelId) { skipped.noMapel++; logs.push(`Mapel tidak ditemukan: "${mapelNamaXml}"`); continue }

    // Resolve kelas
    const kelasNamaXml = xmlClasses.get(lesson.classId) || ''
    const parsed = parseKelasName(kelasNamaXml)
    if (!parsed) { skipped.noKelas++; logs.push(`Format kelas tidak dikenali: "${kelasNamaXml}"`); continue }
    const kelasId = kelasMap.get(`${parsed.tingkat}-${parsed.nomor}`)
    if (!kelasId) { skipped.noKelas++; logs.push(`Kelas tidak ditemukan di DB: "${kelasNamaXml}" (${parsed.tingkat}-${parsed.nomor})`); continue }

    jadwalRows.push({ guruId, mapelId, kelasId, hari, jamKe: period })
  }

  if (jadwalRows.length === 0) {
    return { success: null, error: 'Tidak ada data jadwal yang berhasil diproses.', logs, stats: { penugasan: 0, jadwal: 0 } }
  }

  // ── Hapus data lama TA aktif (penugasan CASCADE ke jadwal) ─────────────
  await db.prepare('DELETE FROM penugasan_mengajar WHERE tahun_ajaran_id = ?').bind(taId).run()

  // ── Build penugasan unik ───────────────────────────────────────────────
  // key = "guruId|mapelId|kelasId" (pakai | supaya tidak bentrok dengan hex ID)
  const penugasanKeyToId = new Map<string, string>()
  for (const row of jadwalRows) {
    const key = `${row.guruId}|${row.mapelId}|${row.kelasId}`
    if (!penugasanKeyToId.has(key)) {
      penugasanKeyToId.set(key, crypto.randomUUID().replace(/-/g, ''))
    }
  }

  // ── Batch insert penugasan ─────────────────────────────────────────────
  // D1 limit: 100 SQL variables per statement
  // penugasan: 5 kolom per row → max 15 rows per chunk (15×5=75, aman)
  const CHUNK_P = 15
  const penugasanEntries = Array.from(penugasanKeyToId.entries())

  // Simpan mapping key → {pid, guruId, mapelId, kelasId} supaya split aman
  type PenugasanEntry = { pid: string; guruId: string; mapelId: string; kelasId: string }
  const penugasanList: PenugasanEntry[] = []
  for (const [key, pid] of penugasanEntries) {
    // key format: "guruId|mapelId|kelasId" — pakai | bukan - supaya tidak bentrok dengan hex ID
    const parts = key.split('|')
    penugasanList.push({ pid, guruId: parts[0], mapelId: parts[1], kelasId: parts[2] })
  }

  let penugasanCount = 0
  for (let i = 0; i < penugasanList.length; i += CHUNK_P) {
    const chunk = penugasanList.slice(i, i + CHUNK_P)
    const values = chunk.flatMap(r => [r.pid, r.guruId, r.mapelId, r.kelasId, taId])
    const placeholders = chunk.map(() => `(?, ?, ?, ?, ?, datetime('now'))`).join(', ')
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO penugasan_mengajar (id, guru_id, mapel_id, kelas_id, tahun_ajaran_id, created_at) VALUES ${placeholders}`
      ).bind(...values).run()
      penugasanCount += chunk.length
    } catch (e: any) {
      logs.push(`Error insert penugasan chunk ${i}: ${e.message}`)
    }
  }

  // ── Batch insert jadwal ────────────────────────────────────────────────
  // jadwal: 5 kolom per row → max 15 rows per chunk (15×5=75, aman)
  const CHUNK_J = 15
  const jadwalSeen = new Set<string>()
  const jadwalToInsert: Array<{ pid: string; hari: number; jamKe: number }> = []

  for (const row of jadwalRows) {
    const key = `${row.guruId}|${row.mapelId}|${row.kelasId}`
    const pid = penugasanKeyToId.get(key)
    if (!pid) continue
    const uniqKey = `${pid}|${row.hari}|${row.jamKe}`
    if (jadwalSeen.has(uniqKey)) continue
    jadwalSeen.add(uniqKey)
    jadwalToInsert.push({ pid, hari: row.hari, jamKe: row.jamKe })
  }

  let jadwalCount = 0
  for (let i = 0; i < jadwalToInsert.length; i += CHUNK_J) {
    const chunk = jadwalToInsert.slice(i, i + CHUNK_J)
    const values = chunk.flatMap(r => [crypto.randomUUID().replace(/-/g, ''), r.pid, taId, r.hari, r.jamKe])
    const placeholders = chunk.map(() => `(?, ?, ?, ?, ?, datetime('now'))`).join(', ')
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO jadwal_mengajar (id, penugasan_id, tahun_ajaran_id, hari, jam_ke, created_at) VALUES ${placeholders}`
      ).bind(...values).run()
      jadwalCount += chunk.length
    } catch (e: any) {
      logs.push(`Error insert jadwal chunk ${i}: ${e.message}`)
    }
  }

  revalidatePath('/dashboard/akademik')

  return {
    success: `Import selesai: ${penugasanCount} penugasan & ${jadwalCount} slot jadwal berhasil disimpan.`,
    error: null,
    logs,
    stats: { penugasan: penugasanCount, jadwal: jadwalCount },
  }
}

// ============================================================
// 4. JADWAL CRUD (edit manual per cell)
// ============================================================

// Ambil jadwal per kelas — lazy load, dipanggil dari client
export async function getJadwalByKelas(kelas_id: string, tahun_ajaran_id: string) {
  const db = await getDB()
  const result = await db.prepare(`
    SELECT
      jm.id, jm.hari, jm.jam_ke,
      pm.id as penugasan_id,
      u.nama_lengkap as guru_nama,
      mp.nama_mapel,
      mp.id as mapel_id,
      u.id as guru_id
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN "user" u ON pm.guru_id = u.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    WHERE pm.kelas_id = ? AND jm.tahun_ajaran_id = ?
    ORDER BY jm.hari, jm.jam_ke
  `).bind(kelas_id, tahun_ajaran_id).all<any>()
  return result.results || []
}

// Ambil jadwal per guru — lazy load
export async function getJadwalByGuru(guru_id: string, tahun_ajaran_id: string) {
  const db = await getDB()
  const result = await db.prepare(`
    SELECT
      jm.id, jm.hari, jm.jam_ke,
      pm.id as penugasan_id,
      mp.nama_mapel,
      mp.id as mapel_id,
      k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok,
      k.id as kelas_id
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    WHERE pm.guru_id = ? AND jm.tahun_ajaran_id = ?
    ORDER BY jm.hari, jm.jam_ke
  `).bind(guru_id, tahun_ajaran_id).all<any>()
  return result.results || []
}

// Edit satu slot jadwal (ubah penugasan/guru/mapel)
export async function editSlotJadwal(
  jadwal_id: string,
  penugasan_id_baru: string
) {
  const db = await getDB()
  const result = await dbUpdate(db, 'jadwal_mengajar', { penugasan_id: penugasan_id_baru }, { id: jadwal_id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/akademik')
  return { success: 'Slot jadwal berhasil diperbarui.' }
}

// Hapus satu slot jadwal
export async function hapusSlotJadwal(jadwal_id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'jadwal_mengajar', { id: jadwal_id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/akademik')
  return { success: 'Slot jadwal berhasil dihapus.' }
}

// Tambah slot jadwal baru (manual)
export async function tambahSlotJadwal(
  penugasan_id: string,
  tahun_ajaran_id: string,
  hari: number,
  jam_ke: number
) {
  const db = await getDB()
  const result = await dbInsert(db, 'jadwal_mengajar', { penugasan_id, tahun_ajaran_id, hari, jam_ke })
  if (result.error) {
    return { error: result.error.includes('UNIQUE') ? 'Slot hari & jam ini sudah terisi.' : result.error }
  }
  revalidatePath('/dashboard/akademik')
  return { success: 'Slot jadwal berhasil ditambahkan.' }
}

// Reset jadwal satu kelas
export async function resetJadwalKelas(kelas_id: string, tahun_ajaran_id: string) {
  const db = await getDB()
  try {
    await db.prepare(`
      DELETE FROM jadwal_mengajar
      WHERE tahun_ajaran_id = ?
        AND penugasan_id IN (
          SELECT id FROM penugasan_mengajar WHERE kelas_id = ? AND tahun_ajaran_id = ?
        )
    `).bind(tahun_ajaran_id, kelas_id, tahun_ajaran_id).run()
    revalidatePath('/dashboard/akademik')
    return { success: 'Jadwal kelas berhasil direset.' }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ============================================================
// 5. IMPORT PENUGASAN LEGACY (dari Excel — tetap ada)
// ============================================================
export async function importPenugasanASC(dataExcel: any[]) {
  const db = await getDB()
  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1').first<{ id: string }>()
  if (!ta) return { error: 'Tahun Ajaran aktif belum diatur.', success: null, logs: [] }

  const [guruAll, mapelAll, kelasAll] = await Promise.all([
    db.prepare('SELECT id, LOWER(TRIM(nama_lengkap)) as nama FROM "user" WHERE nama_lengkap IS NOT NULL').all<any>(),
    db.prepare('SELECT id, LOWER(TRIM(nama_mapel)) as nama FROM mata_pelajaran').all<any>(),
    db.prepare('SELECT id, CAST(tingkat AS INTEGER) as tingkat, TRIM(nomor_kelas) as nomor_kelas FROM kelas').all<any>(),
  ])

  const guruMap = new Map<string, string>()
  for (const g of guruAll.results || []) guruMap.set(g.nama, g.id)
  const mapelMap = new Map<string, string>()
  for (const m of mapelAll.results || []) mapelMap.set(m.nama, m.id)
  const kelasMap = new Map<string, string>()
  for (const k of kelasAll.results || []) kelasMap.set(`${k.tingkat}-${String(k.nomor_kelas).trim()}`, k.id)

  const errorLogs: string[] = []
  const toInsert: Array<{ guru_id: string; mapel_id: string; kelas_id: string }> = []
  const seen = new Set<string>()

  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]
    const namaGuru = String(row.NAMA_GURU || '').trim().toLowerCase()
    const namaKelas = String(row.NAMA_KELAS || '').trim()
    const namaMapel = String(row.NAMA_MAPEL || '').trim().toLowerCase()
    if (!namaGuru || !namaKelas || !namaMapel) continue

    let guruId = guruMap.get(namaGuru)
    if (!guruId) {
      for (const [nama, id] of guruMap) {
        if (nama.includes(namaGuru) || namaGuru.includes(nama)) { guruId = id; break }
      }
    }
    if (!guruId) { errorLogs.push(`Baris ${i + 2}: Guru "${row.NAMA_GURU}" tidak ditemukan.`); continue }

    let mapelId = mapelMap.get(namaMapel)
    if (!mapelId) {
      for (const [nama, id] of mapelMap) {
        if (nama.includes(namaMapel) || namaMapel.includes(nama)) { mapelId = id; break }
      }
    }
    if (!mapelId) { errorLogs.push(`Baris ${i + 2}: Mapel "${row.NAMA_MAPEL}" tidak ditemukan.`); continue }

    const upper = namaKelas.toUpperCase()
    let tingkat = 0, nomor = ''
    if (upper.startsWith('XII-')) { tingkat = 12; nomor = upper.slice(4) }
    else if (upper.startsWith('XI-')) { tingkat = 11; nomor = upper.slice(3) }
    else if (upper.startsWith('X-')) { tingkat = 10; nomor = upper.slice(2) }
    else { errorLogs.push(`Baris ${i + 2}: Format kelas "${namaKelas}" tidak valid.`); continue }

    const kelasId = kelasMap.get(`${tingkat}-${nomor.trim()}`)
    if (!kelasId) { errorLogs.push(`Baris ${i + 2}: Kelas "${namaKelas}" tidak ditemukan.`); continue }

    const key = `${guruId}-${mapelId}-${kelasId}`
    if (seen.has(key)) continue
    seen.add(key)
    toInsert.push({ guru_id: guruId, mapel_id: mapelId, kelas_id: kelasId })
  }

  if (toInsert.length === 0) return { error: 'Tidak ada data yang berhasil diproses.', success: null, logs: errorLogs }

  const chunkSize = 25
  let successCount = 0
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize)
    const placeholders = chunk.map(() => `(lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'))`).join(', ')
    const values = chunk.flatMap(r => [r.guru_id, r.mapel_id, r.kelas_id, ta.id])
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO penugasan_mengajar (id, guru_id, mapel_id, kelas_id, tahun_ajaran_id, created_at) VALUES ${placeholders}`
      ).bind(...values).run()
      successCount += chunk.length
    } catch (e: any) {
      errorLogs.push(`Chunk ${Math.floor(i / chunkSize) + 1}: ${e.message}`)
    }
  }

  revalidatePath('/dashboard/akademik')
  return {
    success: `Berhasil mengimport ${successCount} dari ${dataExcel.length} penugasan.`,
    error: successCount === 0 ? 'Tidak ada data yang berhasil diimport.' : null,
    logs: errorLogs,
  }
}
