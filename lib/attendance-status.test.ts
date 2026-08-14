import { describe, expect, it } from 'vitest'
import {
  deriveDailyTeacherStatus,
  isWaliDecisionPendingStatus,
  resolveFinalAttendanceStatus,
  summarizePendingWaliDecisionDates,
} from './attendance-status'

function derive(statuses: Array<'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA'>, total = statuses.length, skipIncomplete = false) {
  return deriveDailyTeacherStatus({ totalBlocks: total, submittedStatuses: statuses, skipIncomplete })
}

describe('deriveDailyTeacherStatus', () => {
  it.each([
    [['HADIR', 'HADIR'], 'HADIR'],
    [['SAKIT', 'SAKIT'], 'SAKIT'],
    [['IZIN', 'IZIN'], 'IZIN'],
    [['ALFA', 'ALFA'], 'ALFA'],
  ] as const)('menetapkan status seragam %j menjadi %s', (statuses, expected) => {
    expect(derive([...statuses]).status).toBe(expected)
  })

  it.each([
    [['HADIR', 'SAKIT']],
    [['HADIR', 'IZIN']],
    [['SAKIT', 'IZIN']],
    [['ALFA', 'SAKIT']],
    [['ALFA', 'IZIN']],
    [['HADIR', 'SAKIT', 'IZIN']],
  ] as const)('meminta keputusan wali untuk status campuran %j', (statuses) => {
    const result = derive([...statuses])
    expect(result.status).toBe('PERLU_KONFIRMASI_WALI')
    expect(result.requiresWaliDecision).toBe(true)
  })

  it('menetapkan hadir dan alfa sebagai parsial', () => {
    expect(derive(['HADIR', 'ALFA']).status).toBe('PARSIAL')
  })

  it('membedakan belum ada input dari belum lengkap', () => {
    expect(derive([], 3).status).toBe('BELUM_ADA_INPUT')
    expect(derive(['HADIR'], 3).status).toBe('BELUM_ADA_DATA')
  })

  it('menggunakan hanya blok tersubmit saat pengaturan abaikan blok aktif', () => {
    const result = derive(['HADIR', 'SAKIT'], 4, true)
    expect(result.status).toBe('PERLU_KONFIRMASI_WALI')
    expect(result.submittedBlocks).toBe(2)
    expect(result.pendingBlocks).toBe(2)
  })

  it('tidak menganggap hadir+sakit atau hadir+izin sebagai hadir meski blok belum lengkap diabaikan', () => {
    expect(derive(['HADIR', 'SAKIT'], 5, true).status).toBe('PERLU_KONFIRMASI_WALI')
    expect(derive(['HADIR', 'IZIN'], 5, true).status).toBe('PERLU_KONFIRMASI_WALI')
  })
})

describe('resolveFinalAttendanceStatus', () => {
  it.each(['HADIR', 'SAKIT', 'IZIN', 'ALFA'] as const)('menerapkan keputusan wali %s', waliStatus => {
    expect(resolveFinalAttendanceStatus({ teacherStatus: 'PERLU_KONFIRMASI_WALI', waliStatus })).toEqual({
      status: waliStatus,
      source: 'koreksi_wali_kelas',
    })
  })

  it('mengikuti guru kembali setelah koreksi wali dihapus', () => {
    expect(resolveFinalAttendanceStatus({ teacherStatus: 'PERLU_KONFIRMASI_WALI', waliStatus: null })).toEqual({
      status: 'PERLU_KONFIRMASI_WALI',
      source: 'perlu_konfirmasi_wali',
    })
  })

  it('memprioritaskan izin sekolah sehari penuh di atas keputusan wali', () => {
    expect(resolveFinalAttendanceStatus({ teacherStatus: 'ALFA', waliStatus: 'ALFA', fullDaySchoolPermission: true })).toEqual({
      status: 'HADIR',
      source: 'perizinan_sekolah',
    })
  })
})

describe('isWaliDecisionPendingStatus', () => {
  it.each(['PERLU_KONFIRMASI_WALI', 'PARSIAL', 'BELUM_ADA_INPUT', 'BELUM_ADA_DATA', 'ALFA'])('menandai %s sebagai tertunda', status => {
    expect(isWaliDecisionPendingStatus(status)).toBe(true)
  })

  it.each(['HADIR', 'SAKIT', 'IZIN', null, undefined])('tidak menandai %s sebagai tertunda', status => {
    expect(isWaliDecisionPendingStatus(status)).toBe(false)
  })
})

describe('summarizePendingWaliDecisionDates', () => {
  it('mengelompokkan siswa tertunda per tanggal dan menghapus duplikasi siswa', () => {
    expect(summarizePendingWaliDecisionDates([
      { siswa_id: 's1', tanggal: '2026-08-12', status_akhir: 'ALFA', wali_status: null },
      { siswa_id: 's1', tanggal: '2026-08-12', status_akhir: 'ALFA', wali_status: null },
      { siswa_id: 's2', tanggal: '2026-08-12', status_akhir: 'PARSIAL', wali_status: null },
      { siswa_id: 's3', tanggal: '2026-08-13', status_akhir: 'BELUM_ADA_DATA', wali_status: null },
      { siswa_id: 's4', tanggal: '2026-08-13', status_akhir: 'ALFA', wali_status: 'HADIR' },
    ])).toEqual([
      { tanggal: '2026-08-12', pendingStudents: 2 },
      { tanggal: '2026-08-13', pendingStudents: 1 },
    ])
  })

  it('mengembalikan daftar kosong jika semua status sudah diputuskan atau tidak membutuhkan keputusan', () => {
    expect(summarizePendingWaliDecisionDates([
      { siswa_id: 's1', tanggal: '2026-08-12', status_akhir: 'HADIR', wali_status: null },
      { siswa_id: 's2', tanggal: '2026-08-12', status_akhir: 'ALFA', wali_status: 'ALFA' },
    ])).toEqual([])
  })
})
