import { describe, expect, it } from 'vitest'
import { filterAndCountTeacherAttendanceHistory } from './teacher-attendance-history'

const rows = [
  { id: 'leave-1', status: 'IZIN' as const },
  { id: 'sick-1', status: 'SAKIT' as const },
  { id: 'alfa-1', status: 'ALFA' as const },
  { id: 'alfa-2', status: 'ALFA' as const },
]

describe('teacher monthly attendance history', () => {
  it('counts every absence status and returns all rows for ALL', () => {
    expect(filterAndCountTeacherAttendanceHistory(rows, 'ALL')).toEqual({
      rows,
      counts: { izin: 1, sakit: 1, alfa: 2 },
    })
  })

  it('filters one status without changing monthly totals', () => {
    expect(filterAndCountTeacherAttendanceHistory(rows, 'SAKIT')).toEqual({
      rows: [rows[1]],
      counts: { izin: 1, sakit: 1, alfa: 2 },
    })
  })

  it('returns zero counts for an empty month', () => {
    expect(filterAndCountTeacherAttendanceHistory([], 'ALL')).toEqual({
      rows: [],
      counts: { izin: 0, sakit: 0, alfa: 0 },
    })
  })
})
