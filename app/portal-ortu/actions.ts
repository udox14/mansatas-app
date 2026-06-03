'use server'

import { getDB } from '@/utils/db'
import { getAppSession } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { createAuth } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { uploadPaymentProof } from '@/utils/r2'

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
}) {
  const session = await requireParentSession()
  const db = await getDB()
  await ensurePaymentSubmissionTable(db)

  const amount = Math.floor(Number(payload.amount || 0))
  if (amount <= 0) return { error: 'Nominal pembayaran harus lebih dari 0.' }

  const dspt = await db.prepare(`
    SELECT id, nominal_target, total_dibayar, total_diskon
    FROM fin_dspt
    WHERE siswa_id = ?
    LIMIT 1
  `).bind(session.user.siswa_id).first<any>()
  if (!dspt) return { error: 'Data DSPT belum tersedia.' }

  const sisa = Math.max(0, Number(dspt.nominal_target || 0) - Number(dspt.total_dibayar || 0) - Number(dspt.total_diskon || 0))
  if (sisa <= 0) return { error: 'DSPT sudah lunas.' }
  if (amount > sisa) return { error: 'Nominal tidak boleh melebihi sisa DSPT.' }

  const id = generateId()
  await db.prepare(`
    INSERT INTO fin_payment_submissions (id, siswa_id, dspt_id, kategori, metode_bayar, jumlah, status)
    VALUES (?, ?, ?, 'dspt', ?, ?, 'belum_upload')
  `).bind(id, session.user.siswa_id, dspt.id, payload.method || 'transfer', amount).run()

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
    SELECT id, siswa_id, status
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
  await ensureParentCommunicationTables(db)

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
  await ensureParentCommunicationTables(db)

  await db.prepare(`
    UPDATE parent_notifications
    SET is_read = 1
    WHERE id = ? AND siswa_id = ?
  `).bind(notificationId, session.user.siswa_id).run()

  revalidatePath('/portal-ortu')
  return { success: true }
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
