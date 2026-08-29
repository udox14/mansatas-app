import { describe, expect, it } from 'vitest'
import {
  deriveDailyTeacherStatus,
  isWaliDecisionPendingStatus,
  normalizeDailyTeacherBlockStatus,
  resolveFinalAttendanceStatus,
  resolveStudentPermissionDailyStatus,
  studentPermissionStatusFromReason,
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
    [['HADIR', 'ALFA']],
    [['SAKIT', 'IZIN']],
    [['ALFA', 'SAKIT']],
    [['ALFA', 'IZIN']],
    [['HADIR', 'SAKIT', 'IZIN']],
  ] as const)('meminta keputusan wali untuk status campuran yang seri %j', (statuses) => {
    const result = derive([...statuses])
    expect(result.status).toBe('PERLU_KONFIRMASI_WALI')
    expect(result.requiresWaliDecision).toBe(true)
  })

  it.each([
    [['ALFA', 'ALFA', 'ALFA', 'HADIR'], 'ALFA'],
    [['HADIR', 'HADIR', 'HADIR', 'SAKIT'], 'HADIR'],
    [['SAKIT', 'SAKIT', 'SAKIT', 'ALFA'], 'SAKIT'],
    [['IZIN', 'IZIN', 'IZIN', 'HADIR'], 'IZIN'],
  ] as const)('menetapkan status mayoritas %j menjadi %s tanpa keputusan wali', (statuses, expected) => {
    const result = derive([...statuses])
    expect(result).toMatchObject({ status: expected, requiresWaliDecision: false })
    expect(result.reason).toContain('paling banyak')
  })

  it('menetapkan alfa seragam tanpa keputusan wali', () => {
    expect(derive(['ALFA', 'ALFA'])).toMatchObject({ status: 'ALFA', requiresWaliDecision: false })
  })

  it('membedakan belum ada input dari belum lengkap', () => {
    expect(derive([], 3)).toMatchObject({ status: 'BELUM_ADA_INPUT', requiresWaliDecision: false })
    expect(derive(['HADIR'], 3)).toMatchObject({ status: 'BELUM_ADA_DATA', requiresWaliDecision: false })
  })

  it('menggunakan hanya blok tersubmit saat pengaturan abaikan blok aktif', () => {
    const result = derive(['HADIR', 'SAKIT'], 4, true)
    expect(result.status).toBe('PERLU_KONFIRMASI_WALI')
    expect(result.submittedBlocks).toBe(2)
    expect(result.pendingBlocks).toBe(2)
  })

  it('menganggap izin parsial dari Perizinan Siswa sebagai hadir saat agregasi harian', () => {
    const result = derive([
      normalizeDailyTeacherBlockStatus('IZIN', true, 'HADIR'),
      normalizeDailyTeacherBlockStatus('HADIR'),
    ])
    expect(result).toMatchObject({
      status: 'HADIR',
      requiresWaliDecision: false,
    })
  })

  it('menganggap izin siswa dan izin guru sebagai izin harian', () => {
    const permissionStatus = resolveStudentPermissionDailyStatus(['IZIN', 'IZIN', 'IZIN'])
    const result = derive([
      normalizeDailyTeacherBlockStatus('IZIN', true, permissionStatus),
      normalizeDailyTeacherBlockStatus('IZIN'),
      normalizeDailyTeacherBlockStatus('IZIN'),
      normalizeDailyTeacherBlockStatus('IZIN'),
    ])
    expect(result).toMatchObject({ status: 'IZIN', requiresWaliDecision: false })
  })

  it('tetap memakai hadir untuk izin siswa jika blok guru tidak seluruhnya izin', () => {
    expect(resolveStudentPermissionDailyStatus(['HADIR', 'IZIN'])).toBe('HADIR')
  })

  it('tetap mempertahankan izin guru sebagai izin biasa', () => {
    expect(normalizeDailyTeacherBlockStatus('IZIN')).toBe('IZIN')
  })

  it('memetakan alasan sakit dari Perizinan Siswa menjadi status sakit', () => {
    expect(studentPermissionStatusFromReason('SAKIT DI UKS')).toBe('SAKIT')
    expect(studentPermissionStatusFromReason('SAKIT (DI UKS)')).toBe('SAKIT')
    expect(studentPermissionStatusFromReason('SAKIT (PULANG)')).toBe('SAKIT')
    expect(studentPermissionStatusFromReason('KEGIATAN DI LUAR')).toBe('IZIN')
  })

  it('mengagregasikan izin siswa dengan alasan sakit sebagai sakit', () => {
    const result = derive([
      normalizeDailyTeacherBlockStatus('IZIN', true, 'SAKIT'),
      normalizeDailyTeacherBlockStatus('SAKIT'),
    ])
    expect(result).toMatchObject({ status: 'SAKIT', requiresWaliDecision: false })
  })

  it('menggunakan aturan mayoritas dari blok tersubmit saat blok belum lengkap diabaikan', () => {
    expect(derive(['HADIR', 'SAKIT'], 5, true).status).toBe('PERLU_KONFIRMASI_WALI')
    expect(derive(['HADIR', 'HADIR', 'IZIN'], 5, true)).toMatchObject({ status: 'HADIR', requiresWaliDecision: false })
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

  it('menetapkan status sakit dari Perizinan Siswa jika mencakup sehari penuh', () => {
    expect(resolveFinalAttendanceStatus({ teacherStatus: 'BELUM_ADA_DATA', fullDayStudentPermissionStatus: 'SAKIT' })).toEqual({
      status: 'SAKIT',
      source: 'perizinan_siswa',
    })
  })

  it('menetapkan izin dari modul Perizinan Siswa jika mencakup sehari penuh', () => {
    expect(resolveFinalAttendanceStatus({ teacherStatus: 'BELUM_ADA_DATA', fullDayStudentPermissionStatus: 'IZIN' })).toEqual({
      status: 'IZIN',
      source: 'perizinan_siswa',
    })
  })

  it('tidak mengubah izin parsial menjadi izin sehari penuh', () => {
    expect(resolveFinalAttendanceStatus({ teacherStatus: 'HADIR' })).toEqual({
      status: 'HADIR',
      source: 'guru',
    })
  })
})

describe('isWaliDecisionPendingStatus', () => {
  it.each(['PERLU_KONFIRMASI_WALI', 'PARSIAL'])('menandai %s sebagai tertunda', status => {
    expect(isWaliDecisionPendingStatus(status)).toBe(true)
  })

  it.each(['HADIR', 'SAKIT', 'IZIN', 'ALFA', 'BELUM_ADA_INPUT', 'BELUM_ADA_DATA', null, undefined])('tidak menandai %s sebagai tertunda', status => {
    expect(isWaliDecisionPendingStatus(status)).toBe(false)
  })
})

describe('summarizePendingWaliDecisionDates', () => {
  it('mengelompokkan siswa tertunda per tanggal dan menghapus duplikasi siswa', () => {
    expect(summarizePendingWaliDecisionDates([
      { siswa_id: 's1', tanggal: '2026-08-12', status_akhir: 'PARSIAL', wali_status: null },
      { siswa_id: 's1', tanggal: '2026-08-12', status_akhir: 'PARSIAL', wali_status: null },
      { siswa_id: 's2', tanggal: '2026-08-12', status_akhir: 'PARSIAL', wali_status: null },
      { siswa_id: 's3', tanggal: '2026-08-13', status_akhir: 'BELUM_ADA_DATA', wali_status: null },
      { siswa_id: 's5', tanggal: '2026-08-13', status_akhir: 'BELUM_ADA_INPUT', wali_status: null },
      { siswa_id: 's4', tanggal: '2026-08-13', status_akhir: 'PARSIAL', wali_status: 'HADIR' },
    ])).toEqual([
      { tanggal: '2026-08-12', pendingStudents: 2 },
    ])
  })

  it('mengembalikan daftar kosong jika semua status sudah diputuskan atau tidak membutuhkan keputusan', () => {
    expect(summarizePendingWaliDecisionDates([
      { siswa_id: 's1', tanggal: '2026-08-12', status_akhir: 'HADIR', wali_status: null },
      { siswa_id: 's2', tanggal: '2026-08-12', status_akhir: 'PARSIAL', wali_status: 'ALFA' },
    ])).toEqual([])
  })
})
