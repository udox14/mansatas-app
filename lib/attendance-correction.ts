import type { FinalAttendanceStatus, SubmittedBlockStatus } from './attendance-status'

export type AttendanceAlfaBlock = {
  assignment: string
  from: number
  to: number
  mapel: string
  teacher: string | null
  note: string
  updatedAt: string | null
}

export type AttendanceCorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'STALE'
export type ProposedAttendanceStatus = Exclude<SubmittedBlockStatus, 'ALFA'>

export function isProposedAttendanceStatus(status: unknown): status is ProposedAttendanceStatus {
  return status === 'HADIR' || status === 'SAKIT' || status === 'IZIN'
}

export function canReviewAttendanceCorrection(roles: string[], position?: string | null) {
  return roles.includes('super_admin') || roles.includes('kepsek') ||
    (roles.includes('wakamad') && isAttendanceReviewPosition(position))
}

export function isAttendanceReviewPosition(position?: string | null) {
  return position === 'jbt_waka_kesiswaan' || position === 'jbt_waka_kurikulum'
}

export function canDecideAttendanceCorrection(roles: string[], actorId: string, requesterId: string, decision: 'APPROVED' | 'REJECTED') {
  return decision === 'REJECTED' || actorId !== requesterId || roles.includes('super_admin')
}

export function attendanceAlfaKey(blocks: AttendanceAlfaBlock[]) {
  return JSON.stringify(blocks.map(block => JSON.stringify([
    block.assignment, block.from, block.to, block.updatedAt, block.note,
  ])).sort())
}

export function effectiveWaliCorrection<T extends {
  status: SubmittedBlockStatus
  policyVersion: number
  approvalId?: string | null
  approvedAlfaKey?: string | null
}>(record: T | undefined, baseline: FinalAttendanceStatus, alfaBlocks: AttendanceAlfaBlock[]): T | null {
  if (!record) return null
  if (record.policyVersion === 0) {
    return record.status === 'HADIR' && ['ALFA', 'SAKIT', 'IZIN'].includes(baseline) ? null : record
  }
  if (record.approvalId) {
    return alfaBlocks.length && record.approvedAlfaKey === attendanceAlfaKey(alfaBlocks) ? record : null
  }
  return alfaBlocks.length && isProposedAttendanceStatus(record.status) ? null : record
}

export const ATTENDANCE_CORRECTION_LABEL: Record<AttendanceCorrectionStatus, string> = {
  PENDING: 'Menunggu persetujuan',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  STALE: 'Data absensi berubah',
}
