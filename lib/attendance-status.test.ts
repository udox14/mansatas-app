import { describe, expect, it } from 'vitest'
import {
  deriveDailyTeacherStatus,
  dailyAttendanceClock,
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
    [['HADIR', 'HADIR', 'ALFA'], 'ALFA'],
    [['ALFA', 'SAKIT', 'IZIN', 'HADIR'], 'ALFA'],
    [['HADIR', 'SAKIT', 'IZIN'], 'SAKIT'],
    [['HADIR', 'IZIN'], 'IZIN'],
    [['HADIR', 'HADIR'], 'HADIR'],
  ] as const)('prioritas harian %j menjadi %s', (statuses, expected) => {
    expect(derive([...statuses])).toMatchObject({ status: expected, requiresWaliDecision: false })
  })

  it('memeriksa seluruh kombinasi dan urutan tiga blok', () => {
    const order = ['ALFA', 'SAKIT', 'IZIN', 'HADIR'] as const
    for (const a of order) for (const b of order) for (const c of order) {
      const statuses = [a, b, c]
      const result = derive(statuses)
      expect(result.status).toBe(order.find(item => statuses.includes(item)))
      expect(result.requiresWaliDecision).toBe(false)
    }
  })

  it('menunggu akhir KBM sekalipun input lengkap atau opsi lama aktif', () => {
    expect(deriveDailyTeacherStatus({ totalBlocks: 2, submittedStatuses: ['ALFA', 'HADIR'], dayEnded: false, skipIncomplete: true }))
      .toMatchObject({ status: 'BELUM_ADA_DATA', submittedBlocks: 2 })
  })

  it('setelah akhir KBM memakai data tersedia tanpa menganggap blok kosong hadir/alfa', () => {
    expect(deriveDailyTeacherStatus({ totalBlocks: 4, submittedStatuses: ['ALFA'], dayEnded: true }))
      .toMatchObject({ status: 'ALFA', pendingBlocks: 3 })
    expect(derive([], 4).status).toBe('BELUM_ADA_INPUT')
    expect(derive(['HADIR'], 4).status).toBe('HADIR')
    expect(derive([], 0).status).toBe('BELUM_ADA_DATA')
  })

  it('meminta melengkapi jam jika waktu akhir belum tersedia', () => {
    expect(deriveDailyTeacherStatus({ totalBlocks: 2, submittedStatuses: ['HADIR'], dayEnded: false, missingEndTime: true }).reason)
      .toContain('Jam pelajaran perlu dilengkapi')
  })

  it('izin resmi tetap hadir walaupun seluruh input guru izin; sakit tetap sakit', () => {
    expect(resolveStudentPermissionDailyStatus(['IZIN', 'IZIN'])).toBe('HADIR')
    expect(normalizeDailyTeacherBlockStatus('IZIN', true)).toBe('HADIR')
    expect(normalizeDailyTeacherBlockStatus('IZIN')).toBe('IZIN')
    expect(normalizeDailyTeacherBlockStatus('SAKIT', true, 'SAKIT')).toBe('SAKIT')
    expect(studentPermissionStatusFromReason('SAKIT (DI UKS)')).toBe('SAKIT')
  })
})

describe('dailyAttendanceClock', () => {
  it.each([
    ['2026-10-02T04:59:59Z', false],
    ['2026-10-02T05:00:00Z', true],
    ['2026-10-02T05:00:01Z', true],
  ])('batas akhir pukul 12 WIB pada %s', (instant, ended) => {
    expect(dailyAttendanceClock('2026-10-02', '12:00', new Date(instant))).toMatchObject({ ended, kbmEndAt: '2026-10-02T12:00:00+07:00' })
  })
  it('tanggal lampau selesai tanpa jam; hari ini tanpa jam tetap sementara; tanggal depan belum selesai', () => {
    const now = new Date('2026-10-02T00:01:00Z')
    expect(dailyAttendanceClock('2026-10-01', null, now).ended).toBe(true)
    expect(dailyAttendanceClock('2026-10-02', null, now)).toMatchObject({ ended: false, missingEndTime: true })
    expect(dailyAttendanceClock('2026-10-02', '99:00', now).ended).toBe(false)
    expect(dailyAttendanceClock('2026-10-03', '00:00', now).ended).toBe(false)
    expect(dailyAttendanceClock('2026-10-02', null, new Date('2026-10-01T17:01:00Z')).ended).toBe(false)
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

  it('menghitung izin resmi sehari penuh sebagai hadir', () => {
    expect(resolveFinalAttendanceStatus({ teacherStatus: 'BELUM_ADA_DATA', fullDayStudentPermissionStatus: 'IZIN' })).toEqual({
      status: 'HADIR',
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
