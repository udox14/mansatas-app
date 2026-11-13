'use server'

import { canCoverWaliClass } from '@/lib/teacher-leave-period'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getAttendanceCorrectionReviewer } from '@/lib/attendance-correction-reviewer'
import { formatNamaKelas } from '@/lib/utils'
import { todayWIB } from '@/lib/time'
import { invalidateAttendanceCache } from '@/lib/attendance-cache'
import {
  attendanceAlfaKey, canDecideAttendanceCorrection, isProposedAttendanceStatus,
  type AttendanceAlfaBlock, type AttendanceCorrectionStatus, type ProposedAttendanceStatus,
} from '@/lib/attendance-correction'
import { correctionAttendanceSnapshot, correctionSourceSql, readCorrectionSource } from '@/lib/attendance-correction-source'
import { flushAttendanceNotificationOutbox, flushNotificationOutbox, prepareAttendanceCorrectionResultNotice, prepareAttendanceCorrectionReviewNotice, prepareAttendanceNotificationWork } from '@/lib/notification-engine'
import type { FinalAttendanceDetail } from '@/lib/wali-kelas-attendance'

type RequestRow = {
  id: string; siswa_id: string; kelas_id: string; tahun_ajaran_id: string; tanggal: string
  previous_status: string; requested_status: ProposedAttendanceStatus; reason: string
  alfa_key: string; evidence_json: string; status: AttendanceCorrectionStatus
  requested_by: string; requested_at: string; reviewed_at: string | null; review_note: string | null
  siswa_nama: string; pengaju_nama: string; pemeriksa_nama: string | null
  tingkat: number; nomor_kelas: string; kelompok: string
}

type Evidence = {
  blocks: AttendanceAlfaBlock[]
  permissions: FinalAttendanceDetail['detail_guru']
}

const requestQuery = `SELECT r.*, s.nama_lengkap AS siswa_nama,
  r.requested_by_name AS pengaju_nama, r.reviewed_by_name AS pemeriksa_nama,
  k.tingkat, k.nomor_kelas, k.kelompok
  FROM attendance_correction_requests r
  JOIN siswa s ON s.id = r.siswa_id JOIN kelas k ON k.id = r.kelas_id`

function presentRequest(row: RequestRow) {
  const { blocks, permissions } = JSON.parse(row.evidence_json) as Evidence
  return {
    id: row.id, student: row.siswa_nama, kelas: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
    date: row.tanggal, previous: row.previous_status, proposed: row.requested_status, reason: row.reason,
    status: row.status, requester: row.pengaju_nama, requestedAt: row.requested_at,
    reviewer: row.pemeriksa_nama, reviewedAt: row.reviewed_at, reviewNote: row.review_note, blocks, permissions,
  }
}

async function requireCorrectionReviewerAccess() {
  const user = await getCurrentUser()
  if (!user) return null
  const db = await getDB()
  const reviewer = await getAttendanceCorrectionReviewer(db, user.id)
  return reviewer ? { db, user, ...reviewer } : null
}

async function requireCorrectionStudentAccess(siswaId: string, tanggal: string) {
  const user = await getCurrentUser()
  if (!user) return null
  const db = await getDB()
  const student = await db.prepare(`SELECT s.kelas_id, k.wali_kelas_id FROM siswa s JOIN kelas k ON k.id = s.kelas_id
    WHERE s.id = ? AND s.status = 'aktif'`).bind(siswaId)
    .first<{ kelas_id: string; wali_kelas_id: string }>()
  if (!student || (student.wali_kelas_id !== user.id && !(await canCoverWaliClass(db, user.id, student.kelas_id, tanggal)))) return null
  return { db, user, kelasId: student.kelas_id, waliId: student.wali_kelas_id }
}

function validDate(value: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > todayWIB()) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

export async function getStudentAttendanceCorrections(siswaId: string, tanggal: string) {
  if (!validDate(tanggal)) return { error: 'Akses ajuan tidak tersedia.' }
  const access = await requireCorrectionStudentAccess(siswaId, tanggal)
  if (!access) return { error: 'Akses ajuan tidak tersedia.' }
  const rows = await access.db.prepare(`SELECT id, requested_status AS proposed, reason, status, evidence_json
    FROM attendance_correction_requests WHERE siswa_id = ? AND tanggal = ? AND kelas_id = ?
    ORDER BY requested_at DESC, rowid DESC LIMIT 20`).bind(siswaId, tanggal, access.kelasId)
    .all<{ id: string; proposed: ProposedAttendanceStatus; reason: string; status: AttendanceCorrectionStatus; evidence_json: string }>()
  return { rows: (rows.results || []).map(({ evidence_json, ...row }) => ({ ...row, blocks: (JSON.parse(evidence_json) as Evidence).blocks })) }
}

export async function getOwnAttendanceCorrectionResult(id: string) {
  const user = await getCurrentUser()
  if (!user || typeof id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return null
  const db = await getDB()
  return db.prepare(`SELECT r.tanggal, r.requested_status AS proposed, r.status
    FROM attendance_correction_requests r
    JOIN "user" u ON u.id = r.requested_by AND COALESCE(u.banned, 0) = 0
    WHERE r.id = ? AND r.requested_by = ? AND r.status IN ('APPROVED', 'REJECTED')`).bind(id, user.id)
    .first<{ tanggal: string; proposed: ProposedAttendanceStatus; status: 'APPROVED' | 'REJECTED' }>()
}

export async function requestAttendanceCorrection(input: {
  siswaId: string; tanggal: string; status: ProposedAttendanceStatus; reason: string; alfaKey: string
}) {
  if (!input?.siswaId || !validDate(input.tanggal) || !isProposedAttendanceStatus(input.status) ||
      typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 2000) {
    return { error: 'Pilih status dan isi alasan koreksi (maksimal 2.000 karakter).' }
  }
  const access = await requireCorrectionStudentAccess(input.siswaId, input.tanggal)
  if (!access) return { error: 'Ajuan hanya dapat dikirim oleh wali kelas siswa.' }
  const { db, user, kelasId } = access
  const source = await readCorrectionSource(db, input.siswaId, input.tanggal)
  const snapshot = await correctionAttendanceSnapshot(db, kelasId, input.tanggal, [input.siswaId])
  const day = snapshot?.statusByStudent.get(input.siswaId)?.[0]
  const blocks = day?.alfa_blocks ?? []
  const key = attendanceAlfaKey(blocks)
  if (!snapshot?.tahunAjaranId || !day || !blocks.length || key !== input.alfaKey) {
    return { error: 'Data absensi berubah. Muat ulang sebelum mengajukan koreksi.' }
  }
  const evidence: Evidence = { blocks, permissions: day.detail_guru.filter(detail => detail.sumber === 'perizinan_siswa') }
  const requestId = crypto.randomUUID()
  const notice = await prepareAttendanceCorrectionReviewNotice(db, requestId, user.id)
  const statements = [
    db.prepare(`UPDATE attendance_correction_requests AS target SET status = 'STALE',
      reviewed_at = datetime('now'), review_note = 'Data Alfa berubah sejak ajuan dikirim.'
      WHERE siswa_id = ? AND tanggal = ? AND status = 'PENDING' AND (alfa_key <> ? OR kelas_id <> ?)
      AND ${correctionSourceSql} = ?`).bind(input.siswaId, input.tanggal, key, kelasId, source),
    db.prepare(`INSERT INTO attendance_correction_requests
      (id, siswa_id, kelas_id, tahun_ajaran_id, tanggal, previous_status, requested_status, reason, alfa_key, evidence_json,
        requested_by, requested_by_name)
      SELECT ?, target.siswa_id, ?, ?, target.tanggal, ?, ?, ?, ?, ?, applicant.id,
        COALESCE(applicant.nama_lengkap, applicant.name, applicant.id)
      FROM (SELECT ? AS siswa_id, ? AS tanggal) target JOIN "user" applicant ON applicant.id = ?
      WHERE ${correctionSourceSql} = ? AND EXISTS (
        SELECT 1 FROM siswa s JOIN kelas k ON k.id = s.kelas_id
        WHERE s.id = target.siswa_id AND s.status = 'aktif' AND k.id = ? AND k.wali_kelas_id = ?
      ) ON CONFLICT DO NOTHING`).bind(
      requestId, kelasId, snapshot.tahunAjaranId, day.is_daily_final ? day.status_akhir : 'ALFA',
      input.status, input.reason.trim(), key, JSON.stringify(evidence),
      input.siswaId, input.tanggal, user.id, source, kelasId, access.waliId,
    ),
    ...notice.statements,
  ]
  const written = await db.batch(statements)
  if (!written[1]?.meta.changes) return { error: 'Ajuan sudah menunggu persetujuan atau data absensi berubah. Muat ulang untuk memeriksa.' }
  if (notice.statements.length) {
    try { await flushNotificationOutbox(db, notice.sourceRef) }
    catch (error) { console.error('Gagal meneruskan notifikasi ajuan koreksi:', error) }
  }
  revalidatePath('/dashboard/keterangan-absensi')
  return { success: 'Ajuan dikirim dan menunggu persetujuan.' }
}

export async function listAttendanceCorrectionQueue(history = false, offset = 0) {
  const access = await requireCorrectionReviewerAccess()
  if (!access) return { error: 'Anda tidak memiliki akses persetujuan.' }
  const condition = history ? "r.status <> 'PENDING'" : "r.status = 'PENDING'"
  const order = history ? 'DESC' : 'ASC'
  const pageSize = 50
  const start = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0
  const [rows, count] = await Promise.all([
    access.db.prepare(`${requestQuery} WHERE ${condition} ORDER BY r.requested_at ${order}, r.rowid ${order} LIMIT ? OFFSET ?`)
      .bind(pageSize + 1, start).all<RequestRow>(),
    access.db.prepare("SELECT COUNT(*) AS total FROM attendance_correction_requests WHERE status = 'PENDING'").first<{ total: number }>(),
  ])
  return {
    pending: count?.total ?? 0,
    previousOffset: start > 0 ? Math.max(0, start - pageSize) : null,
    nextOffset: (rows.results || []).length > pageSize ? start + pageSize : null,
    rows: (rows.results || []).slice(0, pageSize).map(row => ({
      id: row.id, student: row.siswa_nama, kelas: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
      date: row.tanggal, previous: row.previous_status, proposed: row.requested_status,
      status: row.status, blocks: (JSON.parse(row.evidence_json) as Evidence).blocks.length,
    })),
  }
}

async function readRequestDay(db: D1Database, row: RequestRow) {
  const snapshot = await correctionAttendanceSnapshot(db, row.kelas_id, row.tanggal, [row.siswa_id], row.tahun_ajaran_id)
  return snapshot?.statusByStudent.get(row.siswa_id)?.[0]
}

export async function getAttendanceCorrectionReview(id: string) {
  const access = await requireCorrectionReviewerAccess()
  if (!access) return { error: 'Anda tidak memiliki akses persetujuan.' }
  const row = await access.db.prepare(`${requestQuery} WHERE r.id = ?`).bind(id).first<RequestRow>()
  if (!row) return { error: 'Ajuan tidak ditemukan.' }
  const day = await readRequestDay(access.db, row)
  const stale = row.status === 'PENDING' && attendanceAlfaKey(day?.alfa_blocks ?? []) !== row.alfa_key
  return {
    data: {
      ...presentRequest(row),
      reviewer: row.requested_by === access.user.id ? null : row.pemeriksa_nama,
      reviewNote: row.requested_by === access.user.id ? null : row.review_note,
      current: day?.status_akhir ?? 'BELUM_ADA_DATA',
      isFinal: Boolean(day?.is_daily_final),
      stale,
      currentBlocks: row.status === 'PENDING' ? day?.alfa_blocks ?? [] : null,
      currentPermissions: row.status === 'PENDING' ? day?.detail_guru.filter(detail => detail.sumber === 'perizinan_siswa') ?? [] : null,
      canApprove: canDecideAttendanceCorrection(access.roles, access.user.id, row.requested_by, 'APPROVED'),
    },
  }
}

export async function decideAttendanceCorrection(id: string, decision: 'APPROVED' | 'REJECTED' | 'STALE', note: string) {
  const access = await requireCorrectionReviewerAccess()
  if (!access) return { error: 'Anda tidak memiliki akses persetujuan.' }
  if (!['APPROVED', 'REJECTED', 'STALE'].includes(decision) || typeof note !== 'string' ||
      note.length > 2000 || (decision === 'REJECTED' && !note.trim())) {
    return { error: 'Isi alasan penolakan (maksimal 2.000 karakter).' }
  }
  const { db, user, roles, reviewerName } = access
  const row = await db.prepare(`${requestQuery} WHERE r.id = ?`).bind(id).first<RequestRow>()
  if (!row || row.status !== 'PENDING') return { error: 'Ajuan sudah diputuskan atau tidak ditemukan.' }
  if (decision !== 'STALE' && !canDecideAttendanceCorrection(roles, user.id, row.requested_by, decision)) {
    return { error: 'Ajuan ini harus disetujui oleh pemeriksa lain.' }
  }
  const source = await readCorrectionSource(db, row.siswa_id, row.tanggal)
  const day = await readRequestDay(db, row)
  const stale = attendanceAlfaKey(day?.alfa_blocks ?? []) !== row.alfa_key
  if (decision === 'STALE' && !stale) return { error: 'Ajuan masih bisa ditinjau. Muat ulang data.' }
  const status = stale ? 'STALE' : decision
  const decisionId = crypto.randomUUID()
  const statements = [db.prepare(`UPDATE attendance_correction_requests AS target
    SET status = ?, reviewed_by = ?, reviewed_by_name = ?, reviewed_at = datetime('now'), review_note = ?, decision_id = ?
    WHERE id = ? AND status = 'PENDING' AND ${correctionSourceSql} = ?`).bind(
    status, user.id, reviewerName, stale ? 'Data Alfa berubah sejak ajuan dikirim.' : note.trim() || null, decisionId, id, source,
  )]
  if (status === 'APPROVED') {
    statements.push(db.prepare(`INSERT INTO keterangan_absensi_wali_kelas
      (id, siswa_id, tanggal, status, keterangan, dibuat_oleh, policy_version, approval_id)
      SELECT ?, siswa_id, tanggal, requested_status, reason, reviewed_by, 1, id
      FROM attendance_correction_requests WHERE decision_id = ? AND status = 'APPROVED'
      ON CONFLICT(siswa_id, tanggal) DO UPDATE SET status = excluded.status, keterangan = excluded.keterangan,
        dibuat_oleh = excluded.dibuat_oleh, policy_version = 1, approval_id = excluded.approval_id,
        updated_at = datetime('now')`).bind(crypto.randomUUID(), decisionId))
    statements.push(...await prepareAttendanceNotificationWork(db, {
      kelasId: row.kelas_id, tanggal: row.tanggal, siswaIds: [row.siswa_id], correctionDecisionId: decisionId,
    }))
  }
  const resultNotice = status === 'APPROVED' || status === 'REJECTED'
    ? await prepareAttendanceCorrectionResultNotice(db, { requestId: id, requesterId: row.requested_by, decisionId, status })
    : null
  if (resultNotice) statements.push(resultNotice.statement)
  const written = await db.batch(statements)
  if (!written[0]?.meta.changes) return { error: 'Ajuan atau catatan absensi baru saja berubah. Muat ulang sebelum memutuskan.' }
  if (status === 'APPROVED') {
    invalidateAttendanceCache()
    revalidatePath('/dashboard/kelas-binaan')
    revalidatePath('/dashboard/rekap-absensi')
    revalidatePath('/portal-ortu')
    try { await flushAttendanceNotificationOutbox(db) }
    catch (error) { console.error('Gagal meneruskan notifikasi koreksi Alfa:', error) }
  }
  if (resultNotice && status === 'REJECTED') {
    try { await flushNotificationOutbox(db, resultNotice.sourceRef) }
    catch (error) { console.error('Gagal meneruskan notifikasi hasil koreksi Alfa:', error) }
  }
  revalidatePath('/dashboard/keterangan-absensi')
  return { success: status === 'STALE' ? 'Data absensi berubah. Wali kelas perlu mengajukan ulang.' :
    status === 'APPROVED' ? 'Ajuan disetujui.' : 'Ajuan ditolak.' }
}
