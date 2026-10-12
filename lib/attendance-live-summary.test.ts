import { describe, expect, it } from 'vitest'
import { liveAttendanceSummary } from './attendance-live-summary'

const slots = [1, 2, 3, 4, 5].map(id => ({ id, nama: `Jam ${id}`, mulai: `${String(id + 6).padStart(2, '0')}:00`, selesai: `${String(id + 7).padStart(2, '0')}:00` }))
const now = new Date('2026-10-12T10:15:00+07:00')
const cell = (jam_ke: number, status: string, teacher_submitted = true) => ({ jam_ke, status, teacher_submitted })

describe('kehadiran saat ini per kelas', () => {
  it('falls back from unsubmitted hour 4 to hour 3 and excludes future hour 5', () => {
    const result = liveAttendanceSummary('2026-10-12', slots, [
      { cells: [cell(3, 'HADIR'), cell(4, 'BELUM_ADA_INPUT', false), cell(5, 'ALFA')] },
      { cells: [cell(3, 'SAKIT'), cell(4, 'BELUM_ADA_INPUT', false), cell(5, 'ALFA')] },
    ], now)
    expect(result).toMatchObject({ jam_acuan: 3, hadir: 1, sakit: 1, alfa: 0 })
  })
  it('uses hour 4 once submitted, without counting a student twice', () => {
    expect(liveAttendanceSummary('2026-10-12', slots, [{ cells: [cell(3, 'HADIR'), cell(4, 'ALFA')] }], now))
      .toMatchObject({ jam_acuan: 4, hadir: 0, alfa: 1 })
  })
  it('keeps missing student data unknown at the shared reference hour', () => {
    expect(liveAttendanceSummary('2026-10-12', slots, [
      { cells: [cell(4, 'HADIR')] }, { cells: [cell(3, 'HADIR'), cell(4, 'BELUM_ADA_INPUT', false)] },
    ], now)).toMatchObject({ jam_acuan: 4, hadir: 1, belum_ada_input: 1 })
  })
  it('does not treat permissions alone as a class attendance submission', () => {
    expect(liveAttendanceSummary('2026-10-12', slots, [{ cells: [cell(4, 'IZIN', false)] }], now))
      .toMatchObject({ jam_acuan: null, hadir: 0, belum_ada_input: 1 })
  })
  it('shows no attendance before school starts or for future dates', () => {
    const rows = [{ cells: [cell(1, 'HADIR')] }]
    expect(liveAttendanceSummary('2026-10-12', slots, rows, new Date('2026-10-12T06:00:00+07:00')).jam_acuan).toBeNull()
    expect(liveAttendanceSummary('2026-10-13', slots, rows, now).jam_acuan).toBeNull()
  })
  it('can show the last submitted hour on a past date', () => {
    expect(liveAttendanceSummary('2026-10-11', slots, [{ cells: [cell(5, 'HADIR')] }], now))
      .toMatchObject({ jam_acuan: 5, hadir: 1 })
  })
})
