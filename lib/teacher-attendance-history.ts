export type TeacherAttendanceHistoryStatus = 'IZIN' | 'SAKIT' | 'ALFA' | 'CUTI'
export type TeacherAttendanceHistoryFilter = 'ALL' | TeacherAttendanceHistoryStatus

export function filterAndCountTeacherAttendanceHistory<T extends { status: TeacherAttendanceHistoryStatus }>(
  rows: T[],
  statusFilter: TeacherAttendanceHistoryFilter
) {
  const counts = {
    izin: rows.filter(row => row.status === 'IZIN').length,
    sakit: rows.filter(row => row.status === 'SAKIT').length,
    alfa: rows.filter(row => row.status === 'ALFA').length,
    ...(rows.some(row => row.status === 'CUTI') ? { cuti: rows.filter(row => row.status === 'CUTI').length } : {}),
  }

  return {
    rows: statusFilter === 'ALL' ? rows : rows.filter(row => row.status === statusFilter),
    counts,
  }
}
