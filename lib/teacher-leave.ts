export type TeacherLeaveReason = {
  id: string
  nama: string
  kepentingan_sekolah: boolean
  aktif: boolean
}

export type TeacherLeaveMetadata = {
  alasan_izin_guru_id?: string | null
  alasan_izin_guru_nama?: string | null
  kepentingan_sekolah?: boolean
}

export function isSchoolLeave(status: string, metadata: TeacherLeaveMetadata): boolean {
  return status === 'IZIN' && metadata.kepentingan_sekolah === true
}

export function teacherPerformance(counts: {
  total: number; hadir: number; sakit: number; izin: number; izinSekolah?: number
}, includeOrdinaryExcused = false): number {
  if (counts.total <= 0) return 0
  const credit = counts.hadir + (includeOrdinaryExcused
    ? counts.sakit + counts.izin
    : counts.izinSekolah || 0)
  return Math.min(100, Math.max(0, Math.round(credit / counts.total * 100)))
}

export function teacherLeaveLabel(status: string, metadata: TeacherLeaveMetadata): string {
  return isSchoolLeave(status, metadata) ? 'Izin — Kepentingan Sekolah' : status === 'IZIN' ? 'Izin biasa' : status
}
