'use server'

import { summarizeParentAttendanceDays } from '@/lib/parent-attendance-presentation'

import { getDB } from '@/utils/db-server'
import { getAppSession } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { createAuth } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { uploadPaymentProof } from '@/utils/r2'
import { ensureParentSuggestionTable, normalizeParentSuggestionCategory } from '@/lib/parent-suggestions'
import { getKomitePaymentSettings, selectKomitePaymentSettings } from '@/lib/komite-payment-settings'
import { getFinalAttendanceForStudent } from '@/lib/wali-kelas-attendance'
import { getKalenderEventsForRange, kalenderDateStatusFromEvents, enumerateDateStrings } from '@/lib/kalender-pendidikan'
import { ensureSchemaOnce } from '@/lib/schema-guard'
import { emitConfiguredNotification, getStudentNotificationContext } from '@/lib/notification-engine'
import { ensureParentPortalEnhancementSchema } from '@/lib/parent-portal-schema'
import {
  fingerprintParentTkaSelection,
  getParentTkaSelection,
  isParentTkaSelectionComplete,
  PARENT_TKA_STATEMENT_VERSION,
  serializeParentTkaSelection,
} from '@/lib/parent-tka'
import {
  DISCIPLINE_CLARIFICATION_MAX_LENGTH,
  ensureParentDisciplineSchema,
  getParentDisciplineData,
  getParentDisciplineSettings,
} from '@/lib/parent-discipline'

type SummonResponse = 'hadir' | 'reschedule'
const SEMESTER_NILAI_COLUMNS = ['nilai_smt1', 'nilai_smt2', 'nilai_smt3', 'nilai_smt4', 'nilai_smt5', 'nilai_smt6'] as const

async function ensureParentCommunicationTables(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_notifications (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      source_ref TEXT,
      level TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(siswa_id, type, source_ref)
    )
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_summons (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      source_ref TEXT,
      reason TEXT NOT NULL,
      event_date TEXT,
      event_time TEXT,
      location TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'terkirim',
      parent_response TEXT,
      parent_response_note TEXT,
      parent_responded_at TEXT,
      created_by TEXT REFERENCES "user"(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(siswa_id, source_ref)
    )
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_thread_notes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      note_type TEXT NOT NULL DEFAULT 'tindak_lanjut',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
}

async function requireParentSession() {
  const session = await getAppSession()
  if (!session || session.kind !== 'parent') throw new Error('Unauthorized')
  return session
}

function generateId() {
  return crypto.randomUUID()
}

function academicYearRange(nama: string, semester: number) {
  const years = String(nama || '').match(/(\d{4})\D+(\d{4})/)
  if (!years) return null
  const firstYear = Number(years[1])
  const secondYear = Number(years[2])
  return Number(semester) === 1
    ? { startDate: `${firstYear}-07-01`, endDate: `${firstYear}-12-31` }
    : { startDate: `${secondYear}-01-01`, endDate: `${secondYear}-06-30` }
}

function summarizeParentAttendance(statuses: any[]) { return summarizeParentAttendanceDays(statuses) }

export async function getParentAttendanceByAcademicYear(tahunAjaranId: string) {
  const session = await requireParentSession()
  const db = await getDB()
  const ta = await db.prepare(`
    SELECT id, nama, semester, is_active
    FROM tahun_ajaran
    WHERE id = ?
    LIMIT 1
  `).bind(tahunAjaranId).first<any>()
  if (!ta) return { error: 'Tahun ajaran tidak ditemukan.' }

  const range = academicYearRange(ta.nama, Number(ta.semester))
  if (!range) return { error: 'Rentang tahun ajaran belum dapat ditentukan.' }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const endDate = range.endDate > today ? today : range.endDate
  const result = endDate >= range.startDate
    ? await getFinalAttendanceForStudent(db, session.user.siswa_id, range.startDate, endDate, { tahunAjaranId: ta.id })
    : null
  const statuses = result?.statuses || []
  const aggregates = summarizeParentAttendance(statuses)
  const events = endDate >= range.startDate ? await getKalenderEventsForRange(db, range.startDate, endDate) : []
  const siswaKelas = await db.prepare(`
    SELECT k.id AS kelas_id, k.tingkat
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE s.id = ?
  `).bind(session.user.siswa_id).first<{ kelas_id: string | null; tingkat: number | null }>()
  const calendarScope = siswaKelas?.kelas_id
    ? { kelasId: siswaKelas.kelas_id, tingkat: Number(siswaKelas.tingkat) }
    : null
  const calendarExceptions = endDate >= range.startDate ? enumerateDateStrings(range.startDate, endDate)
    .map(tanggal => kalenderDateStatusFromEvents(tanggal, events, calendarScope))
    .filter(day => !day.isEffective)
    .map(day => ({ tanggal: day.tanggal, label: 'Hari libur', reason: day.reason })) : []

  return {
    tahunAjaran: { id: ta.id, nama: ta.nama, semester: Number(ta.semester), isActive: Number(ta.is_active) === 1 },
    range: { startDate: range.startDate, endDate },
    ...aggregates,
    calendarDays: statuses,
    calendarExceptions,
  }
}

export async function getParentDisciplineByAcademicYear(tahunAjaranId: string) {
  const session = await requireParentSession()
  const db = await getDB()
  const settings = await getParentDisciplineSettings()
  if (!settings.enabled) return { error: 'Fitur kedisiplinan sedang dinonaktifkan.' }
  const result = await getParentDisciplineData(db, session.user.siswa_id, String(tahunAjaranId || '').trim())
  return result || { error: 'Tahun ajaran tidak ditemukan.' }
}

export async function submitDisciplineClarification(recordId: string, message: string) {
  const session = await requireParentSession()
  const db = await getDB()
  await ensureParentDisciplineSchema(db)
  const settings = await getParentDisciplineSettings()
  if (!settings.enabled || settings.clarificationMode !== 'form') return { error: 'Form klarifikasi sedang tidak tersedia.' }
  const cleanMessage = String(message || '').trim()
  if (!cleanMessage) return { error: 'Isi klarifikasi wajib diisi.' }
  if (cleanMessage.length > DISCIPLINE_CLARIFICATION_MAX_LENGTH) return { error: `Klarifikasi maksimal ${DISCIPLINE_CLARIFICATION_MAX_LENGTH} karakter.` }

  const record = await db.prepare(`
    SELECT sp.id, sp.siswa_id, sp.tanggal,
      COALESCE(sp.nama_pelanggaran_snapshot, mp.nama_pelanggaran) AS nama_pelanggaran,
      COALESCE(sp.kategori_snapshot, mp.kategori) AS kategori,
      COALESCE(sp.poin_snapshot, mp.poin, 0) AS poin
    FROM siswa_pelanggaran sp
    LEFT JOIN master_pelanggaran mp ON mp.id = sp.master_pelanggaran_id
    WHERE sp.id = ? AND sp.siswa_id = ? AND sp.publication_status = 'published' LIMIT 1
  `).bind(recordId, session.user.siswa_id).first<any>()
  if (!record) return { error: 'Catatan kedisiplinan tidak ditemukan.' }
  const existing = await db.prepare('SELECT id FROM parent_discipline_clarifications WHERE siswa_pelanggaran_id = ? LIMIT 1').bind(recordId).first()
  if (existing) return { error: 'Klarifikasi untuk catatan ini sudah pernah dikirim.' }

  const id = generateId()
  await db.prepare(`
    INSERT INTO parent_discipline_clarifications (
      id, siswa_pelanggaran_id, siswa_id, parent_session_id,
      pelanggaran_nama_snapshot, pelanggaran_kategori_snapshot,
      pelanggaran_poin_snapshot, pelanggaran_tanggal_snapshot, request_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, record.id, record.siswa_id, session.session.id,
    record.nama_pelanggaran, record.kategori, Number(record.poin || 0), record.tanggal, cleanMessage,
  ).run()

  const reviewerRows = await db.prepare(`
    SELECT DISTINCT u.id
    FROM "user" u
    LEFT JOIN siswa s ON s.id = ?
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE u.banned = 0 AND (
      u.role IN ('super_admin','admin_tu','kepsek','wakamad')
      OR u.id IN (SELECT ur.user_id FROM user_roles ur WHERE ur.role IN ('super_admin','admin_tu','kepsek','wakamad'))
      OR u.id = k.wali_kelas_id
      OR EXISTS (
        SELECT 1 FROM kelas_binaan_bk kb JOIN tahun_ajaran ta ON ta.id = kb.tahun_ajaran_id AND ta.is_active = 1
        WHERE kb.kelas_id = s.kelas_id AND kb.guru_bk_id = u.id
      )
    )
  `).bind(record.siswa_id).all<{ id: string }>()
  const userIds = (reviewerRows.results || []).map(row => row.id)
  if (userIds.length) {
    await emitConfiguredNotification({
      eventKey: 'discipline_parent_clarification_submitted',
      sourceRef: `discipline-clarification:${id}`,
      context: { userIds, nama_pelanggaran: record.nama_pelanggaran, tanggal: record.tanggal },
      targetOverride: { kind: 'staff_users', ids: userIds },
      db,
    }).catch(() => undefined)
  }
  revalidatePath('/portal-ortu')
  revalidatePath('/dashboard/kedisiplinan')
  return { success: 'Klarifikasi berhasil dikirim.', id }
}

function isDsptZeroUninput(
  tahunMasuk: number | string | null | undefined,
  nominal: number | null | undefined,
  totalDibayar: number | null | undefined,
  totalDiskon: number | null | undefined,
) {
  return Number(tahunMasuk || 0) >= 2026
    && Number(nominal || 0) === 0
    && Number(totalDibayar || 0) === 0
    && Number(totalDiskon || 0) === 0
}

async function ensurePaymentSubmissionTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS fin_payment_submissions (
      id TEXT PRIMARY KEY,
      siswa_id TEXT NOT NULL REFERENCES siswa(id),
      dspt_id TEXT NOT NULL REFERENCES fin_dspt(id),
      kategori TEXT NOT NULL DEFAULT 'dspt',
      metode_bayar TEXT NOT NULL DEFAULT 'transfer',
      jumlah INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'belum_upload',
      bank_tujuan TEXT,
      bukti_url TEXT,
      bukti_uploaded_at TEXT,
      confirmed_by TEXT REFERENCES "user"(id),
      confirmed_at TEXT,
      rejected_by TEXT REFERENCES "user"(id),
      rejected_at TEXT,
      reject_reason TEXT,
      transaksi_id TEXT REFERENCES fin_transaksi(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
}

export async function createParentDsptPaymentSubmission(payload: {
  amount: number
  method: 'transfer' | 'qris'
  bankAccountId?: string
}) {
  const session = await requireParentSession()
  const db = await getDB()
  await ensurePaymentSubmissionTable(db)

  const amount = Math.floor(Number(payload.amount || 0))
  if (!Number.isSafeInteger(amount) || amount <= 0) return { error: 'Nominal pembayaran harus lebih dari 0.' }
  const student = await db.prepare('SELECT k.tingkat FROM siswa s LEFT JOIN kelas k ON k.id = s.kelas_id WHERE s.id = ?')
    .bind(session.user.siswa_id).first<{ tingkat: number | null }>()
  const settings = selectKomitePaymentSettings(await getKomitePaymentSettings(db), student?.tingkat)
  if (!settings.tingkat) return { error: 'Tingkat kelas siswa belum tersedia. Silakan hubungi bendahara komite.' }
  const method = payload.method === 'qris' ? 'qris' : 'transfer'
  if (method === 'qris' && settings.qrisEnabled === false) return { error: 'Metode QRIS sedang tidak aktif.' }
  const activeAccounts = settings.accounts.filter((account) => account.isActive)
  if (method === 'transfer' && activeAccounts.length === 0) return { error: 'Metode transfer rekening sedang tidak aktif.' }

  // Snapshot bank tujuan (label saat pengajuan) — ditampilkan ke admin saat pengecekan bukti.
  let bankTujuan: string | null = null
  if (method === 'transfer') {
    const chosen = payload.bankAccountId
      ? activeAccounts.find((account) => account.id === payload.bankAccountId)
      : activeAccounts[0]
    if (!chosen) return { error: 'Bank tujuan transfer tidak valid.' }
    bankTujuan = `${chosen.bankLabel} - ${chosen.rekening} a.n. ${chosen.atasNama}`
  }

  const dspt = await db.prepare(`
    SELECT d.id, d.nominal_target, d.total_dibayar, d.total_diskon, s.tahun_masuk
    FROM fin_dspt d
    LEFT JOIN siswa s ON s.id = d.siswa_id
    WHERE d.siswa_id = ?
    LIMIT 1
  `).bind(session.user.siswa_id).first<any>()
  if (!dspt) return { error: 'Data DSPT belum tersedia.' }
  if (isDsptZeroUninput(dspt.tahun_masuk, dspt.nominal_target, dspt.total_dibayar, dspt.total_diskon)) {
    return { error: 'Data DSPT belum diinput.' }
  }

  const sisa = Math.max(0, Number(dspt.nominal_target || 0) - Number(dspt.total_dibayar || 0) - Number(dspt.total_diskon || 0))
  if (sisa <= 0) return { error: 'DSPT sudah lunas.' }

  const id = generateId()
  await db.prepare(`
    INSERT INTO fin_payment_submissions (id, siswa_id, dspt_id, kategori, metode_bayar, jumlah, status, bank_tujuan)
    VALUES (?, ?, ?, 'dspt', ?, ?, 'belum_upload', ?)
  `).bind(id, session.user.siswa_id, dspt.id, method, amount, bankTujuan).run()

  revalidatePath('/portal-ortu')
  return { success: 'Pengajuan pembayaran dibuat.', submissionId: id }
}

export async function uploadParentPaymentProof(formData: FormData) {
  const session = await requireParentSession()
  const db = await getDB()
  await ensurePaymentSubmissionTable(db)

  const submissionId = String(formData.get('submissionId') || '')
  const file = formData.get('bukti') as File | null
  if (!submissionId) return { error: 'Pengajuan pembayaran tidak ditemukan.' }
  if (!file || file.size <= 0) return { error: 'File bukti pembayaran wajib diupload.' }

  const submission = await db.prepare(`
    SELECT id, siswa_id, status, jumlah, metode_bayar
    FROM fin_payment_submissions
    WHERE id = ? AND siswa_id = ?
  `).bind(submissionId, session.user.siswa_id).first<any>()
  if (!submission) return { error: 'Pengajuan pembayaran tidak ditemukan.' }
  if (submission.status === 'terkonfirmasi') return { error: 'Pembayaran sudah dikonfirmasi dan tidak bisa diganti.' }

  const uploaded = await uploadPaymentProof(file, submissionId)
  if (uploaded.error || !uploaded.url) return { error: uploaded.error || 'Upload bukti pembayaran gagal.' }

  await db.prepare(`
    UPDATE fin_payment_submissions
    SET bukti_url = ?, bukti_uploaded_at = datetime('now'), status = 'menunggu_konfirmasi',
        reject_reason = NULL, rejected_by = NULL, rejected_at = NULL, updated_at = datetime('now')
    WHERE id = ? AND siswa_id = ?
  `).bind(uploaded.url, submissionId, session.user.siswa_id).run()

  try {
    const student = await getStudentNotificationContext(db, submission.siswa_id)
    if (student) {
      await emitConfiguredNotification({
        eventKey: 'finance_payment_proof_uploaded',
        sourceRef: `payment-proof:${submissionId}:${submission.status}`,
        context: {
          ...student,
          nominal: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(submission.jumlah || 0)),
          tanggal: new Date().toISOString().slice(0, 10),
          metode_bayar: submission.metode_bayar === 'qris' ? 'QRIS' : 'transfer',
        },
        db,
        parentType: 'keuangan',
      })
    }
  } catch (error) {
    console.error('[notification] finance_payment_proof_uploaded gagal:', error)
  }

  revalidatePath('/portal-ortu')
  return { success: 'Bukti pembayaran berhasil diupload.', buktiUrl: uploaded.url }
}

export async function getParentSemesterGrades(semester: number) {
  const session = await requireParentSession()
  const semesterIndex = Number(semester)
  const targetColumn = SEMESTER_NILAI_COLUMNS[semesterIndex - 1]
  if (!targetColumn) return { error: 'Semester tidak valid.' }

  const db = await getDB()
  const row = await db.prepare(`
    SELECT ${targetColumn} AS nilai
    FROM rekap_nilai_akademik
    WHERE siswa_id = ?
    LIMIT 1
  `).bind(session.user.siswa_id).first<{ nilai: string | null }>()

  let parsed: Record<string, number> = {}
  try {
    parsed = row?.nilai ? JSON.parse(row.nilai) : {}
  } catch {
    parsed = {}
  }

  const grades = Object.entries(parsed)
    .map(([mapel, nilai]) => ({ mapel, nilai: Number(nilai) }))
    .filter(item => item.mapel && !Number.isNaN(item.nilai))

  const average = grades.length
    ? Number((grades.reduce((total, item) => total + item.nilai, 0) / grades.length).toFixed(2))
    : null

  return { grades, average }
}

export async function respondParentSummons(payload: { summonId: string; response: SummonResponse; note?: string }) {
  const session = await requireParentSession()
  const db = await getDB()
  await ensureSchemaOnce('parent-communication', () => ensureParentCommunicationTables(db))

  const row = await db.prepare(`
    SELECT id, siswa_id
    FROM parent_summons
    WHERE id = ? AND siswa_id = ?
  `).bind(payload.summonId, session.user.siswa_id).first<{ id: string; siswa_id: string }>()

  if (!row) return { error: 'Data pemanggilan tidak ditemukan.' }

  await db.prepare(`
    UPDATE parent_summons
    SET parent_response = ?, parent_response_note = ?, parent_responded_at = datetime('now'),
        status = CASE WHEN ? = 'hadir' THEN 'dikonfirmasi' ELSE 'reschedule_diminta' END,
        updated_at = datetime('now')
    WHERE id = ? AND siswa_id = ?
  `).bind(payload.response, payload.note || null, payload.response, payload.summonId, session.user.siswa_id).run()

  const responseText = payload.response === 'hadir'
    ? 'Orang tua mengonfirmasi kehadiran pada jadwal pemanggilan.'
    : `Orang tua meminta penjadwalan ulang.${payload.note ? ` Catatan: ${payload.note}` : ''}`

  await db.prepare(`
    INSERT INTO parent_thread_notes (siswa_id, actor_type, actor_id, note_type, content)
    VALUES (?, 'orang_tua', ?, 'respon_pemanggilan', ?)
  `).bind(session.user.siswa_id, session.user.nisn, responseText).run()

  revalidatePath('/portal-ortu')
  return { success: 'Respon pemanggilan berhasil dikirim.' }
}

export async function markParentNotificationRead(notificationId: string) {
  const session = await requireParentSession()
  const db = await getDB()
  await ensureSchemaOnce('parent-communication', () => ensureParentCommunicationTables(db))
  await ensureParentPortalEnhancementSchema(db)

  await db.prepare(`
    UPDATE parent_notifications
    SET is_read = 1
    WHERE id = ? AND siswa_id = ? AND archived_at IS NULL
  `).bind(notificationId, session.user.siswa_id).run()

  revalidatePath('/portal-ortu')
  return { success: true }
}

export async function markAllParentNotificationsRead() {
  const session = await requireParentSession()
  const db = await getDB()
  await ensureSchemaOnce('parent-communication', () => ensureParentCommunicationTables(db))
  await ensureParentPortalEnhancementSchema(db)

  await db.prepare(`
    UPDATE parent_notifications
    SET is_read = 1
    WHERE siswa_id = ? AND archived_at IS NULL AND is_read = 0
  `).bind(session.user.siswa_id).run()

  revalidatePath('/portal-ortu')
  return { success: true }
}

export async function archiveReadParentNotifications() {
  const session = await requireParentSession()
  const db = await getDB()
  await ensureSchemaOnce('parent-communication', () => ensureParentCommunicationTables(db))
  await ensureParentPortalEnhancementSchema(db)

  await db.prepare(`
    UPDATE parent_notifications
    SET archived_at = datetime('now')
    WHERE siswa_id = ? AND archived_at IS NULL AND is_read = 1
  `).bind(session.user.siswa_id).run()

  revalidatePath('/portal-ortu')
  return { success: true }
}

export async function approveParentTkaSelection() {
  const session = await requireParentSession()
  const db = await getDB()
  await ensureSchemaOnce('parent-communication', () => ensureParentCommunicationTables(db))
  await ensureParentPortalEnhancementSchema(db)

  const context = await db.prepare(`
    SELECT k.tingkat, ta.id AS tahun_ajaran_id
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    LEFT JOIN tahun_ajaran ta ON ta.is_active = 1
    WHERE s.id = ?
    LIMIT 1
  `).bind(session.user.siswa_id).first<{ tingkat: number | null; tahun_ajaran_id: string | null }>()

  if (!context?.tahun_ajaran_id || Number(context.tingkat) !== 12) {
    return { error: 'Persetujuan pilihan TKA hanya tersedia untuk siswa kelas 12 pada tahun ajaran aktif.' }
  }

  const current = await getParentTkaSelection(db, session.user.siswa_id, context.tahun_ajaran_id)
  if (!current.hasData || !current.selection || !isParentTkaSelectionComplete(current.selection)) {
    return { error: 'Pilihan TKA dan pendidikan lanjutan belum lengkap. Silakan hubungi guru BK.' }
  }

  const fingerprint = await fingerprintParentTkaSelection(current.selection)
  await db.prepare(`
    INSERT INTO parent_tka_approvals (
      id, siswa_id, tahun_ajaran_id, selection_fingerprint, selection_snapshot,
      statement_version, approved_by_parent_identifier, approved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(siswa_id, tahun_ajaran_id, selection_fingerprint) DO UPDATE SET
      selection_snapshot = excluded.selection_snapshot,
      statement_version = excluded.statement_version,
      approved_by_parent_identifier = excluded.approved_by_parent_identifier,
      approved_at = datetime('now')
  `).bind(
    crypto.randomUUID(),
    session.user.siswa_id,
    context.tahun_ajaran_id,
    fingerprint,
    serializeParentTkaSelection(current.selection),
    PARENT_TKA_STATEMENT_VERSION,
    session.user.nisn,
  ).run()

  revalidatePath('/portal-ortu')
  return { success: 'Persetujuan pilihan anak berhasil disimpan.', fingerprint }
}

export async function createParentSuggestion(payload: {
  category: string
  title: string
  message: string
}) {
  const session = await requireParentSession()
  const db = await getDB()
  await ensureParentSuggestionTable(db)

  const category = normalizeParentSuggestionCategory(payload.category)
  const title = String(payload.title || '').trim()
  const message = String(payload.message || '').trim()

  if (!category) return { error: 'Kategori saran wajib dipilih.' }
  if (!title) return { error: 'Judul saran wajib diisi.' }
  if (!message) return { error: 'Isi saran wajib diisi.' }
  if (title.length > 120) return { error: 'Judul saran maksimal 120 karakter.' }
  if (message.length > 2000) return { error: 'Isi saran maksimal 2000 karakter.' }

  await db.prepare(`
    INSERT INTO parent_suggestions
      (id, parent_user_id, siswa_id, category, title, message, is_anonymous, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 'baru', datetime('now'), datetime('now'))
  `).bind(
    generateId(),
    session.user.nisn || null,
    session.user.siswa_id,
    category,
    title,
    message
  ).run()

  revalidatePath('/portal-ortu')
  return { success: 'Terima kasih, saran Bapak/Ibu sudah kami terima.' }
}

function normalizeWhatsAppNumber(raw: string) {
  let value = String(raw || '').trim()
  value = value.replace(/[^\d+]/g, '')
  if (value.startsWith('+')) value = value.slice(1)
  if (value.startsWith('0')) value = `62${value.slice(1)}`
  if (value.startsWith('8')) value = `62${value}`
  return value
}

export async function updateOwnParentWhatsApp(payload: {
  nomorWhatsapp: string
}) {
  const session = await requireParentSession()
  const nomorWhatsapp = normalizeWhatsAppNumber(payload.nomorWhatsapp)

  if (!nomorWhatsapp) {
    return { error: 'Nomor WhatsApp wajib diisi.' }
  }
  if (!/^\d{10,15}$/.test(nomorWhatsapp)) {
    return { error: 'Nomor WhatsApp tidak valid. Gunakan format 08..., 628..., atau +628...' }
  }
  if (!nomorWhatsapp.startsWith('62')) {
    return { error: 'Nomor WhatsApp harus menggunakan nomor Indonesia.' }
  }

  const db = await getDB()
  await db.prepare(`
    UPDATE siswa
    SET nomor_whatsapp = ?
    WHERE id = ?
  `).bind(nomorWhatsapp, session.user.siswa_id).run()

  revalidatePath('/portal-ortu')
  return { success: 'Nomor WhatsApp orang tua berhasil diperbarui.', nomorWhatsapp }
}

export async function changeOwnParentPassword(payload: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}) {
  const session = await requireParentSession()
  const currentPassword = String(payload.currentPassword || '').trim()
  const newPassword = String(payload.newPassword || '').trim()
  const confirmPassword = String(payload.confirmPassword || '').trim()

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'Semua field password wajib diisi.' }
  }
  if (newPassword.length < 6) {
    return { error: 'Password baru minimal 6 karakter.' }
  }
  if (newPassword !== confirmPassword) {
    return { error: 'Konfirmasi password tidak sama.' }
  }

  const { env } = await getCloudflareContext({ async: true })
  const auth = createAuth(env.DB)

  // Verifikasi password lama via sign-in parent
  try {
    await auth.api.signInParent({
      body: { nisn: session.user.nisn, password: currentPassword },
      asResponse: false,
    })
  } catch {
    return { error: 'Password saat ini salah.' }
  }

  await auth.api.changeParentPassword({
    siswaId: session.user.siswa_id,
    newPassword,
  })

  revalidatePath('/portal-ortu')
  return { success: 'Password berhasil diperbarui.' }
}
