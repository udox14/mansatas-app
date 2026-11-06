'use server'

import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { isPlayReviewerRole } from '@/lib/play-reviewer'
import { formatNamaKelas } from '@/lib/utils'
import { getSystemSettingBoolean } from '@/lib/system-settings'
import { flushNotificationOutbox } from '@/lib/notification-engine'
import { parseDsptAudience, dsptRecipientsQuery } from '@/lib/dspt-reminder-audience'
import { prepareDsptWork } from '@/lib/dspt-reminder-queue'
import { DSPT_SEND_SETTING, DSPT_TEMPLATES, type DsptAudience, type DsptTemplate } from '@/lib/dspt-reminder-config'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type ClassRow = { id: string; tingkat: number; nomor_kelas: string; kelompok: string | null }

async function requireDsptReminderAccess() {
  const session = await getSession()
  if (!session?.user) throw new Error('Sesi berakhir. Silakan masuk kembali.')
  const db = await getDB()
  const roles = await getUserRoles(db, session.user.id)
  if (isPlayReviewerRole(roles) || !roles.some(role => role === 'bendahara_komite' || role === 'super_admin')
    || !(await checkFeatureAccess(db, session.user.id, 'keuangan-dspt'))) {
    throw new Error('Anda tidak memiliki akses notifikasi DSPT.')
  }
  return { db, userId: session.user.id }
}

async function resolveTemplate(db: D1Database, id: string, payment: DsptAudience['payment']) {
  const builtin = DSPT_TEMPLATES.find(template => template.id === id)
  if (builtin) return payment === 'all' && id === 'pengingat' ? null : builtin
  if (typeof id !== 'string' || !UUID.test(id)) return null
  return db.prepare('SELECT id, name, title, body FROM dspt_notice_templates WHERE id = ? AND archived_at IS NULL')
    .bind(id).first<DsptTemplate>()
}

async function describeAudience(db: D1Database, audience: DsptAudience) {
  const { scope, payment } = audience
  let label = 'Semua tingkat'
  if (scope.kind === 'grade') label = `Tingkat ${scope.grade}`
  if (scope.kind === 'students') label = `${scope.studentIds.length} siswa dipilih`
  if (scope.kind === 'class') {
    const row = await db.prepare('SELECT tingkat, nomor_kelas, kelompok FROM kelas WHERE id = ?').bind(scope.classId).first<ClassRow>()
    if (!row) return null
    label = formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok)
  }
  return `${label} · ${payment === 'unpaid' ? 'Belum lunas' : 'Semua status DSPT'}`
}

export async function loadDsptReminderOptions() {
  const { db } = await requireDsptReminderAccess()
  const [classes, templates, enabled] = await Promise.all([
    db.prepare(`SELECT DISTINCT k.id, k.tingkat, k.nomor_kelas, k.kelompok FROM kelas k
      JOIN siswa s ON s.kelas_id = k.id AND s.status = 'aktif'
      ORDER BY CAST(k.tingkat AS INTEGER), CAST(k.nomor_kelas AS INTEGER), k.kelompok`).all<ClassRow>(),
    db.prepare('SELECT id, name, title, body FROM dspt_notice_templates WHERE archived_at IS NULL ORDER BY name, id').all<DsptTemplate>(),
    getSystemSettingBoolean(DSPT_SEND_SETTING, false, db),
  ])
  return {
    classes: (classes.results || []).map(row => ({ id: row.id, name: formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok) })),
    templates: templates.results || [],
    enabled,
  }
}

export async function searchDsptReminderStudents(input: string) {
  const { db } = await requireDsptReminderAccess()
  const term = typeof input === 'string' ? input.trim().slice(0, 100) : ''
  if (term.length < 2) return []
  const escaped = term.replace(/[!%_]/g, char => '!' + char)
  const rows = await db.prepare(`SELECT s.id, s.nama_lengkap AS name, k.tingkat, k.nomor_kelas, k.kelompok
    FROM siswa s LEFT JOIN kelas k ON k.id = s.kelas_id WHERE s.status = 'aktif'
      AND (s.nama_lengkap LIKE ? ESCAPE '!' OR s.nisn = ?)
    ORDER BY s.nama_lengkap, s.id LIMIT 25`).bind(`%${escaped}%`, term)
    .all<ClassRow & { name: string }>()
  return (rows.results || []).map(row => ({
    id: row.id, name: row.name, className: row.tingkat == null ? 'Belum masuk kelas' : formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok),
  }))
}

export async function previewDsptReminder(input: unknown, templateId: string) {
  const { db } = await requireDsptReminderAccess()
  const audience = parseDsptAudience(input)
  if (!audience) return { error: 'Pilih sasaran yang valid.' } as const
  const { sql, bindings } = dsptRecipientsQuery(audience)
  const [template, label, total] = await Promise.all([
    resolveTemplate(db, templateId, audience.payment),
    describeAudience(db, audience),
    db.prepare(`SELECT COUNT(*) AS count FROM (${sql})`).bind(...bindings).first<{ count: number }>(),
  ])
  if (!template || !label) return { error: 'Templat atau sasaran tidak tersedia.' } as const
  return { count: Number(total?.count || 0), title: template.title, body: template.body, label }
}

export async function sendDsptReminder(input: unknown, templateId: string, confirmation: { id: string; count: number; title: string; body: string }) {
  const { db, userId } = await requireDsptReminderAccess()
  if (!confirmation || typeof confirmation.id !== 'string' || !UUID.test(confirmation.id)
    || !Number.isSafeInteger(confirmation.count) || confirmation.count <= 0) {
    return { error: 'Buat pratinjau dengan penerima sebelum mengirim.' } as const
  }
  const id = confirmation.id.toLowerCase()
  const existing = await db.prepare('SELECT sender_id FROM dspt_notices WHERE id = ?').bind(id).first<{ sender_id: string }>()
  if (existing) return existing.sender_id === userId ? { id } : { error: 'Konfirmasi tidak valid.' } as const
  if (!(await getSystemSettingBoolean(DSPT_SEND_SETTING, false, db))) {
    return { error: 'Pengiriman DSPT belum diaktifkan.' } as const
  }
  const audience = parseDsptAudience(input)
  if (!audience) return { error: 'Pilih sasaran yang valid.' } as const
  const [template, label] = await Promise.all([resolveTemplate(db, templateId, audience.payment), describeAudience(db, audience)])
  if (!template || !label || template.title !== confirmation.title || template.body !== confirmation.body) {
    return { error: 'Pesan atau sasaran berubah. Periksa pratinjau kembali.', refresh: true } as const
  }
  const { sql, bindings } = dsptRecipientsQuery(audience)
  const [created] = await db.batch([
    db.prepare(`INSERT OR IGNORE INTO dspt_notices(id, sender_id, title, body, audience_json, audience_label, recipient_count)
      SELECT ?, ?, ?, ?, ?, ?, count FROM (SELECT COUNT(*) AS count FROM (${sql})) WHERE count = ?`)
      .bind(id, userId, template.title, template.body, JSON.stringify(audience), label, ...bindings, confirmation.count),
    db.prepare(`INSERT OR IGNORE INTO dspt_notice_recipients(notice_id, siswa_id)
      SELECT ?, eligible.id FROM (${sql}) eligible WHERE EXISTS (SELECT 1 FROM dspt_notices WHERE id = ? AND sender_id = ?)
      AND NOT EXISTS (SELECT 1 FROM dspt_notice_recipients WHERE notice_id = ?)`)
      .bind(id, ...bindings, id, userId, id),
    prepareDsptWork(db, id, { cursor: '', step: 0 }),
  ])
  if (!created.meta.changes) {
    const stored = await db.prepare('SELECT sender_id FROM dspt_notices WHERE id = ?').bind(id).first<{ sender_id: string }>()
    if (stored?.sender_id !== userId) return { error: 'Jumlah penerima berubah. Periksa pratinjau kembali.', refresh: true } as const
  }
  await flushNotificationOutbox(db, id).catch(() => undefined)
  return { id }
}

function parseTemplateFields(input: unknown) {
  if (!input || typeof input !== 'object' || !('name' in input) || !('title' in input) || !('body' in input)) return null
  const { name, title, body } = input
  if (typeof name !== 'string' || typeof title !== 'string' || typeof body !== 'string') return null
  const fields = { name: name.trim(), title: title.trim(), body: body.trim() }
  return fields.name.length > 0 && fields.name.length <= 60 && fields.title.length > 0 && fields.title.length <= 100
    && fields.body.length > 0 && fields.body.length <= 400 ? fields : null
}

export async function saveDsptReminderTemplate(id: string | null, input: unknown) {
  const { db, userId } = await requireDsptReminderAccess()
  const fields = parseTemplateFields(input)
  if (!fields || (id !== null && (typeof id !== 'string' || !UUID.test(id)))) return { error: 'Isian templat tidak valid.' } as const
  const templateId = id ?? crypto.randomUUID()
  const updated = id
    ? await db.prepare(`UPDATE dspt_notice_templates SET name = ?, title = ?, body = ?, updated_by = ?,
      updated_at = datetime('now') WHERE id = ? AND archived_at IS NULL`)
      .bind(fields.name, fields.title, fields.body, userId, id).run()
    : await db.prepare('INSERT INTO dspt_notice_templates(id, name, title, body, updated_by) VALUES (?, ?, ?, ?, ?)')
      .bind(templateId, fields.name, fields.title, fields.body, userId).run()
  if (!updated.meta.changes) return { error: 'Templat tidak ditemukan atau sudah diarsipkan.' } as const
  return { template: { id: templateId, ...fields } }
}

export async function archiveDsptReminderTemplate(id: string) {
  const { db, userId } = await requireDsptReminderAccess()
  if (typeof id !== 'string' || !UUID.test(id)) return { error: 'Templat tidak valid.' } as const
  const result = await db.prepare(`UPDATE dspt_notice_templates SET archived_at = datetime('now'),
    updated_at = datetime('now'), updated_by = ? WHERE id = ? AND archived_at IS NULL`).bind(userId, id).run()
  return result.meta.changes ? { ok: true } as const : { error: 'Templat tidak ditemukan atau sudah diarsipkan.' } as const
}

export async function listDsptReminderHistory() {
  const { db } = await requireDsptReminderAccess()
  const result = await db.prepare(`
    WITH recent AS (SELECT * FROM dspt_notices ORDER BY created_at DESC, id DESC LIMIT 20),
    recipients AS (
      SELECT r.notice_id,
        SUM(r.state = 'in_app') AS in_app, SUM(r.state = 'skipped') AS skipped,
        SUM(r.state = 'in_app' AND NOT EXISTS (SELECT 1 FROM dspt_notice_devices d
          WHERE d.notice_id = r.notice_id AND d.siswa_id = r.siswa_id AND d.channel = 'fcm')) AS no_fcm,
        SUM(r.state = 'in_app' AND NOT EXISTS (SELECT 1 FROM dspt_notice_devices d
          WHERE d.notice_id = r.notice_id AND d.siswa_id = r.siswa_id AND d.channel = 'webpush')) AS no_webpush
      FROM recent n JOIN dspt_notice_recipients r ON r.notice_id = n.id GROUP BY r.notice_id
    ),
    devices AS (
      SELECT d.notice_id, SUM(d.channel = 'fcm' AND d.state = 'accepted') AS fcm_accepted,
        SUM(d.channel = 'webpush' AND d.state = 'accepted') AS webpush_accepted,
        SUM(d.channel = 'fcm' AND d.state = 'failed') AS fcm_failed,
        SUM(d.channel = 'webpush' AND d.state = 'failed') AS webpush_failed,
        SUM(d.channel = 'fcm' AND d.state = 'skipped') AS fcm_skipped,
        SUM(d.channel = 'webpush' AND d.state = 'skipped') AS webpush_skipped
      FROM recent n JOIN dspt_notice_devices d ON d.notice_id = n.id GROUP BY d.notice_id
    )
    SELECT n.id, COALESCE(u.nama_lengkap, u.name, 'Akun tidak tersedia') AS sender, n.title, n.body, n.audience_label,
      n.recipient_count, n.created_at, n.finished_at, n.failed_at,
      COALESCE(r.in_app, 0) AS in_app, COALESCE(r.skipped, 0) AS skipped,
      COALESCE(r.no_fcm, 0) AS no_fcm, COALESCE(r.no_webpush, 0) AS no_webpush,
      COALESCE(d.fcm_accepted, 0) AS fcm_accepted, COALESCE(d.webpush_accepted, 0) AS webpush_accepted,
      COALESCE(d.fcm_failed, 0) AS fcm_failed, COALESCE(d.webpush_failed, 0) AS webpush_failed,
      COALESCE(d.fcm_skipped, 0) AS fcm_skipped, COALESCE(d.webpush_skipped, 0) AS webpush_skipped
    FROM recent n LEFT JOIN "user" u ON u.id = n.sender_id
    LEFT JOIN recipients r ON r.notice_id = n.id LEFT JOIN devices d ON d.notice_id = n.id
    ORDER BY n.created_at DESC, n.id DESC`).all<{
    id: string; sender: string; title: string; body: string; audience_label: string; recipient_count: number
    created_at: string; finished_at: string | null; failed_at: string | null; in_app: number; skipped: number
    no_fcm: number; no_webpush: number; fcm_accepted: number; webpush_accepted: number
    fcm_failed: number; webpush_failed: number; fcm_skipped: number; webpush_skipped: number
  }>()
  return result.results || []
}
