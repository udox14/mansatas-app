// Lokasi: app/dashboard/akademik/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete, parseJsonCol } from '@/utils/db'
import { requireUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import {
  applyAcademicDataset,
  buildAcademicDatasetFromAscXml,
  buildAcademicDatasetFromWizard,
  parseKelasName as parseSharedKelasName,
  parseWizardRows,
  resolveGuruAlias as resolveSharedGuruAlias,
  isMapelBergilir as isSharedMapelBergilir,
  type AcademicWizardStepKey,
} from '@/lib/academic-import'

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
// 3. IMPORT XML ASC → MASTER MAPEL + PENUGASAN + JADWAL SEKALIGUS
//    Satu fungsi, satu upload, semua terisi
// ============================================================

// Daftar mapel khusus yang bisa bentrok & bergilir guru
const MAPEL_BERGILIR_KEYWORDS = [
  'RISET', 'KSM', 'MUHADATSAH', 'SPEAKING', 'THEATER BAHASA',
]

// Mapping guru palsu di ASC → nama asli di DB
// Pattern: "NAMA N" (uppercase + spasi + angka) → nama asli
const GURU_ALIAS_MAP: Record<string, string> = {
  'ARI': 'Ari Anugrah, S.Pd',
  'INTAN': 'Intan Purnamasari, S.Pd',
  'RICKY': 'Ricky Habibi, S.Pd',
  'YUDA': 'Diyaz Najib, S.Pd',
}

function resolveGuruAlias(xmlName: string): string {
  // Cek apakah nama ini pattern "ALIAS N" (misal "ARI 1", "RICKY 3")
  const match = xmlName.match(/^([A-Z]+)\s+\d+$/)
  if (match) {
    const alias = match[1]
    if (GURU_ALIAS_MAP[alias]) return GURU_ALIAS_MAP[alias]
  }
  return xmlName
}

function isMapelBergilir(namaMapel: string): boolean {
  const upper = namaMapel.toUpperCase().trim()
  return MAPEL_BERGILIR_KEYWORDS.some(kw => upper.startsWith(kw))
}

export async function importJadwalASC(xmlText: string): Promise<{
  success: string | null
  error: string | null
  logs: string[]
  stats: { mapel: number; penugasan: number; jadwal: number }
}> {
  const db = await getDB()
  const emptyStats = { mapel: 0, penugasan: 0, jadwal: 0 }

  const activeTa = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>()
  if (!activeTa) return { success: null, error: 'Tahun Ajaran aktif belum diatur.', logs: [], stats: emptyStats }

  const dataset = buildAcademicDatasetFromAscXml(xmlText)
  const result = await applyAcademicDataset(db, activeTa.id, dataset)
  revalidatePath('/dashboard/akademik')
  return {
    success: result.success,
    error: result.error,
    logs: result.logs,
    stats: { mapel: result.stats.mapel, penugasan: result.stats.penugasan, jadwal: result.stats.jadwal },
  }

  // Ambil TA aktif
  const taRow = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>()
  if (!taRow) return { success: null, error: 'Tahun Ajaran aktif belum diatur.', logs: [], stats: emptyStats }
  const taId = taRow!.id

  // ── Parse XML ──────────────────────────────────────────────────────────
  const parseAttrs = (tag: string): Map<string, string> => {
    const map = new Map<string, string>()
    const re = /(\w+)="([^"]*)"/g
    let m: RegExpExecArray | null
    while ((m = re.exec(tag)) !== null) map.set(m[1], m[2])
    return map
  }

  const extractTags = (xml: string, tagName: string): string[] => {
    const re = new RegExp(`<${tagName}\\s[^>]*/?>`, 'g')
    return xml.match(re) || []
  }

  const logs: string[] = []

  // Parse subjects: id → { name, short }
  const xmlSubjects = new Map<string, { name: string; short: string }>()
  for (const tag of extractTags(xmlText, 'subject')) {
    const a = parseAttrs(tag)
    if (a.get('id') && a.get('name')) {
      xmlSubjects.set(a.get('id')!, { name: a.get('name')!.trim(), short: (a.get('short') || '').trim() })
    }
  }

  // Parse teachers: id → name
  const xmlTeachers = new Map<string, string>()
  for (const tag of extractTags(xmlText, 'teacher')) {
    const a = parseAttrs(tag)
    if (a.get('id') && a.get('name')) xmlTeachers.set(a.get('id')!, a.get('name')!.trim())
  }

  // Parse classes: id → name
  const xmlClasses = new Map<string, string>()
  for (const tag of extractTags(xmlText, 'class')) {
    const a = parseAttrs(tag)
    if (a.get('id') && a.get('name')) xmlClasses.set(a.get('id')!, a.get('name')!.trim())
  }

  // Parse lessons: id → { classId, subjectId, teacherId }
  type LessonInfo = { classId: string; subjectId: string; teacherId: string }
  const xmlLessons = new Map<string, LessonInfo>()
  for (const tag of extractTags(xmlText, 'lesson')) {
    const a = parseAttrs(tag)
    const id = a.get('id')
    const classids = a.get('classids') || ''
    const subjectid = a.get('subjectid') || ''
    const teacherids = a.get('teacherids') || ''
    if (id && classids && subjectid && teacherids) {
      xmlLessons.set(id!, { classId: classids, subjectId: subjectid, teacherId: teacherids })
    }
  }

  // ── STEP 1: Auto-create/update Master Mapel dari XML ──────────────────
  const mapelAllBefore = await db.prepare('SELECT id, LOWER(TRIM(nama_mapel)) as nama, kode_asc FROM mata_pelajaran').all<any>()
  const mapelMap = new Map<string, string>() // lowercase name → id
  for (const m of (mapelAllBefore.results || [])) mapelMap.set(m.nama, m.id)

  let mapelCreated = 0
  let mapelUpdated = 0
  for (const [, subj] of xmlSubjects) {
    const namaLower = subj.name.toLowerCase().trim()
    const existingId = mapelMap.get(namaLower)

    if (existingId) {
      // Update kode_asc jika berbeda
      if (subj.short) {
        try {
          await db.prepare('UPDATE mata_pelajaran SET kode_asc = ? WHERE id = ?').bind(subj.short, existingId).run()
          mapelUpdated++
        } catch { /* ignore */ }
      }
    } else {
      // Create new mapel
      const newId = crypto.randomUUID().replace(/-/g, '')
      // Tentukan tingkat dari nama mapel (misal "RISET 7" → "7", "MATEMATIKA" → "Semua")
      const tingkatMatch = subj.name.match(/\b([789])\b/)
      const tingkat = tingkatMatch?.[1] ?? 'Semua'
      const kategori = isMapelBergilir(subj.name) ? 'Kelompok Mata Pelajaran Pilihan' : 'Kelompok Mata Pelajaran Umum'

      try {
        await db.prepare(
          `INSERT INTO mata_pelajaran (id, nama_mapel, kode_asc, kelompok, tingkat, kategori, created_at) VALUES (?, ?, ?, 'UMUM', ?, ?, datetime('now'))`
        ).bind(newId, subj.name, subj.short || null, tingkat, kategori).run()
        mapelMap.set(namaLower, newId)
        mapelCreated++
      } catch (e: any) {
        // Mungkin UNIQUE conflict, coba ulang lookup
        if (e.message?.includes('UNIQUE')) {
          const retry = await db.prepare('SELECT id FROM mata_pelajaran WHERE LOWER(TRIM(nama_mapel)) = ?').bind(namaLower).first<any>()
          if (retry) mapelMap.set(namaLower, retry.id)
        } else {
          logs.push(`Gagal insert mapel "${subj.name}": ${e.message}`)
        }
      }
    }
  }
  logs.push(`Master Mapel: ${mapelCreated} baru, ${mapelUpdated} diupdate kode ASC.`)

  // ── STEP 2: Build lookup maps ─────────────────────────────────────────
  const guruAll = await db.prepare('SELECT id, LOWER(TRIM(nama_lengkap)) as nama FROM "user" WHERE nama_lengkap IS NOT NULL').all<any>()
  const guruMap = new Map<string, string>()
  for (const g of (guruAll.results || [])) guruMap.set(g.nama, g.id)

  const kelasAll = await db.prepare('SELECT id, CAST(tingkat AS INTEGER) as tingkat, TRIM(nomor_kelas) as nomor FROM kelas').all<any>()
  const kelasMap = new Map<string, string>()
  for (const k of (kelasAll.results || [])) kelasMap.set(`${k.tingkat}-${String(k.nomor).trim()}`, k.id)

  // Helper: konversi nama kelas ASC → tingkat + nomor
  // Format MAN: X-01→10-1, XI-05→11-5, XII-03→12-3
  // Juga handle format short: "X-01" dari atribut short
  const parseKelasName = (name: string): { tingkat: number; nomor: string } | null => {
    const upper = name.toUpperCase().trim()
    let tingkat = 0
    let rest = ''

    // Format MAN: X, XI, XII
    if (upper.startsWith('XII-')) { tingkat = 12; rest = upper.slice(4) }
    else if (upper.startsWith('XI-')) { tingkat = 11; rest = upper.slice(3) }
    else if (upper.startsWith('X-')) { tingkat = 10; rest = upper.slice(2) }
    // Format MTs legacy fallback: VII, VIII, IX
    else if (upper.startsWith('IX-')) { tingkat = 9; rest = upper.slice(3) }
    else if (upper.startsWith('VIII-')) { tingkat = 8; rest = upper.slice(5) }
    else if (upper.startsWith('VII-')) { tingkat = 7; rest = upper.slice(4) }
    else return null

    // Ambil nomor kelas, strip leading zero dan info dalam kurung
    // "01 (XI-MIPA-F)" → "1"
    const nomorRaw = rest.split('(')[0].trim()
    const nomor = String(parseInt(nomorRaw, 10))
    if (!nomor || nomor === 'NaN') return null
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

  // Resolve guru by name (exact → fuzzy)
  const findGuru = (name: string): string | undefined => {
    const lower = name.toLowerCase().trim()
    let id = guruMap.get(lower)
    if (id) return id
    for (const [nama, gid] of guruMap) {
      if (lower.includes(nama) || nama.includes(lower)) return gid
    }
    return undefined
  }

  // ── STEP 3: Parse cards → jadwal rows ─────────────────────────────────
  type JadwalRow = { guruId: string; mapelId: string; kelasId: string; hari: number; jamKe: number; isBergilir: boolean; guruNamaAsli: string }
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

    // Resolve guru — handle alias (ARI 1 → Ari Anugrah, S.Pd)
    const guruNamaXml = xmlTeachers.get(lesson!.teacherId) || ''
    const guruNamaResolved = resolveGuruAlias(guruNamaXml)
    const guruId = findGuru(guruNamaResolved)
    if (!guruId) {
      skipped.noGuru++
      // Hanya log kalau bukan alias yang sudah kita handle
      if (guruNamaXml === guruNamaResolved) {
        logs.push(`Guru tidak ditemukan: "${guruNamaXml}"`)
      } else {
        logs.push(`Guru tidak ditemukan: "${guruNamaXml}" → alias "${guruNamaResolved}"`)
      }
      continue
    }

    // Resolve mapel
    const subjInfo = xmlSubjects.get(lesson!.subjectId)
    const mapelNamaXml = subjInfo?.name || ''
    const mapelId = mapelMap.get(mapelNamaXml.toLowerCase().trim())
    if (!mapelId) {
      skipped.noMapel++
      logs.push(`Mapel tidak ditemukan: "${mapelNamaXml}"`)
      continue
    }

    // Resolve kelas
    const kelasNamaXml = xmlClasses.get(lesson!.classId) || ''
    const parsed = parseKelasName(kelasNamaXml)
    if (!parsed) { skipped.noKelas++; logs.push(`Format kelas tidak dikenali: "${kelasNamaXml}"`); continue }
    const kelasId = kelasMap.get(`${parsed!.tingkat}-${parsed!.nomor}`)
    if (!kelasId) { skipped.noKelas++; logs.push(`Kelas tidak ditemukan di DB: "${kelasNamaXml}" (${parsed!.tingkat}-${parsed!.nomor})`); continue }

    const isBergilir = isMapelBergilir(mapelNamaXml)
    jadwalRows.push({ guruId: guruId!, mapelId: mapelId!, kelasId: kelasId!, hari, jamKe: period, isBergilir, guruNamaAsli: guruNamaResolved })
  }

  if (jadwalRows.length === 0) {
    return { success: null, error: 'Tidak ada data jadwal yang berhasil diproses.', logs, stats: emptyStats }
  }

  // ── STEP 4: Hapus data lama TA aktif ──────────────────────────────────
  // Hapus guru piket dulu (FK ke penugasan)
  try {
    await db.prepare(`DELETE FROM penugasan_guru_piket WHERE penugasan_id IN (SELECT id FROM penugasan_mengajar WHERE tahun_ajaran_id = ?)`).bind(taId).run()
  } catch { /* tabel mungkin belum ada */ }
  await db.prepare('DELETE FROM penugasan_mengajar WHERE tahun_ajaran_id = ?').bind(taId).run()

  // ── STEP 5: Build penugasan unik ──────────────────────────────────────
  // Untuk pelajaran bergilir, kunci penugasan = mapelId|kelasId (tanpa guru, karena guru bergilir)
  // Untuk pelajaran biasa, kunci = guruId|mapelId|kelasId
  const penugasanKeyToId = new Map<string, string>()
  const penugasanKeyToGuru = new Map<string, string>() // untuk simpan guru utama
  const penugasanKeyIsBergilir = new Map<string, boolean>()
  // Track semua guru bergilir per penugasan
  const bergilirGuruMap = new Map<string, Set<string>>() // key → set of guruId

  for (const row of jadwalRows) {
    let key: string
    if (row.isBergilir) {
      key = `BERGILIR|${row.mapelId}|${row.kelasId}`
      if (!bergilirGuruMap.has(key)) bergilirGuruMap.set(key, new Set())
      bergilirGuruMap.get(key)!.add(row.guruId)
    } else {
      key = `${row.guruId}|${row.mapelId}|${row.kelasId}`
    }

    if (!penugasanKeyToId.has(key)) {
      penugasanKeyToId.set(key, crypto.randomUUID().replace(/-/g, ''))
      penugasanKeyToGuru.set(key, row.guruId)
      penugasanKeyIsBergilir.set(key, row.isBergilir)
    }
  }

  // ── STEP 6: Batch insert penugasan ────────────────────────────────────
  const CHUNK_P = 10 // 10 × 7 cols = 70 bindings, safely under D1 limit
  type PenugasanEntry = { pid: string; guruId: string; mapelId: string; kelasId: string; isBergilir: boolean }
  const penugasanList: PenugasanEntry[] = []
  for (const [key, pid] of penugasanKeyToId) {
    const isBergilir = penugasanKeyIsBergilir.get(key) || false
    let guruId: string, mapelId: string, kelasId: string

    if (key.startsWith('BERGILIR|')) {
      const parts = key.split('|')
      mapelId = parts[1]; kelasId = parts[2]
      // Guru utama = guru pertama yang ketemu
      guruId = penugasanKeyToGuru.get(key)!
    } else {
      const parts = key.split('|')
      guruId = parts[0]; mapelId = parts[1]; kelasId = parts[2]
    }

    penugasanList.push({ pid, guruId, mapelId, kelasId, isBergilir })
  }

  let penugasanCount = 0
  for (let i = 0; i < penugasanList.length; i += CHUNK_P) {
    const chunk = penugasanList.slice(i, i + CHUNK_P)
    const values = chunk.flatMap(r => [r.pid, r.guruId, r.mapelId, r.kelasId, taId, r.isBergilir ? 1 : 0])
    const placeholders = chunk.map(() => `(?, ?, ?, ?, ?, ?, datetime('now'))`).join(', ')
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO penugasan_mengajar (id, guru_id, mapel_id, kelas_id, tahun_ajaran_id, is_piket_bergilir, created_at) VALUES ${placeholders}`
      ).bind(...values).run()
      penugasanCount += chunk.length
    } catch (e: any) {
      logs.push(`Error insert penugasan chunk ${i}: ${e.message}`)
    }
  }

  // ── STEP 7: Insert guru bergilir (penugasan_guru_piket) ───────────────
  const CHUNK_GP = 10
  type GuruPiketEntry = { penugasanId: string; guruId: string; urutan: number }
  const guruPiketList: GuruPiketEntry[] = []

  for (const [key, guruSet] of bergilirGuruMap) {
    const pid = penugasanKeyToId.get(key)
    if (!pid) continue
    let urutan = 1
    for (const gid of guruSet) {
      guruPiketList.push({ penugasanId: pid!, guruId: gid, urutan })
      urutan++
    }
  }

  let piketCount = 0
  for (let i = 0; i < guruPiketList.length; i += CHUNK_GP) {
    const chunk = guruPiketList.slice(i, i + CHUNK_GP)
    const values = chunk.flatMap(r => [crypto.randomUUID().replace(/-/g, ''), r.penugasanId, r.guruId, r.urutan])
    const placeholders = chunk.map(() => `(?, ?, ?, ?, 0, datetime('now'))`).join(', ')
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO penugasan_guru_piket (id, penugasan_id, guru_id, urutan, is_aktif_minggu_ini, created_at) VALUES ${placeholders}`
      ).bind(...values).run()
      piketCount += chunk.length
    } catch (e: any) {
      logs.push(`Error insert guru piket chunk: ${e.message}`)
    }
  }
  if (piketCount > 0) {
    logs.push(`${piketCount} guru bergilir (piket) berhasil dimasukkan.`)
  }

  // ── STEP 8: Batch insert jadwal ───────────────────────────────────────
  const CHUNK_J = 15
  const jadwalSeen = new Set<string>()
  const jadwalToInsert: Array<{ pid: string; hari: number; jamKe: number }> = []

  for (const row of jadwalRows) {
    let key: string
    if (row.isBergilir) {
      key = `BERGILIR|${row.mapelId}|${row.kelasId}`
    } else {
      key = `${row.guruId}|${row.mapelId}|${row.kelasId}`
    }
    const pid = penugasanKeyToId.get(key)
    if (!pid) continue
    const uniqKey = `${pid}|${row.hari}|${row.jamKe}`
    if (jadwalSeen.has(uniqKey)) continue
    jadwalSeen.add(uniqKey)
    jadwalToInsert.push({ pid: pid!, hari: row.hari, jamKe: row.jamKe })
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

  const totalMapel = mapelCreated + mapelUpdated
  return {
    success: `Import selesai: ${totalMapel} mapel (${mapelCreated} baru), ${penugasanCount} penugasan, ${jadwalCount} slot jadwal.`,
    error: null,
    logs,
    stats: { mapel: totalMapel, penugasan: penugasanCount, jadwal: jadwalCount },
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
    // Format MAN: X, XI, XII
    if (upper.startsWith('XII-')) { tingkat = 12; nomor = upper.slice(4) }
    else if (upper.startsWith('XI-')) { tingkat = 11; nomor = upper.slice(3) }
    else if (upper.startsWith('X-')) { tingkat = 10; nomor = upper.slice(2) }
    // Format MTs legacy fallback: VII, VIII, IX
    else if (upper.startsWith('IX-')) { tingkat = 9; nomor = upper.slice(3) }
    else if (upper.startsWith('VIII-')) { tingkat = 8; nomor = upper.slice(5) }
    else if (upper.startsWith('VII-')) { tingkat = 7; nomor = upper.slice(4) }
    // Format langsung: "7-1", "8-3"
    else {
      const directMatch = upper.match(/^(\d+)-(.+)$/)
      if (directMatch) { tingkat = parseInt(directMatch[1]); nomor = directMatch[2] }
      else { errorLogs.push(`Baris ${i + 2}: Format kelas "${namaKelas}" tidak valid.`); continue }
    }
    // Strip leading zero: "01" → "1"
    nomor = String(parseInt(nomor.trim(), 10) || nomor.trim())

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

// ============================================================
// 6. PELAJARAN BERGILIR (PIKET) ACTIONS
// ============================================================

// Ambil semua penugasan bergilir + daftar guru piketnya
export async function getPenugasanBergilir(tahun_ajaran_id: string) {
  const db = await getDB()
  const penugasan = await db.prepare(`
    SELECT pm.id, pm.guru_id,
      mp.nama_mapel, mp.id as mapel_id,
      k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok, k.id as kelas_id,
      u.nama_lengkap as guru_utama_nama
    FROM penugasan_mengajar pm
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    JOIN "user" u ON pm.guru_id = u.id
    WHERE pm.tahun_ajaran_id = ? AND pm.is_piket_bergilir = 1
    ORDER BY mp.nama_mapel, k.tingkat, k.nomor_kelas
  `).bind(tahun_ajaran_id).all<any>()

  const piketAll = await db.prepare(`
    SELECT pgp.id, pgp.penugasan_id, pgp.guru_id, pgp.urutan, pgp.is_aktif_minggu_ini,
      u.nama_lengkap as guru_nama
    FROM penugasan_guru_piket pgp
    JOIN "user" u ON pgp.guru_id = u.id
    JOIN penugasan_mengajar pm ON pgp.penugasan_id = pm.id
    WHERE pm.tahun_ajaran_id = ?
    ORDER BY pgp.urutan ASC
  `).bind(tahun_ajaran_id).all<any>()

  // Group piket by penugasan_id
  const piketMap = new Map<string, any[]>()
  for (const p of (piketAll.results || [])) {
    if (!piketMap.has(p.penugasan_id)) piketMap.set(p.penugasan_id, [])
    piketMap.get(p.penugasan_id)!.push(p)
  }

  return (penugasan.results || []).map((p: any) => ({
    ...p,
    guru_piket: piketMap.get(p.id) || [],
  }))
}

// Set guru aktif minggu ini untuk satu penugasan
export async function setGuruAktifMingguIni(penugasan_id: string, guru_piket_id: string) {
  const db = await getDB()
  try {
    // Reset semua guru di penugasan ini
    await db.prepare('UPDATE penugasan_guru_piket SET is_aktif_minggu_ini = 0 WHERE penugasan_id = ?').bind(penugasan_id).run()
    // Set yang dipilih jadi aktif
    await db.prepare('UPDATE penugasan_guru_piket SET is_aktif_minggu_ini = 1 WHERE id = ?').bind(guru_piket_id).run()
    revalidatePath('/dashboard/akademik')
    return { success: 'Guru aktif minggu ini berhasil diubah.' }
  } catch (e: any) {
    return { error: e.message }
  }
}

// Batch set guru aktif minggu ini — untuk banyak penugasan sekaligus
export async function batchSetGuruAktif(assignments: Array<{ penugasan_id: string; guru_piket_id: string }>) {
  const db = await getDB()
  try {
    // Reset semua dulu
    const penugasanIds = [...new Set(assignments.map(a => a.penugasan_id))]
    for (const pid of penugasanIds) {
      await db.prepare('UPDATE penugasan_guru_piket SET is_aktif_minggu_ini = 0 WHERE penugasan_id = ?').bind(pid).run()
    }
    // Set aktif
    for (const a of assignments) {
      await db.prepare('UPDATE penugasan_guru_piket SET is_aktif_minggu_ini = 1 WHERE id = ?').bind(a.guru_piket_id).run()
    }
    revalidatePath('/dashboard/akademik')
    return { success: `${assignments.length} guru aktif berhasil diatur.` }
  } catch (e: any) {
    return { error: e.message }
  }
}

// Tambah guru ke daftar piket
export async function tambahGuruPiket(penugasan_id: string, guru_id: string) {
  const db = await getDB()
  // Cari urutan tertinggi
  const max = await db.prepare('SELECT MAX(urutan) as mx FROM penugasan_guru_piket WHERE penugasan_id = ?').bind(penugasan_id).first<any>()
  const urutan = (max?.mx || 0) + 1
  const result = await dbInsert(db, 'penugasan_guru_piket', { penugasan_id, guru_id, urutan, is_aktif_minggu_ini: 0 })
  if (result.error) return { error: result.error.includes('UNIQUE') ? 'Guru ini sudah ada di daftar piket.' : result.error }
  revalidatePath('/dashboard/akademik')
  return { success: 'Guru berhasil ditambahkan ke daftar piket.' }
}

// Hapus guru dari daftar piket
export async function hapusGuruPiket(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'penugasan_guru_piket', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/akademik')
  return { success: 'Guru berhasil dihapus dari daftar piket.' }
}

// ============================================================
// 7. INPUT BERTAHAP AKADEMIK (DRAFT WIZARD)
// ============================================================

type WizardRowRecord = {
  id: string
  session_id: string
  step_key: AcademicWizardStepKey
  row_key: string
  payload_json: string
  status: string
  error_message: string | null
}

async function ensureAkademikInputSchema(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS akademik_input_sessions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','applied','discarded')),
      active_step TEXT NOT NULL DEFAULT 'persiapan',
      summary_json TEXT NOT NULL DEFAULT '{}',
      logs_json TEXT NOT NULL DEFAULT '[]',
      created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      applied_at TEXT
    )
  `).run()
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS akademik_input_rows (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      session_id TEXT NOT NULL REFERENCES akademik_input_sessions(id) ON DELETE CASCADE,
      step_key TEXT NOT NULL,
      row_key TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'draft',
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(session_id, step_key, row_key)
    )
  `).run()
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS akademik_input_apply_backups (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      session_id TEXT NOT NULL REFERENCES akademik_input_sessions(id) ON DELETE CASCADE,
      tahun_ajaran_id TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_akademik_input_rows_session_step ON akademik_input_rows(session_id, step_key)').run()
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_akademik_input_sessions_ta_status ON akademik_input_sessions(tahun_ajaran_id, status, updated_at)').run()
}

function normalizeWizardStep(stepKey: string): AcademicWizardStepKey {
  if (['mapel', 'penugasan', 'jadwal', 'bergilir'].includes(stepKey)) return stepKey as AcademicWizardStepKey
  return 'mapel'
}

async function getRowsForSession(db: D1Database, sessionId: string) {
  const rows = await db.prepare(`
    SELECT * FROM akademik_input_rows
    WHERE session_id = ?
    ORDER BY step_key ASC, row_key ASC
  `).bind(sessionId).all<WizardRowRecord>()
  return rows.results || []
}

async function updateSessionSummary(db: D1Database, sessionId: string) {
  const rows = await getRowsForSession(db, sessionId)
  const summary = rows.reduce<Record<string, { total: number; error: number; valid: number }>>((acc, row) => {
    if (!acc[row.step_key]) acc[row.step_key] = { total: 0, error: 0, valid: 0 }
    acc[row.step_key].total++
    if (row.status === 'error') acc[row.step_key].error++
    else acc[row.step_key].valid++
    return acc
  }, {})
  const logs = rows.filter(row => row.status === 'error').map(row => `${row.step_key} ${row.row_key}: ${row.error_message}`)
  await db.prepare(`
    UPDATE akademik_input_sessions
    SET summary_json = ?, logs_json = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(JSON.stringify(summary), JSON.stringify(logs.slice(0, 100)), sessionId).run()
  return { summary, logs }
}

async function validateRows(db: D1Database, sessionId: string, stepKey: AcademicWizardStepKey) {
  const rows = await db.prepare(`
    SELECT * FROM akademik_input_rows
    WHERE session_id = ? AND step_key = ?
    ORDER BY row_key ASC
  `).bind(sessionId, stepKey).all<WizardRowRecord>()

  const [guruAll, mapelAll, kelasAll] = await Promise.all([
    db.prepare('SELECT id, LOWER(TRIM(nama_lengkap)) as nama FROM "user" WHERE nama_lengkap IS NOT NULL').all<any>(),
    db.prepare('SELECT id, LOWER(TRIM(nama_mapel)) as nama, kode_asc FROM mata_pelajaran').all<any>(),
    db.prepare('SELECT id, CAST(tingkat AS INTEGER) as tingkat, TRIM(nomor_kelas) as nomor FROM kelas').all<any>(),
  ])

  const guruMap = new Map<string, string>()
  for (const row of guruAll.results || []) guruMap.set(row.nama, row.id)
  const mapelMap = new Map<string, string>()
  for (const row of mapelAll.results || []) mapelMap.set(row.nama, row.id)
  const draftMapelRows = await db.prepare(`
    SELECT payload_json FROM akademik_input_rows
    WHERE session_id = ? AND step_key = 'mapel'
  `).bind(sessionId).all<{ payload_json: string }>()
  for (const row of draftMapelRows.results || []) {
    const payload = parseJsonCol<any>(row.payload_json, {})
    const nama = String(payload.NAMA_MAPEL || payload.nama_mapel || '').trim().toLowerCase()
    if (nama && !mapelMap.has(nama)) mapelMap.set(nama, `draft:${nama}`)
  }
  const kelasMap = new Map<string, string>()
  for (const row of kelasAll.results || []) kelasMap.set(`${row.tingkat}-${String(row.nomor).trim()}`, row.id)

  const findName = (map: Map<string, string>, raw: string) => {
    const value = raw.toLowerCase().trim()
    if (map.has(value)) return map.get(value)
    for (const [candidate, id] of map) {
      if (value.includes(candidate) || candidate.includes(value)) return id
    }
    return undefined
  }

  const seen = new Set<string>()
  let errorCount = 0

  for (const row of rows.results || []) {
    const payload = parseJsonCol<any>(row.payload_json, {})
    let status = 'valid'
    let error: string | null = null

    if (stepKey === 'mapel') {
      const nama = String(payload.NAMA_MAPEL || payload.nama_mapel || '').trim()
      if (!nama) {
        status = 'error'
        error = 'NAMA_MAPEL wajib diisi.'
      } else {
        const key = nama.toLowerCase()
        if (seen.has(key)) {
          status = 'duplicate'
          error = 'Duplikat di draft step ini.'
        } else {
          seen.add(key)
          status = mapelMap.has(key) ? 'update' : 'new'
        }
      }
    }

    if (stepKey === 'penugasan' || stepKey === 'jadwal' || stepKey === 'bergilir') {
      const namaGuru = String(payload.NAMA_GURU || payload.nama_guru || '').trim()
      const namaMapel = String(payload.NAMA_MAPEL || payload.nama_mapel || '').trim()
      const namaKelas = String(payload.NAMA_KELAS || payload.nama_kelas || '').trim()
      const parsedKelas = parseSharedKelasName(namaKelas)
      const key = `${namaGuru.toLowerCase()}|${namaMapel.toLowerCase()}|${namaKelas.toLowerCase()}`

      if (!namaGuru || !namaMapel || !namaKelas) {
        status = 'error'
        error = 'NAMA_GURU, NAMA_MAPEL, dan NAMA_KELAS wajib diisi.'
      } else if (!findName(guruMap, resolveSharedGuruAlias(namaGuru))) {
        status = 'error'
        error = `Guru "${namaGuru}" tidak ditemukan.`
      } else if (!findName(mapelMap, namaMapel)) {
        status = 'error'
        error = `Mapel "${namaMapel}" belum ada di master aktif/draft yang sudah diterapkan.`
      } else if (!parsedKelas || !kelasMap.get(`${parsedKelas.tingkat}-${parsedKelas.nomor}`)) {
        status = 'error'
        error = `Kelas "${namaKelas}" tidak ditemukan.`
      } else if (seen.has(key) && stepKey !== 'jadwal') {
        status = 'duplicate'
        error = 'Duplikat di draft step ini.'
      } else {
        seen.add(key)
      }

      if (!error && stepKey === 'jadwal') {
        const hari = Number(payload.HARI ?? payload.hari ?? 0)
        const jamKe = Number(payload.JAM_KE ?? payload.jam_ke ?? 0)
        const slotKey = `${namaKelas.toLowerCase()}|${hari}|${jamKe}`
        if (hari < 1 || hari > 6) {
          status = 'error'
          error = 'HARI wajib angka 1-6.'
        } else if (jamKe < 1) {
          status = 'error'
          error = 'JAM_KE wajib lebih dari 0.'
        } else if (seen.has(slotKey)) {
          status = 'duplicate'
          error = 'Slot kelas/hari/jam duplikat di draft.'
        } else {
          seen.add(slotKey)
        }
      }

      if (!error && stepKey === 'bergilir') {
        const nama = String(payload.NAMA_MAPEL || payload.nama_mapel || '')
        if (!isSharedMapelBergilir(nama) && String(payload.BERGILIR || payload.bergilir || '').toLowerCase() !== 'ya') {
          status = 'valid'
        }
      }
    }

    if (status === 'error') errorCount++
    await db.prepare(`
      UPDATE akademik_input_rows
      SET status = ?, error_message = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(status, error, row.id).run()
  }

  const { summary, logs } = await updateSessionSummary(db, sessionId)
  return { errorCount, summary, logs }
}

export async function createAkademikInputSession(tahunAjaranId?: string) {
  const db = await getDB()
  const user = await requireUser()
  await ensureAkademikInputSchema(db)

  const ta = tahunAjaranId
    ? await db.prepare('SELECT id FROM tahun_ajaran WHERE id = ?').bind(tahunAjaranId).first<{ id: string }>()
    : await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string }>()
  if (!ta) return { error: 'Tahun Ajaran aktif belum diatur.', sessionId: null }

  const existing = await db.prepare(`
    SELECT id FROM akademik_input_sessions
    WHERE tahun_ajaran_id = ? AND status = 'draft'
    ORDER BY updated_at DESC
    LIMIT 1
  `).bind(ta.id).first<{ id: string }>()
  if (existing) return { success: 'Draft sebelumnya dilanjutkan.', sessionId: existing.id }

  const sessionId = crypto.randomUUID().replace(/-/g, '')
  await db.prepare(`
    INSERT INTO akademik_input_sessions (id, tahun_ajaran_id, created_by, summary_json, logs_json)
    VALUES (?, ?, ?, '{}', '[]')
  `).bind(sessionId, ta.id, user!.id).run()
  return { success: 'Draft input bertahap dibuat.', sessionId }
}

export async function getAkademikInputSession(sessionId: string) {
  const db = await getDB()
  await ensureAkademikInputSchema(db)
  const session = await db.prepare(`
    SELECT s.*, ta.nama as tahun_ajaran_nama, ta.semester
    FROM akademik_input_sessions s
    JOIN tahun_ajaran ta ON ta.id = s.tahun_ajaran_id
    WHERE s.id = ?
  `).bind(sessionId).first<any>()
  if (!session) return { error: 'Draft tidak ditemukan.', session: null, rows: [] }
  const rows = await getRowsForSession(db, sessionId)
  return {
    session: {
      ...session,
      summary: parseJsonCol(session.summary_json, {}),
      logs: parseJsonCol(session.logs_json, []),
    },
    rows: rows.map(row => ({
      ...row,
      payload: parseJsonCol(row.payload_json, {}),
    })),
  }
}

export async function saveAkademikInputRows(sessionId: string, stepKeyRaw: string, rows: any[]) {
  const db = await getDB()
  await ensureAkademikInputSchema(db)
  const stepKey = normalizeWizardStep(stepKeyRaw)
  const session = await db.prepare('SELECT id, status FROM akademik_input_sessions WHERE id = ?').bind(sessionId).first<any>()
  if (!session) return { error: 'Draft tidak ditemukan.' }
  if (session.status !== 'draft') return { error: 'Draft ini sudah tidak bisa diedit.' }

  await db.prepare('DELETE FROM akademik_input_rows WHERE session_id = ? AND step_key = ?').bind(sessionId, stepKey).run()
  for (let i = 0; i < rows.length; i++) {
    const payload = rows[i] || {}
    await db.prepare(`
      INSERT INTO akademik_input_rows (session_id, step_key, row_key, payload_json, status)
      VALUES (?, ?, ?, ?, 'draft')
    `).bind(sessionId, stepKey, String(i + 1).padStart(4, '0'), JSON.stringify(payload)).run()
  }

  await db.prepare(`
    UPDATE akademik_input_sessions
    SET active_step = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(stepKey, sessionId).run()
  const validation = await validateRows(db, sessionId, stepKey)
  return { success: `Checkpoint ${stepKey} tersimpan.`, ...validation }
}

export async function validateAkademikInputStep(sessionId: string, stepKeyRaw: string) {
  const db = await getDB()
  await ensureAkademikInputSchema(db)
  return validateRows(db, sessionId, normalizeWizardStep(stepKeyRaw))
}

export async function importAkademikInputExcel(sessionId: string, stepKeyRaw: string, rows: any[]) {
  return saveAkademikInputRows(sessionId, stepKeyRaw, rows)
}

async function createAcademicApplyBackup(db: D1Database, sessionId: string, tahunAjaranId: string) {
  const [penugasan, jadwal, piket, mapel] = await Promise.all([
    db.prepare('SELECT * FROM penugasan_mengajar WHERE tahun_ajaran_id = ?').bind(tahunAjaranId).all<any>(),
    db.prepare('SELECT * FROM jadwal_mengajar WHERE tahun_ajaran_id = ?').bind(tahunAjaranId).all<any>(),
    db.prepare(`
      SELECT pgp.* FROM penugasan_guru_piket pgp
      JOIN penugasan_mengajar pm ON pm.id = pgp.penugasan_id
      WHERE pm.tahun_ajaran_id = ?
    `).bind(tahunAjaranId).all<any>(),
    db.prepare('SELECT * FROM mata_pelajaran').all<any>(),
  ])
  const snapshot = {
    penugasan: penugasan.results || [],
    jadwal: jadwal.results || [],
    guru_piket: piket.results || [],
    mapel: mapel.results || [],
  }
  await db.prepare(`
    INSERT INTO akademik_input_apply_backups (session_id, tahun_ajaran_id, snapshot_json)
    VALUES (?, ?, ?)
  `).bind(sessionId, tahunAjaranId, JSON.stringify(snapshot)).run()
}

export async function applyAkademikInputSession(sessionId: string) {
  const db = await getDB()
  await ensureAkademikInputSchema(db)
  const session = await db.prepare('SELECT * FROM akademik_input_sessions WHERE id = ?').bind(sessionId).first<any>()
  if (!session) return { error: 'Draft tidak ditemukan.', success: null, logs: [] }
  if (session.status !== 'draft') return { error: 'Draft ini sudah pernah diproses.', success: null, logs: [] }

  for (const step of ['mapel', 'penugasan', 'jadwal', 'bergilir']) {
    await validateRows(db, sessionId, step as AcademicWizardStepKey)
  }

  const allRows = await getRowsForSession(db, sessionId)
  const hasErrors = allRows.some(row => row.status === 'error')
  if (hasErrors) {
    const logs = allRows.filter(row => row.status === 'error').map(row => `${row.step_key} ${row.row_key}: ${row.error_message}`)
    return { error: 'Masih ada data error. Perbaiki checkpoint dulu sebelum menerapkan final.', success: null, logs }
  }

  const rowsByStep = parseWizardRows(allRows)
  const dataset = buildAcademicDatasetFromWizard(rowsByStep)
  await createAcademicApplyBackup(db, sessionId, session.tahun_ajaran_id)
  const result = await applyAcademicDataset(db, session.tahun_ajaran_id, dataset)

  if (result.error) {
    await db.prepare(`
      UPDATE akademik_input_sessions
      SET logs_json = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(JSON.stringify(result.logs), sessionId).run()
    return result
  }

  await db.prepare(`
    UPDATE akademik_input_sessions
    SET status = 'applied', summary_json = ?, logs_json = ?, updated_at = datetime('now'), applied_at = datetime('now')
    WHERE id = ?
  `).bind(JSON.stringify(result.stats), JSON.stringify(result.logs), sessionId).run()
  revalidatePath('/dashboard/akademik')
  return result
}

export async function discardAkademikInputSession(sessionId: string) {
  const db = await getDB()
  await ensureAkademikInputSchema(db)
  await db.prepare(`
    UPDATE akademik_input_sessions
    SET status = 'discarded', updated_at = datetime('now')
    WHERE id = ? AND status = 'draft'
  `).bind(sessionId).run()
  return { success: 'Draft input bertahap dibatalkan.' }
}
