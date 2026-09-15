import { enrichTeacherLeaveSessions } from './teacher-leave-db'
import { currentTimeWIB, todayWIB } from './time'
import {
  getEffectiveDatesInRange,
  getKbmExceptionsForRange,
  hariNumFromDateString,
  splitTeachingSlotsByExceptions,
  type KbmException,
} from './kalender-pendidikan'
import { formatNamaKelas } from './utils'
import {
  emptyTeacherAttendanceSummary,
  getTeacherAttendanceMonthRange,
  normalizeTeacherAttendanceMonth,
  resolveTeacherAttendanceStatus,
  summarizeTeacherAttendance,
  type TeacherAttendanceItem,
  type TeacherAttendanceResult,
} from './teacher-attendance-core'

export * from './teacher-attendance-core'

type AgendaRow = {
  id: string
  penugasan_id: string
  tanggal: string
  status: string
  materi: string | null
  waktu_input: string | null
  catatan_admin: string | null
  ppl_user_id: string | null
  ppl_nama: string | null
}

type DelegationRow = {
  penugasan_mengajar_id: string
  tanggal: string
  alasan_ketidakhadiran: string
  deskripsi_ketidakhadiran: string | null
}

type ScheduleRow = {
  penugasan_id: string
  hari: number
  jam_ke: number
  kelas_id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
  kbm_nonaktif_mulai: string | null
  nama_mapel: string
}

type Slot = { id: number; mulai: string; selesai: string }
type PolaJam = { hari: number[]; slots: Slot[] }

function parsePolaJam(raw: string | null | undefined): PolaJam[] {
  try {
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function resolveTahunAjaran(db: D1Database, guruId: string, month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const semester = monthNumber >= 7 ? 1 : 2
  const academicStartYear = monthNumber >= 7 ? year : year - 1
  const academicEndYear = academicStartYear + 1

  const matched = await db.prepare(`
    SELECT ta.id, ta.jam_pelajaran
    FROM tahun_ajaran ta
    WHERE ta.semester = ?
      AND ta.nama LIKE ?
      AND ta.nama LIKE ?
      AND EXISTS (
        SELECT 1 FROM penugasan_mengajar pm
        WHERE pm.tahun_ajaran_id = ta.id AND pm.guru_id = ?
      )
    ORDER BY ta.is_active DESC, ta.created_at DESC
    LIMIT 1
  `).bind(semester, `%${academicStartYear}%`, `%${academicEndYear}%`, guruId).first<{ id: string; jam_pelajaran: string }>()
  if (matched) return matched

  return db.prepare(`
    SELECT ta.id, ta.jam_pelajaran
    FROM tahun_ajaran ta
    WHERE EXISTS (
      SELECT 1 FROM penugasan_mengajar pm
      WHERE pm.tahun_ajaran_id = ta.id AND pm.guru_id = ?
    )
    ORDER BY ta.is_active DESC, ta.created_at DESC
    LIMIT 1
  `).bind(guruId).first<{ id: string; jam_pelajaran: string }>()
}

export async function getTeacherAttendance(
  db: D1Database,
  guruId: string,
  requestedMonth?: string | null
): Promise<TeacherAttendanceResult> {
  const today = todayWIB()
  const month = normalizeTeacherAttendanceMonth(requestedMonth, today)
  const range = getTeacherAttendanceMonthRange(month, today)
  const emptyResult = (): TeacherAttendanceResult => ({
    month,
    rangeStart: range.start,
    rangeEnd: range.end,
    summary: emptyTeacherAttendanceSummary(),
    items: [],
  })

  if (range.start > range.end) return emptyResult()
  const ta = await resolveTahunAjaran(db, guruId, month)
  if (!ta) return emptyResult()

  const effectiveDates = await getEffectiveDatesInRange(db, range.start, range.end)
  if (effectiveDates.length === 0) return emptyResult()

  const [scheduleResult, agendaResult, delegationResult, exceptions] = await Promise.all([
    db.prepare(`
      SELECT DISTINCT jm.penugasan_id, jm.hari, jm.jam_ke,
        k.id as kelas_id, k.tingkat, k.nomor_kelas, k.kelompok, k.kbm_nonaktif_mulai,
        mp.nama_mapel
      FROM jadwal_mengajar jm
      JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
      JOIN kelas k ON pm.kelas_id = k.id
      JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
      WHERE jm.tahun_ajaran_id = ? AND pm.guru_id = ?
      ORDER BY jm.hari ASC, jm.jam_ke ASC
    `).bind(ta.id, guruId).all<ScheduleRow>(),
    db.prepare(`
      SELECT ag.id, ag.penugasan_id, ag.tanggal, ag.status, ag.materi, ag.waktu_input,
        ag.catatan_admin, ag.ppl_user_id, u_ppl.nama_lengkap AS ppl_nama
      FROM agenda_guru ag
      LEFT JOIN "user" u_ppl ON u_ppl.id = ag.ppl_user_id
      WHERE ag.guru_id = ? AND ag.tanggal BETWEEN ? AND ?
    `).bind(guruId, range.start, range.end).all<AgendaRow>(),
    db.prepare(`
      SELECT dtk.penugasan_mengajar_id, dt.tanggal,
        dt.alasan_ketidakhadiran, dt.deskripsi_ketidakhadiran
      FROM delegasi_tugas dt
      JOIN delegasi_tugas_kelas dtk ON dt.id = dtk.delegasi_id
      WHERE dt.dari_user_id = ? AND dt.tanggal BETWEEN ? AND ?
    `).bind(guruId, range.start, range.end).all<DelegationRow>(),
    getKbmExceptionsForRange(db, range.start, range.end),
  ])

  const scheduleByDay = new Map<number, Map<string, ScheduleRow[]>>()
  for (const row of scheduleResult.results || []) {
    const day = Number(row.hari)
    if (!scheduleByDay.has(day)) scheduleByDay.set(day, new Map())
    const byAssignment = scheduleByDay.get(day)!
    if (!byAssignment.has(row.penugasan_id)) byAssignment.set(row.penugasan_id, [])
    byAssignment.get(row.penugasan_id)!.push(row)
  }

  const agendaByKey = new Map(
    (agendaResult.results || []).map(row => [`${row.tanggal}:${row.penugasan_id}`, row])
  )
  const delegationByKey = new Map(
    (delegationResult.results || []).map(row => [`${row.tanggal}:${row.penugasan_mengajar_id}`, row])
  )
  const exceptionsByDate = new Map<string, KbmException[]>()
  for (const exception of exceptions) {
    if (!exceptionsByDate.has(exception.tanggal)) exceptionsByDate.set(exception.tanggal, [])
    exceptionsByDate.get(exception.tanggal)!.push(exception)
  }

  const polaJam = parsePolaJam(ta.jam_pelajaran)
  const current = currentTimeWIB()
  const currentMinutes = current.hours * 60 + current.minutes
  const items: TeacherAttendanceItem[] = []

  for (const tanggal of effectiveDates) {
    const hari = hariNumFromDateString(tanggal)
    const assignments = scheduleByDay.get(hari)
    if (!assignments) continue

    for (const [penugasanId, scheduleRows] of assignments) {
      const first = scheduleRows[0]
      if (first.kbm_nonaktif_mulai && first.kbm_nonaktif_mulai <= tanggal) continue

      const slotState = splitTeachingSlotsByExceptions(
        exceptionsByDate.get(tanggal) || [],
        { id: first.kelas_id, tingkat: Number(first.tingkat) },
        scheduleRows.map(row => Number(row.jam_ke))
      )
      if (slotState.activeJamKe.length === 0) continue

      const jamKeMulai = slotState.activeJamKe[0]
      const jamKeSelesai = slotState.activeJamKe[slotState.activeJamKe.length - 1]
      const daySlots = polaJam.find(item => item.hari.includes(hari))?.slots || []
      const slotMulai = daySlots.find(slot => Number(slot.id) === jamKeMulai)?.mulai || null
      const slotSelesai = daySlots.find(slot => Number(slot.id) === jamKeSelesai)?.selesai || null
      const key = `${tanggal}:${penugasanId}`
      const agenda = agendaByKey.get(key)
      const delegation = delegationByKey.get(key)

      let blockEnded = tanggal < today
      if (tanggal === today) {
        if (!slotSelesai) blockEnded = true
        else {
          const [hours, minutes] = slotSelesai.split(':').map(Number)
          blockEnded = currentMinutes > hours * 60 + minutes
        }
      }

      const status = resolveTeacherAttendanceStatus({
        agendaStatus: agenda?.status,
        delegationReason: delegation?.alasan_ketidakhadiran,
        blockEnded,
      })
      if (!status) continue

      items.push({
        key,
        agendaId: agenda?.id || null,
        tanggal,
        status,
        penugasanId,
        mapelNama: first.nama_mapel,
        kelasId: first.kelas_id,
        kelasLabel: formatNamaKelas(first.tingkat, first.nomor_kelas, first.kelompok),
        jamKeMulai,
        jamKeSelesai,
        slotMulai,
        slotSelesai,
        materi: agenda?.materi || null,
        waktuInput: agenda?.waktu_input || null,
        catatan: agenda?.catatan_admin || delegation?.deskripsi_ketidakhadiran || null,
        pplUserId: agenda?.ppl_user_id || null,
        pplNama: agenda?.ppl_nama || null,
      })
    }
  }

  const enriched = await enrichTeacherLeaveSessions(db, items.map(item => ({ ...item, penugasan_id: item.penugasanId })))
  enriched.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.jamKeMulai - a.jamKeMulai)
  return {
    month,
    rangeStart: range.start,
    rangeEnd: range.end,
    summary: summarizeTeacherAttendance(enriched),
    items: enriched,
  }
}
