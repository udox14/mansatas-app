export type AttendanceGridStatus = 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA'

export type AttendanceGridSession = {
  key: string
  tanggal: string
}

export type AttendanceGridStudent = {
  sessions: Array<{
    session_key: string
    tanggal: string
    status: AttendanceGridStatus
  }>
}

export function attendanceStatusCode(status: AttendanceGridStatus) {
  if (status === 'HADIR') return 'H'
  if (status === 'SAKIT') return 'S'
  if (status === 'IZIN') return 'I'
  return 'A'
}

export function orderedAttendanceSessions<T extends AttendanceGridSession>(sessions: T[]) {
  return [...sessions].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.key.localeCompare(b.key))
}

export function studentStatusBySession(student: AttendanceGridStudent) {
  return new Map(student.sessions.map(item => [item.session_key, item.status]))
}

export function chunkAttendanceSessions<T>(sessions: T[], size = 15): T[][] {
  if (size < 1) throw new Error('Ukuran blok tanggal minimal 1.')
  const chunks: T[][] = []
  for (let index = 0; index < sessions.length; index += size) chunks.push(sessions.slice(index, index + size))
  return chunks
}
