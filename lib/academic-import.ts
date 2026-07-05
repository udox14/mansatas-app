import { parseJsonCol } from '@/utils/db'

export type AcademicImportStats = {
  mapel: number
  penugasan: number
  jadwal: number
}

export type AcademicImportResult = {
  success: string | null
  error: string | null
  logs: string[]
  stats: AcademicImportStats
}

export type AcademicDataset = {
  mapel: AcademicMapelInput[]
  penugasan: AcademicPenugasanInput[]
  jadwal: AcademicJadwalInput[]
}

export type AcademicMapelInput = {
  nama_mapel: string
  kode_asc?: string | null
  kode_mapel?: string | null
  kelompok?: string | null
  tingkat?: string | null
  kategori?: string | null
}

export type AcademicPenugasanInput = {
  nama_guru: string
  nama_mapel: string
  nama_kelas: string
}

export type AcademicJadwalInput = {
  nama_guru: string
  nama_mapel: string
  nama_kelas: string
  hari: number
  jam_ke: number
}

export const ACADEMIC_WIZARD_STEPS = ['mapel', 'penugasan', 'jadwal'] as const
export type AcademicWizardStepKey = typeof ACADEMIC_WIZARD_STEPS[number]

const GURU_ALIAS_MAP: Record<string, string> = {
  ARI: 'Ari Anugrah, S.Pd',
  INTAN: 'Intan Purnamasari, S.Pd',
  RICKY: 'Ricky Habibi, S.Pd',
  YUDA: 'Diyaz Najib, S.Pd',
}

export function resolveGuruAlias(xmlName: string): string {
  const match = String(xmlName || '').trim().match(/^([A-Z]+)\s+\d+$/)
  if (match) return GURU_ALIAS_MAP[match[1]] || xmlName
  return xmlName
}

export function parseKelasName(name: string): { tingkat: number; nomor: string } | null {
  const upper = String(name || '').toUpperCase().trim()
  let tingkat = 0
  let rest = ''

  if (upper.startsWith('XII-')) { tingkat = 12; rest = upper.slice(4) }
  else if (upper.startsWith('XI-')) { tingkat = 11; rest = upper.slice(3) }
  else if (upper.startsWith('X-')) { tingkat = 10; rest = upper.slice(2) }
  else if (upper.startsWith('IX-')) { tingkat = 9; rest = upper.slice(3) }
  else if (upper.startsWith('VIII-')) { tingkat = 8; rest = upper.slice(5) }
  else if (upper.startsWith('VII-')) { tingkat = 7; rest = upper.slice(4) }
  else {
    const direct = upper.match(/^(\d+)-(.+)$/)
    if (!direct) return null
    tingkat = Number(direct[1])
    rest = direct[2]
  }

  const nomorRaw = rest.split('(')[0].trim()
  const parsed = parseInt(nomorRaw, 10)
  const nomor = Number.isNaN(parsed) ? nomorRaw : String(parsed)
  if (!tingkat || !nomor) return null
  return { tingkat, nomor }
}

function daysToHari(days: string): number {
  if (days === '100000') return 1
  if (days === '010000') return 2
  if (days === '001000') return 3
  if (days === '000100') return 4
  if (days === '000010') return 5
  if (days === '000001') return 6
  return 0
}

function parseAttrs(tag: string): Map<string, string> {
  const map = new Map<string, string>()
  const re = /(\w+)="([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = re.exec(tag)) !== null) map.set(match[1], match[2])
  return map
}

function extractTags(xml: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}\\s[^>]*/?>`, 'g')
  return xml.match(re) || []
}

function normalizeKey(value: string): string {
  return String(value || '').toLowerCase().trim()
}

function findByName(map: Map<string, string>, name: string): string | undefined {
  const lower = normalizeKey(name)
  const exact = map.get(lower)
  if (exact) return exact
  for (const [candidate, id] of map) {
    if (lower.includes(candidate) || candidate.includes(lower)) return id
  }
  return undefined
}

function defaultMapelMeta(namaMapel: string) {
  const tingkatMatch = String(namaMapel || '').match(/\b(7|8|9|10|11|12)\b/)
  return {
    kelompok: 'UMUM',
    tingkat: tingkatMatch ? tingkatMatch[1] : 'Semua',
    kategori: 'Kelompok Mata Pelajaran Umum',
  }
}

export function buildAcademicDatasetFromAscXml(xmlText: string): AcademicDataset {
  const xmlSubjects = new Map<string, { name: string; short: string }>()
  for (const tag of extractTags(xmlText, 'subject')) {
    const attrs = parseAttrs(tag)
    const id = attrs.get('id')
    const name = attrs.get('name')
    if (id && name) xmlSubjects.set(id, { name: name.trim(), short: (attrs.get('short') || '').trim() })
  }

  const xmlTeachers = new Map<string, string>()
  for (const tag of extractTags(xmlText, 'teacher')) {
    const attrs = parseAttrs(tag)
    const id = attrs.get('id')
    const name = attrs.get('name')
    if (id && name) xmlTeachers.set(id, name.trim())
  }

  const xmlClasses = new Map<string, string>()
  for (const tag of extractTags(xmlText, 'class')) {
    const attrs = parseAttrs(tag)
    const id = attrs.get('id')
    const name = attrs.get('name')
    if (id && name) xmlClasses.set(id, name.trim())
  }

  const xmlLessons = new Map<string, { classId: string; subjectId: string; teacherId: string }>()
  for (const tag of extractTags(xmlText, 'lesson')) {
    const attrs = parseAttrs(tag)
    const id = attrs.get('id')
    const classId = attrs.get('classids') || ''
    const subjectId = attrs.get('subjectid') || ''
    const teacherId = attrs.get('teacherids') || ''
    if (id && classId && subjectId && teacherId) xmlLessons.set(id, { classId, subjectId, teacherId })
  }

  const mapel = Array.from(xmlSubjects.values()).map(subject => ({
    nama_mapel: subject.name,
    kode_asc: subject.short || null,
  }))

  const jadwal: AcademicJadwalInput[] = []
  for (const tag of extractTags(xmlText, 'card')) {
    const attrs = parseAttrs(tag)
    const lesson = xmlLessons.get(attrs.get('lessonid') || '')
    const hari = daysToHari(attrs.get('days') || '')
    const jamKe = parseInt(attrs.get('period') || '0', 10)
    if (!lesson || !hari || !jamKe) continue

    const subject = xmlSubjects.get(lesson.subjectId)
    const teacherName = resolveGuruAlias(xmlTeachers.get(lesson.teacherId) || '')
    const className = xmlClasses.get(lesson.classId) || ''
    if (!subject?.name || !teacherName || !className) continue

    jadwal.push({
      nama_guru: teacherName,
      nama_mapel: subject.name,
      nama_kelas: className,
      hari,
      jam_ke: jamKe,
    })
  }

  const penugasanSeen = new Set<string>()
  const penugasan: AcademicPenugasanInput[] = []
  for (const row of jadwal) {
    const key = `${normalizeKey(row.nama_guru)}|${normalizeKey(row.nama_mapel)}|${normalizeKey(row.nama_kelas)}`
    if (penugasanSeen.has(key)) continue
    penugasanSeen.add(key)
    penugasan.push({
      nama_guru: row.nama_guru,
      nama_mapel: row.nama_mapel,
      nama_kelas: row.nama_kelas,
    })
  }

  return { mapel, penugasan, jadwal }
}

export function buildAcademicDatasetFromWizard(rowsByStep: Record<string, any[]>): AcademicDataset {
  const mapel = (rowsByStep.mapel || []).map(row => ({
    nama_mapel: String(row.NAMA_MAPEL || row.nama_mapel || '').trim(),
    kode_asc: row.KODE_ASC ?? row.kode_asc ?? null,
    kode_mapel: row.KODE_RDM ?? row.KODE_MAPEL ?? row.kode_mapel ?? null,
    kelompok: row.KELOMPOK ?? row.kelompok ?? null,
    tingkat: row.TINGKAT ?? row.tingkat ?? null,
    kategori: row.KATEGORI ?? row.kategori ?? null,
  })).filter(row => row.nama_mapel)

  const penugasan = (rowsByStep.penugasan || []).map(row => ({
    nama_guru: String(row.NAMA_GURU || row.nama_guru || '').trim(),
    nama_mapel: String(row.NAMA_MAPEL || row.nama_mapel || '').trim(),
    nama_kelas: String(row.NAMA_KELAS || row.nama_kelas || '').trim(),
  })).filter(row => row.nama_guru && row.nama_mapel && row.nama_kelas)

  const jadwal = (rowsByStep.jadwal || []).map(row => ({
    nama_guru: String(row.NAMA_GURU || row.nama_guru || '').trim(),
    nama_mapel: String(row.NAMA_MAPEL || row.nama_mapel || '').trim(),
    nama_kelas: String(row.NAMA_KELAS || row.nama_kelas || '').trim(),
    hari: Number(row.HARI ?? row.hari ?? 0),
    jam_ke: Number(row.JAM_KE ?? row.jam_ke ?? 0),
  })).filter(row => row.nama_guru && row.nama_mapel && row.nama_kelas && row.hari && row.jam_ke)

  return { mapel, penugasan, jadwal }
}

export async function applyAcademicDataset(
  db: D1Database,
  tahunAjaranId: string,
  dataset: AcademicDataset
): Promise<AcademicImportResult> {
  const logs: string[] = []
  const emptyStats = { mapel: 0, penugasan: 0, jadwal: 0 }

  const existingMapelRows = await db.prepare('SELECT id, LOWER(TRIM(nama_mapel)) as nama FROM mata_pelajaran').all<any>()
  const mapelMap = new Map<string, string>()
  for (const row of existingMapelRows.results || []) mapelMap.set(row.nama, row.id)

  let mapelTouched = 0
  for (const row of dataset.mapel) {
    const nama = String(row.nama_mapel || '').trim()
    if (!nama) continue
    const meta = defaultMapelMeta(nama)
    const existingId = mapelMap.get(normalizeKey(nama))
    const kodeAsc = row.kode_asc ? String(row.kode_asc).trim() : null
    const kodeMapel = row.kode_mapel ? String(row.kode_mapel).trim() : null
    const kelompok = row.kelompok ? String(row.kelompok).trim() : null
    const tingkat = row.tingkat ? String(row.tingkat).trim() : null
    const kategori = row.kategori ? String(row.kategori).trim() : null

    if (existingId) {
      await db.prepare(`
        UPDATE mata_pelajaran
        SET kode_asc = COALESCE(?, kode_asc),
            kode_mapel = COALESCE(?, kode_mapel),
            kelompok = COALESCE(?, kelompok),
            tingkat = COALESCE(?, tingkat),
            kategori = COALESCE(?, kategori)
        WHERE id = ?
      `).bind(kodeAsc, kodeMapel, kelompok, tingkat, kategori, existingId).run()
      mapelTouched++
      continue
    }

    const id = crypto.randomUUID().replace(/-/g, '')
    await db.prepare(`
      INSERT INTO mata_pelajaran (id, nama_mapel, kode_asc, kode_mapel, kelompok, tingkat, kategori, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(id, nama, kodeAsc, kodeMapel, kelompok || meta.kelompok, tingkat || meta.tingkat, kategori || meta.kategori).run()
    mapelMap.set(normalizeKey(nama), id)
    mapelTouched++
  }

  const refreshedMapelRows = await db.prepare('SELECT id, LOWER(TRIM(nama_mapel)) as nama FROM mata_pelajaran').all<any>()
  mapelMap.clear()
  for (const row of refreshedMapelRows.results || []) mapelMap.set(row.nama, row.id)

  const [guruAll, kelasAll] = await Promise.all([
    db.prepare('SELECT id, LOWER(TRIM(nama_lengkap)) as nama FROM "user" WHERE nama_lengkap IS NOT NULL').all<any>(),
    db.prepare('SELECT id, CAST(tingkat AS INTEGER) as tingkat, TRIM(nomor_kelas) as nomor FROM kelas').all<any>(),
  ])

  const guruMap = new Map<string, string>()
  for (const row of guruAll.results || []) guruMap.set(row.nama, row.id)

  const kelasMap = new Map<string, string>()
  for (const row of kelasAll.results || []) kelasMap.set(`${row.tingkat}-${String(row.nomor).trim()}`, row.id)

  type ResolvedAssignment = { guruId: string; mapelId: string; kelasId: string; sourceName: string }
  type ResolvedSchedule = ResolvedAssignment & { hari: number; jamKe: number }

  const resolveAssignment = (
    row: { nama_guru: string; nama_mapel: string; nama_kelas: string },
    rowLabel: string
  ): ResolvedAssignment | null => {
    const guruName = resolveGuruAlias(row.nama_guru)
    const guruId = findByName(guruMap, guruName)
    if (!guruId) { logs.push(`${rowLabel}: Guru "${row.nama_guru}" tidak ditemukan.`); return null }

    const mapelId = findByName(mapelMap, row.nama_mapel)
    if (!mapelId) { logs.push(`${rowLabel}: Mapel "${row.nama_mapel}" tidak ditemukan.`); return null }

    const parsedKelas = parseKelasName(row.nama_kelas)
    if (!parsedKelas) { logs.push(`${rowLabel}: Format kelas "${row.nama_kelas}" tidak valid.`); return null }
    const kelasId = kelasMap.get(`${parsedKelas.tingkat}-${parsedKelas.nomor}`)
    if (!kelasId) { logs.push(`${rowLabel}: Kelas "${row.nama_kelas}" tidak ditemukan.`); return null }

    return {
      guruId,
      mapelId,
      kelasId,
      sourceName: `${row.nama_guru} - ${row.nama_mapel} - ${row.nama_kelas}`,
    }
  }

  const assignmentRows: ResolvedAssignment[] = []
  dataset.penugasan.forEach((row, index) => {
    const resolved = resolveAssignment(row, `Beban baris ${index + 2}`)
    if (resolved) assignmentRows.push(resolved)
  })

  const scheduleRows: ResolvedSchedule[] = []
  dataset.jadwal.forEach((row, index) => {
    if (row.hari < 1 || row.hari > 6) { logs.push(`Jadwal baris ${index + 2}: Hari harus 1-6.`); return }
    if (row.jam_ke < 1) { logs.push(`Jadwal baris ${index + 2}: Jam ke tidak valid.`); return }
    const resolved = resolveAssignment(row, `Jadwal baris ${index + 2}`)
    if (resolved) {
      assignmentRows.push(resolved)
      scheduleRows.push({ ...resolved, hari: row.hari, jamKe: row.jam_ke })
    }
  })

  if (assignmentRows.length === 0 && scheduleRows.length === 0) {
    return { success: null, error: 'Tidak ada beban mengajar atau jadwal valid yang bisa diterapkan.', logs, stats: emptyStats }
  }

  await db.prepare('DELETE FROM penugasan_mengajar WHERE tahun_ajaran_id = ?').bind(tahunAjaranId).run()

  const keyToId = new Map<string, string>()
  const keyToAssignment = new Map<string, ResolvedAssignment>()

  const assignmentKey = (row: ResolvedAssignment) =>
    `${row.guruId}|${row.mapelId}|${row.kelasId}`

  for (const row of assignmentRows) {
    const key = assignmentKey(row)
    if (!keyToId.has(key)) {
      keyToId.set(key, crypto.randomUUID().replace(/-/g, ''))
      keyToAssignment.set(key, row)
    }
  }

  const penugasanRows = Array.from(keyToId.entries()).map(([key, id]) => {
    const assignment = keyToAssignment.get(key)!
    return { id, ...assignment }
  })

  let penugasanCount = 0
  for (let i = 0; i < penugasanRows.length; i += 10) {
    const chunk = penugasanRows.slice(i, i + 10)
    const placeholders = chunk.map(() => `(?, ?, ?, ?, ?, datetime('now'))`).join(', ')
    const values = chunk.flatMap(row => [row.id, row.guruId, row.mapelId, row.kelasId, tahunAjaranId])
    await db.prepare(`
      INSERT OR IGNORE INTO penugasan_mengajar (id, guru_id, mapel_id, kelas_id, tahun_ajaran_id, created_at)
      VALUES ${placeholders}
    `).bind(...values).run()
    penugasanCount += chunk.length
  }

  const seenSchedule = new Set<string>()
  const scheduleToInsert: Array<{ penugasanId: string; hari: number; jamKe: number }> = []
  for (const row of scheduleRows) {
    const key = assignmentKey(row)
    const penugasanId = keyToId.get(key)
    if (!penugasanId) continue
    const unique = `${penugasanId}|${row.hari}|${row.jamKe}`
    if (seenSchedule.has(unique)) continue
    seenSchedule.add(unique)
    scheduleToInsert.push({ penugasanId, hari: row.hari, jamKe: row.jamKe })
  }

  let jadwalCount = 0
  for (let i = 0; i < scheduleToInsert.length; i += 15) {
    const chunk = scheduleToInsert.slice(i, i + 15)
    const placeholders = chunk.map(() => `(?, ?, ?, ?, ?, datetime('now'))`).join(', ')
    const values = chunk.flatMap(row => [crypto.randomUUID().replace(/-/g, ''), row.penugasanId, tahunAjaranId, row.hari, row.jamKe])
    await db.prepare(`
      INSERT OR IGNORE INTO jadwal_mengajar (id, penugasan_id, tahun_ajaran_id, hari, jam_ke, created_at)
      VALUES ${placeholders}
    `).bind(...values).run()
    jadwalCount += chunk.length
  }

  const stats = { mapel: mapelTouched, penugasan: penugasanCount, jadwal: jadwalCount }
  return {
    success: `Import selesai: ${stats.mapel} mapel, ${stats.penugasan} penugasan, ${stats.jadwal} slot jadwal.`,
    error: null,
    logs,
    stats,
  }
}

export function parseWizardRows(rows: Array<{ step_key: string; payload_json: string | null }>) {
  return rows.reduce<Record<string, any[]>>((acc, row) => {
    if (!acc[row.step_key]) acc[row.step_key] = []
    acc[row.step_key].push(parseJsonCol<any>(row.payload_json, {}))
    return acc
  }, {})
}
