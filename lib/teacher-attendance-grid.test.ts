import { describe, expect, it } from 'vitest'
import {
  attendanceStatusCode,
  chunkAttendanceSessions,
  orderedAttendanceSessions,
  studentStatusBySession,
} from './teacher-attendance-grid'

describe('teacher attendance grid', () => {
  it('mengurutkan kolom sesi berdasarkan tanggal', () => {
    const sessions = orderedAttendanceSessions([
      { key: 'b', tanggal: '2026-08-20' },
      { key: 'a', tanggal: '2026-08-04' },
    ])
    expect(sessions.map(item => item.key)).toEqual(['a', 'b'])
  })

  it('memetakan status lengkap menjadi kode compact', () => {
    const statusesToCheck = ['HADIR', 'SAKIT', 'IZIN', 'ALFA'] as const
    expect(statusesToCheck.map(status => attendanceStatusCode(status))).toEqual(['H', 'S', 'I', 'A'])
    const statuses = studentStatusBySession({
      sessions: [
        { session_key: 's1', tanggal: '2026-08-01', status: 'HADIR' },
        { session_key: 's2', tanggal: '2026-08-02', status: 'ALFA' },
      ],
    })
    expect(statuses.get('s1')).toBe('HADIR')
    expect(statuses.get('s2')).toBe('ALFA')
  })

  it('membagi tanggal PDF maksimal 15 kolom per tabel', () => {
    const sessions = Array.from({ length: 31 }, (_, index) => ({ index }))
    expect(chunkAttendanceSessions(sessions, 15).map(chunk => chunk.length)).toEqual([15, 15, 1])
  })
})
