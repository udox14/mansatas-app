export type TeacherAttendanceHistoryStatus = 'IZIN' | 'SAKIT' | 'ALFA'
export type TeacherAttendanceHistoryFilter = 'ALL' | TeacherAttendanceHistoryStatus

export function filterAndCountTeacherAttendanceHistory<T extends { status: TeacherAttendanceHistoryStatus }>(
  rows: T[],
  statusFilter: TeacherAttendanceHistoryFilter
) {
  const counts = {
    izin: rows.filter(row => row.status === 'IZIN').length,
    sakit: rows.filter(row => row.status === 'SAKIT').length,
    alfa: rows.filter(row => row.status === 'ALFA').length,
  }

  return {
    rows: statusFilter === 'ALL' ? rows : rows.filter(row => row.status === statusFilter),
    counts,
  }
}
