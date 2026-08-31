import { describe, expect, it } from 'vitest'
import {
  aggregateAttendanceTotal,
  aggregateTeacherAttendance,
  calculatePerformance,
  type AgendaPrintSession,
} from './print-summary'

function session(overrides: Partial<AgendaPrintSession>): AgendaPrintSession {
  return {
    penugasan_id: 'assignment-1',
    tanggal: '2026-08-03',
    guru_id: 'guru-1',
    guru_nama: 'Budi',
    nama_mapel: 'Matematika',
    kelas_id: 'kelas-1',
    tingkat: 10,
    nomor_kelas: 1,
    jam_ke_mulai: 1,
    jam_ke_selesai: 2,
    materi: null,
    status: 'TEPAT_WAKTU',
    keterangan: null,
    ...overrides,
  }
}

describe('calculatePerformance', () => {
  it('returns zero when there are no teaching blocks', () => {
    expect(calculatePerformance({ totalBlok: 0, hadir: 0, sakit: 0, izin: 0 }, 'excused_not_penalized')).toBe(0)
  })

  it('supports both excused-absence policies and rounds the result', () => {
    const counts = { totalBlok: 6, hadir: 3, sakit: 1, izin: 1 }
    expect(calculatePerformance(counts, 'excused_not_penalized')).toBe(83)
    expect(calculatePerformance(counts, 'excused_penalized')).toBe(50)
  })
})

describe('aggregateTeacherAttendance', () => {
  it('combines on-time and late sessions as present and sorts teachers and sessions', () => {
    const result = aggregateTeacherAttendance([
      session({ guru_id: 'guru-2', guru_nama: 'Citra', status: 'IZIN' }),
      session({ tanggal: '2026-08-05', jam_ke_mulai: 5, status: 'TELAT' }),
      session({ tanggal: '2026-08-04', jam_ke_mulai: 3, status: 'SAKIT' }),
      session({ guru_id: 'guru-0', guru_nama: 'Ani', status: 'ALFA' }),
      session({ tanggal: '2026-08-04', jam_ke_mulai: 1, status: 'TEPAT_WAKTU' }),
    ], 'excused_not_penalized')

    expect(result.map(row => row.guruNama)).toEqual(['Ani', 'Budi', 'Citra'])
    expect(result[1]).toMatchObject({ totalBlok: 3, hadir: 2, sakit: 1, izin: 0, alfa: 0, performa: 100 })
    expect(result[1].sessions.map(row => `${row.tanggal}:${row.jam_ke_mulai}`)).toEqual([
      '2026-08-04:1',
      '2026-08-04:3',
      '2026-08-05:5',
    ])
    expect(result[1].hadir + result[1].sakit + result[1].izin + result[1].alfa).toBe(result[1].totalBlok)
  })

  it('calculates the grand percentage from weighted totals', () => {
    const teachers = aggregateTeacherAttendance([
      session({ status: 'TEPAT_WAKTU' }),
      session({ guru_id: 'guru-2', guru_nama: 'Citra', status: 'TEPAT_WAKTU' }),
      session({ guru_id: 'guru-2', guru_nama: 'Citra', penugasan_id: 'assignment-2', status: 'ALFA' }),
      session({ guru_id: 'guru-2', guru_nama: 'Citra', penugasan_id: 'assignment-3', status: 'ALFA' }),
    ], 'excused_penalized')

    expect(teachers.map(row => row.performa)).toEqual([100, 33])
    expect(aggregateAttendanceTotal(teachers, 'excused_penalized')).toEqual({
      totalBlok: 4,
      hadir: 2,
      sakit: 0,
      izin: 0,
      alfa: 2,
      performa: 50,
    })
  })

  it('sorts the printed teacher summary by the chosen metric with names as a stable tie-breaker', () => {
    const sessions = [
      session({ guru_id: 'guru-1', guru_nama: 'Budi', status: 'TEPAT_WAKTU' }),
      session({ guru_id: 'guru-1', guru_nama: 'Budi', penugasan_id: 'assignment-2', status: 'ALFA' }),
      session({ guru_id: 'guru-2', guru_nama: 'Ani', status: 'ALFA' }),
      session({ guru_id: 'guru-3', guru_nama: 'Citra', status: 'IZIN' }),
      session({ guru_id: 'guru-3', guru_nama: 'Citra', penugasan_id: 'assignment-3', status: 'SAKIT' }),
    ]

    expect(aggregateTeacherAttendance(sessions, 'excused_not_penalized', 'performance_asc').map(row => row.guruNama)).toEqual(['Ani', 'Budi', 'Citra'])
    expect(aggregateTeacherAttendance(sessions, 'excused_not_penalized', 'alfa_desc').map(row => row.guruNama)).toEqual(['Ani', 'Budi', 'Citra'])
    expect(aggregateTeacherAttendance(sessions, 'excused_not_penalized', 'izin_desc').map(row => row.guruNama)).toEqual(['Citra', 'Ani', 'Budi'])
  })
})
