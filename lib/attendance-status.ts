export type FinalAttendanceStatus =
  | 'HADIR'
  | 'SAKIT'
  | 'IZIN'
  | 'ALFA'
  | 'PARSIAL'
  | 'PERLU_KONFIRMASI_WALI'
  | 'BELUM_ADA_INPUT'
  | 'BELUM_ADA_DATA'

export type FinalAttendanceSource =
  | 'guru'
  | 'wali_kelas'
  | 'koreksi_wali_kelas'
  | 'perizinan_siswa'
  | 'perizinan_sekolah'
  | 'perlu_konfirmasi_wali'
  | 'belum_ada_input'
  | 'belum_ada_data'

export type SubmittedBlockStatus = 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA'
export type StudentPermissionStatus = 'SAKIT' | 'IZIN'

export const ATTENDANCE_STATUS_META: Record<FinalAttendanceStatus, {
  label: string
  code: string
}> = {
  HADIR: { label: 'Hadir', code: 'H' },
  SAKIT: { label: 'Sakit', code: 'S' },
  IZIN: { label: 'Izin', code: 'I' },
  ALFA: { label: 'Alfa', code: 'A' },
  PARSIAL: { label: 'Bolos', code: 'B' },
  PERLU_KONFIRMASI_WALI: { label: 'Perlu keputusan wali', code: 'K' },
  BELUM_ADA_INPUT: { label: 'Belum ada input', code: 'BI' },
  BELUM_ADA_DATA: { label: 'Belum lengkap', code: 'BL' },
}

export const ATTENDANCE_SOURCE_LABELS: Record<FinalAttendanceSource, string> = {
  guru: 'Guru',
  wali_kelas: 'Wali Kelas',
  koreksi_wali_kelas: 'Koreksi Wali',
  perizinan_siswa: 'Perizinan Siswa',
  perizinan_sekolah: 'Perizinan Sekolah',
  perlu_konfirmasi_wali: 'Perlu Keputusan Wali',
  belum_ada_input: 'Belum Ada Input',
  belum_ada_data: 'Belum Lengkap',
}

export function attendanceStatusLabel(status: string | null | undefined) {
  if (!status) return ATTENDANCE_STATUS_META.BELUM_ADA_DATA.label
  const normalized = status === 'BOLOS'
    ? 'PARSIAL'
    : status === 'PERLU KONFIRMASI WALI'
      ? 'PERLU_KONFIRMASI_WALI'
      : status === 'BELUM ADA INPUT'
        ? 'BELUM_ADA_INPUT'
        : status as FinalAttendanceStatus
  return ATTENDANCE_STATUS_META[normalized]?.label || status
}

export function isWaliDecisionPendingStatus(status: string | null | undefined) {
  if (!status) return false
  const normalized = status === 'BOLOS'
    ? 'PARSIAL'
    : status === 'PERLU KONFIRMASI WALI'
      ? 'PERLU_KONFIRMASI_WALI'
      : status === 'BELUM ADA INPUT'
        ? 'BELUM_ADA_INPUT'
        : status === 'BELUM ADA DATA'
          ? 'BELUM_ADA_DATA'
          : status
  return ['PERLU_KONFIRMASI_WALI', 'PARSIAL'].includes(normalized)
}

/**
 * Normalisasi status izin siswa untuk agregasi harian.
 * Detail blok tetap menyimpan status sumbernya (IZIN atau SAKIT).
 */
export function normalizeDailyTeacherBlockStatus(
  status: SubmittedBlockStatus,
  fromStudentPermission = false,
  studentPermissionStatus: SubmittedBlockStatus = 'HADIR',
): SubmittedBlockStatus {
  return fromStudentPermission ? studentPermissionStatus : status
}

export function resolveStudentPermissionDailyStatus(
  teacherStatuses: SubmittedBlockStatus[],
): SubmittedBlockStatus {
  return teacherStatuses.length > 0 && teacherStatuses.every(status => status === 'IZIN')
    ? 'IZIN'
    : 'HADIR'
}

export function studentPermissionStatusFromReason(
  alasan: string | null | undefined,
): StudentPermissionStatus {
  const normalized = String(alasan || '').trim().toUpperCase().replace(/\s+/g, ' ')
  return [
    'SAKIT DI UKS',
    'SAKIT (DI UKS)',
    'SAKIT PULANG',
    'SAKIT (PULANG)',
  ].includes(normalized)
    ? 'SAKIT'
    : 'IZIN'
}

export type PendingWaliDecisionDate = {
  tanggal: string
  pendingStudents: number
}

export function summarizePendingWaliDecisionDates(
  rows: Array<{
    siswa_id: string
    tanggal: string
    status_akhir: string | null | undefined
    wali_status: string | null | undefined
  }>,
): PendingWaliDecisionDate[] {
  const pendingStudentIdsByDate = new Map<string, Set<string>>()
  for (const row of rows) {
    if (row.wali_status || !isWaliDecisionPendingStatus(row.status_akhir)) continue
    if (!pendingStudentIdsByDate.has(row.tanggal)) pendingStudentIdsByDate.set(row.tanggal, new Set())
    pendingStudentIdsByDate.get(row.tanggal)!.add(row.siswa_id)
  }

  return Array.from(pendingStudentIdsByDate.entries())
    .map(([tanggal, siswaIds]) => ({ tanggal, pendingStudents: siswaIds.size }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
}

export function attendanceStatusCode(status: string | null | undefined) {
  if (!status) return ATTENDANCE_STATUS_META.BELUM_ADA_DATA.code
  const normalized = status === 'BOLOS'
    ? 'PARSIAL'
    : status === 'PERLU KONFIRMASI WALI'
      ? 'PERLU_KONFIRMASI_WALI'
      : status === 'BELUM ADA INPUT'
        ? 'BELUM_ADA_INPUT'
        : status as FinalAttendanceStatus
  return ATTENDANCE_STATUS_META[normalized]?.code || String(status)
}

export function attendanceSourceLabel(source: string | null | undefined) {
  return ATTENDANCE_SOURCE_LABELS[source as FinalAttendanceSource] || 'Belum Lengkap'
}

export function resolveFinalAttendanceStatus(input: {
  teacherStatus: FinalAttendanceStatus
  waliStatus?: SubmittedBlockStatus | null
  fullDaySchoolPermission?: boolean
  fullDayStudentPermissionStatus?: StudentPermissionStatus
}): { status: FinalAttendanceStatus; source: FinalAttendanceSource } {
  if (input.fullDaySchoolPermission) return { status: 'HADIR', source: 'perizinan_sekolah' }
  if (input.waliStatus) {
    return {
      status: input.waliStatus,
      source: ['HADIR', 'BELUM_ADA_DATA', 'BELUM_ADA_INPUT'].includes(input.teacherStatus)
        ? 'wali_kelas'
        : 'koreksi_wali_kelas',
    }
  }
  if (input.fullDayStudentPermissionStatus) {
    return { status: input.fullDayStudentPermissionStatus, source: 'perizinan_siswa' }
  }
  if (input.teacherStatus === 'BELUM_ADA_INPUT') return { status: input.teacherStatus, source: 'belum_ada_input' }
  if (input.teacherStatus === 'BELUM_ADA_DATA') return { status: input.teacherStatus, source: 'belum_ada_data' }
  if (input.teacherStatus === 'PERLU_KONFIRMASI_WALI') return { status: input.teacherStatus, source: 'perlu_konfirmasi_wali' }
  return { status: input.teacherStatus, source: 'guru' }
}

export type DailyTeacherStatusResult = {
  status: FinalAttendanceStatus
  submittedBlocks: number
  pendingBlocks: number
  requiresWaliDecision: boolean
  reason: string
}

function statusNames(statuses: SubmittedBlockStatus[]) {
  const unique = Array.from(new Set(statuses))
  return unique.map(status => ATTENDANCE_STATUS_META[status].label).join(' dan ')
}

export function deriveDailyTeacherStatus(input: {
  totalBlocks: number
  submittedStatuses: SubmittedBlockStatus[]
  skipIncomplete: boolean
}): DailyTeacherStatusResult {
  const totalBlocks = Math.max(0, input.totalBlocks)
  const submittedBlocks = Math.min(totalBlocks, input.submittedStatuses.length)
  const pendingBlocks = Math.max(0, totalBlocks - submittedBlocks)

  if (totalBlocks === 0) {
    return {
      status: 'BELUM_ADA_DATA',
      submittedBlocks: 0,
      pendingBlocks: 0,
      requiresWaliDecision: false,
      reason: 'Tidak ada blok KBM aktif.',
    }
  }

  if (submittedBlocks === 0) {
    return {
      status: 'BELUM_ADA_INPUT',
      submittedBlocks,
      pendingBlocks,
      requiresWaliDecision: false,
      reason: `0/${totalBlocks} blok disubmit; belum ada input guru.`,
    }
  }

  if (pendingBlocks > 0 && !input.skipIncomplete) {
    return {
      status: 'BELUM_ADA_DATA',
      submittedBlocks,
      pendingBlocks,
      requiresWaliDecision: false,
      reason: `${submittedBlocks}/${totalBlocks} blok disubmit; ${pendingBlocks} blok belum lengkap.`,
    }
  }

  const considered = input.submittedStatuses.slice(0, submittedBlocks)
  const unique = Array.from(new Set(considered))
  let status: FinalAttendanceStatus

  if (unique.length === 1) {
    status = unique[0]
  } else if (unique.length === 2 && unique.includes('HADIR') && unique.includes('IZIN')) {
    // Izin pada sebagian jam tidak mengubah kehadiran harian. Rinciannya tetap
    // tersimpan di detail absensi/catatan guru, tanpa membebani wali kelas.
    status = 'HADIR'
  } else if (unique.length === 2 && unique.includes('HADIR') && unique.includes('ALFA')) {
    status = 'PARSIAL'
  } else {
    status = 'PERLU_KONFIRMASI_WALI'
  }

  const suffix = pendingBlocks > 0
    ? ` ${submittedBlocks}/${totalBlocks} blok disubmit; ${pendingBlocks} blok diabaikan sesuai pengaturan.`
    : ''
  const reason = status === 'PERLU_KONFIRMASI_WALI'
    ? `Terdapat perbedaan status ${statusNames(considered)}; perlu keputusan wali kelas.${suffix}`
    : status === 'PARSIAL'
      ? `Terdapat kombinasi Hadir dan Alfa dalam satu hari.${suffix}`
      : unique.length === 2 && unique.includes('HADIR') && unique.includes('IZIN')
        ? `Terdapat izin pada sebagian blok KBM; kehadiran harian dihitung Hadir dan rincian izin tetap dicatat.${suffix}`
      : `Semua blok yang diperhitungkan berstatus ${ATTENDANCE_STATUS_META[status].label}.${suffix}`

  return {
    status,
    submittedBlocks,
    pendingBlocks,
    requiresWaliDecision: status === 'PARSIAL' || status === 'PERLU_KONFIRMASI_WALI',
    reason,
  }
}
