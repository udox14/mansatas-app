export const TEACHER_ATTENDANCE_START_DATE = '2026-07-20'

export type TeacherAttendanceStatus = 'TEPAT_WAKTU' | 'TELAT' | 'SAKIT' | 'IZIN' | 'ALFA'

export type TeacherAttendanceSummary = {
  total: number
  hadir: number
  telat: number
  sakit: number
  izin: number
  alfa: number
}

export type TeacherAttendanceItem = {
  key: string
  agendaId: string | null
  tanggal: string
  status: TeacherAttendanceStatus
  penugasanId: string
  mapelNama: string
  kelasId: string
  kelasLabel: string
  jamKeMulai: number
  jamKeSelesai: number
  slotMulai: string | null
  slotSelesai: string | null
  materi: string | null
  waktuInput: string | null
  catatan: string | null
}

export type TeacherAttendanceResult = {
  month: string
  rangeStart: string
  rangeEnd: string
  summary: TeacherAttendanceSummary
  items: TeacherAttendanceItem[]
}

export function emptyTeacherAttendanceSummary(): TeacherAttendanceSummary {
  return { total: 0, hadir: 0, telat: 0, sakit: 0, izin: 0, alfa: 0 }
}

export function summarizeTeacherAttendance(items: TeacherAttendanceItem[]): TeacherAttendanceSummary {
  const summary = emptyTeacherAttendanceSummary()
  for (const item of items) {
    summary.total++
    if (item.status === 'TEPAT_WAKTU' || item.status === 'TELAT') summary.hadir++
    if (item.status === 'TELAT') summary.telat++
    if (item.status === 'SAKIT') summary.sakit++
    if (item.status === 'IZIN') summary.izin++
    if (item.status === 'ALFA') summary.alfa++
  }
  return summary
}

export function resolveTeacherAttendanceStatus(options: {
  agendaStatus?: string | null
  delegationReason?: string | null
  blockEnded: boolean
}): TeacherAttendanceStatus | null {
  if (options.agendaStatus) {
    if (options.agendaStatus === 'TELAT') return 'TELAT'
    if (options.agendaStatus === 'SAKIT') return 'SAKIT'
    if (options.agendaStatus === 'IZIN') return 'IZIN'
    if (options.agendaStatus === 'ALFA') return 'ALFA'
    return 'TEPAT_WAKTU'
  }
  if (options.delegationReason === 'SAKIT') return 'SAKIT'
  if (options.delegationReason) return 'IZIN'
  return options.blockEnded ? 'ALFA' : null
}

export function normalizeTeacherAttendanceMonth(value: string | null | undefined, today: string) {
  const currentMonth = today.slice(0, 7)
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return currentMonth
  const firstAllowedMonth = TEACHER_ATTENDANCE_START_DATE.slice(0, 7)
  if (value < firstAllowedMonth) return firstAllowedMonth
  if (value > currentMonth) return currentMonth
  return value
}

export function getTeacherAttendanceMonthRange(month: string, today: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  const monthStart = `${month}-01`
  const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`
  return {
    start: monthStart < TEACHER_ATTENDANCE_START_DATE ? TEACHER_ATTENDANCE_START_DATE : monthStart,
    end: monthEnd > today ? today : monthEnd,
  }
}
