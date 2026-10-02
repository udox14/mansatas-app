import { describe, expect, it } from 'vitest'
import { isDailyNonAttendance, summarizeKelasBinaanAttendance } from './kelas-binaan-attendance'
import type { FinalAttendanceDetail } from './wali-kelas-attendance'

function row(status: FinalAttendanceDetail['status_akhir'], final = true, blocks: FinalAttendanceDetail['block_statuses'] = []) {
  return { status_akhir: status, is_daily_final: final, block_statuses: blocks }
}

describe('Kelas Binaan daily summary', () => {
  it('counts only finalized attendance, keeping empty and provisional input separate', () => {
    const summary = summarizeKelasBinaanAttendance([
      row('HADIR'), row('SAKIT'), row('IZIN'), row('ALFA'),
      row('BELUM_ADA_INPUT', false), row('BELUM_ADA_DATA', false), row('ALFA', false), undefined,
    ])
    expect(summary).toEqual({ hadir: 1, sakit: 1, izin: 1, alfa: 1, sementara: 2, belumAdaInput: 1, pendingBlocks: 0, finalCount: 4 })
  })

  it.each(['SAKIT', 'IZIN', 'ALFA'] as const)('counts %s as nonattendance only after finalization', status => {
    expect(isDailyNonAttendance(row(status))).toBe(true)
    expect(isDailyNonAttendance(row(status, false))).toBe(false)
  })

  it('does not turn missing input, old pending statuses, or absent rows into nonattendance', () => {
    for (const status of ['HADIR', 'BELUM_ADA_INPUT', 'BELUM_ADA_DATA', 'PARSIAL', 'PERLU_KONFIRMASI_WALI'] as const) {
      expect(isDailyNonAttendance(row(status))).toBe(false)
    }
    expect(isDailyNonAttendance(null)).toBe(false)
    expect(summarizeKelasBinaanAttendance([]).finalCount).toBe(0)
  })

  it('counts pending lesson blocks once across students, keeping split sessions distinct', () => {
    const block = { penugasan_id: 'mapel', status: 'BELUM_ADA_INPUT' as const, submitted: false, jam_ke_mulai: 1, jam_ke_selesai: 2 }
    const summary = summarizeKelasBinaanAttendance([
      row('ALFA', true, [block]),
      row('HADIR', true, [block, { ...block, jam_ke_mulai: 4, jam_ke_selesai: 4 }, { ...block, penugasan_id: 'lain', submitted: true }]),
    ])
    expect(summary.pendingBlocks).toBe(2)
    expect(summary.alfa).toBe(1)
    expect(summary.hadir).toBe(1)
  })
})
