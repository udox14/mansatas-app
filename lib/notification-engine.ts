import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getDB } from '@/utils/db-server'
import { currentTimeWIB, nowWIB, todayWIB } from '@/lib/time'
import { ensureSchemaOnce } from '@/lib/schema-guard'
import {
  defaultNotificationSettings,
  ATTENDANCE_CORRECTION_REQUEST_EVENT,
  ATTENDANCE_CORRECTION_RESULT_EVENT,
  KELAS_BINAAN_NOTIFICATION_EVENTS,
  getNotificationDefinition,
  NOTIFICATION_EVENT_DEFINITIONS,
  type NotificationChannel,
  type NotificationEventDefinition,
  type NotificationReminderConfig,
  type NotificationTargetConfig,
} from '@/lib/notification-catalog'
import { sendFcmNotification, type FcmRuntimeOptions, type FcmTarget, type FcmNotif } from '@/lib/fcm'
import { sendPushNotification } from '@/lib/web-push'
import { getFinalAttendanceForClass } from '@/lib/wali-kelas-attendance'
import { attendanceNoticeActivation, attendanceDateEligible, utcSourceTimestamp, teacherNoticeStillValid, effectiveInitialAttendanceStatus, initialAttendanceContext, readAttendanceNoticeState } from '@/lib/attendance-notice-state'
import { ATTENDANCE_DELAY_DEFAULTS, attendanceDelayMinutes, validAttendanceDelay } from '@/lib/attendance-notification-delay'
import { attendanceStatusLabel } from '@/lib/attendance-status'
import { parentDailyReason } from '@/lib/parent-attendance-presentation'
import { ensureStaffNotificationInbox, writeStaffNotifications } from '@/lib/staff-notification-inbox'
import { invalidateAttendanceCache } from '@/lib/attendance-cache'
import { getKalenderDateStatus, getKbmExceptionsForDate, hasActiveTeachingSlotsInRange } from '@/lib/kalender-pendidikan'
import type { PolaJam, SlotJam } from '@/app/dashboard/settings/types'
import { formatNamaKelas, formatRupiah } from '@/lib/utils'
import { KOMITE_REVIEW_REMINDER_EVENT, komiteReminderSlot, komiteReminderSource, pendingKomiteReminders,
  komiteReminderRecipients, validKomiteReminderRecipients, type KomiteReminderValidation } from '@/lib/komite-review-reminders'
import { stageForStatus } from '@/lib/komite-pengajuan'
import { attendanceCorrectionNotificationRecipients } from '@/lib/attendance-correction-reviewer'

export const NOTIFICATION_DIRECT_RECIPIENT_LIMIT = 25

export type NotificationContext = Record<string, unknown>

export type NotificationSetting = {
  event_key: string
  enabled: number
  title_template: string
  body_template: string
  url_template: string
  channels_json: string
  target_json: string
  reminder_json: string
  level: string
  updated_by?: string | null
  updated_at?: string | null
}

export type NotificationQueueMessage = {
  dispatchId: string
  eventKey: string
  sourceRef: string
  title: string
  body: string
  url: string
  image?: string
  channels: NotificationChannel[]
  target: {
    kind: 'staff_users' | 'parent_students'
    ids: string[]
  }
  parentType: string
  level: string
  dsptWork?: { cursor: string; end?: string; step: number }
  validation?: KomiteReminderValidation | {
    kind: 'attendance_correction_review'
    requestId: string
  } | {
    kind: 'attendance_correction_result'
    decisionId: string
  } | {
    kind: 'attendance_work'
    tanggal: string
    kelasId: string
    penugasanId?: string
    siswaIds: string[]
    notifyIds: string[]
  } | {
    kind: 'attendance_status'
    tanggal: string
    status: 'ALFA' | 'SAKIT' | 'IZIN'
  } | {
    kind: 'attendance_homeroom_session'
    siswaId: string
    tanggal: string
    status: string
    penugasanId: string
    sourceUpdatedAt: string
    dueAt?: string
  } | {
    kind: 'attendance_session' | 'attendance_daily'
    siswaId: string
    tanggal: string
    status: string
    revision: number
    penugasanId?: string
    sourceUpdatedAt?: string
  }
}

export type EmitConfiguredNotificationInput = {
  eventKey: string
  sourceRef: string
  context?: NotificationContext
  targetOverride?: NotificationTargetConfig
  db?: D1Database
  runtimeEnv?: FcmRuntimeOptions['env']
  parentType?: string
  delaySeconds?: number
  validation?: NotificationQueueMessage['validation']
}

export type NotificationDispatchResult = {
  status: 'disabled' | 'skipped' | 'queued' | 'sent' | 'failed'
  sent: number
  queued: number
  dispatchIds: string[]
  error?: string
}

type ExpandedAudience = 'staff' | 'parent'

type ExpandedTarget = {
  audience: ExpandedAudience
  ids: string[]
}

type DeliveryResult = {
  ok: boolean
  retryable: boolean
  sent: number
  errors: string[]
}

export type DispatchRawNotificationInput = {
  eventKey?: string
  sourceRef: string
  title: string
  body: string
  url?: string
  image?: string
  channels: NotificationChannel[]
  target: NotificationTargetConfig
  context?: NotificationContext
  db?: D1Database
  runtimeEnv?: FcmRuntimeOptions['env']
  parentType?: string
  level?: 'info' | 'warning' | 'critical'
}

type QueueBinding = {
  send: (body: NotificationQueueMessage, options?: { contentType?: 'json'; delaySeconds?: number }) => Promise<void>
}

const notificationSchemaPromiseByDb = new WeakMap<object, Promise<void>>()
const notificationSettingCacheByDb = new WeakMap<object, Map<string, { value: NotificationSetting; expiresAt: number }>>()
const NOTIFICATION_SETTING_CACHE_TTL_MS = 15_000

function jsonParse<T>(raw: string | null | undefined, fallback: T): T {
  try {
    const parsed = JSON.parse(raw || '')
    return parsed as T
  } catch {
    return fallback
  }
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function renderNotificationTemplate(template: string, context: NotificationContext, allowed: string[]) {
  const allowedSet = new Set(allowed)
  return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (full, key: string) => {
    if (!allowedSet.has(key)) throw new Error(`Placeholder not valid untuk event ini: {${key}}`)
    return asText(context[key])
  })
}

export function validateNotificationTemplate(template: string, allowed: string[]) {
  const unknown = new Set<string>()
  for (const match of String(template || '').matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
    if (!allowed.includes(match[1])) unknown.add(match[1])
  }
  return [...unknown]
}

export function validateNotificationUrl(url: string) {
  return (url.startsWith('/') && !url.startsWith('//')) || /^https:\/\//i.test(url)
}

function normalizeChannels(raw: string | undefined, fallback: NotificationChannel[]) {
  const allowed: NotificationChannel[] = ['fcm', 'webpush', 'in_app']
  const parsed = jsonParse<unknown[]>(raw, fallback)
  const channels = Array.isArray(parsed)
    ? parsed.filter((channel): channel is NotificationChannel => allowed.includes(channel as NotificationChannel))
    : []
  return channels.length > 0 ? [...new Set(channels)] : fallback
}

function normalizeTarget(raw: string | undefined, fallback: NotificationTargetConfig): NotificationTargetConfig {
  const parsed = jsonParse<Partial<NotificationTargetConfig>>(raw, fallback)
  if (!parsed || typeof parsed !== 'object' || typeof parsed.kind !== 'string') return fallback
  const validKinds = new Set([
    'staff_role', 'staff_all', 'staff_users', 'parent_student', 'parent_students',
    'parent_class', 'parent_grade', 'parents_all',
  ])
  if (!validKinds.has(parsed.kind)) return fallback
  return {
    kind: parsed.kind as NotificationTargetConfig['kind'],
    value: parsed.value ?? null,
    ids: Array.isArray(parsed.ids) ? parsed.ids.map(String).filter(Boolean) : undefined,
  }
}

function normalizeReminder(raw: string | undefined, fallback: NotificationReminderConfig): NotificationReminderConfig {
  const parsed = jsonParse<Partial<NotificationReminderConfig>>(raw, fallback)
  return {
    enabled: Boolean(parsed.enabled),
    leadMinutes: Number.isFinite(Number(parsed.leadMinutes)) ? Math.max(0, Number(parsed.leadMinutes)) : fallback.leadMinutes,
    frequencyMinutes: Number.isFinite(Number(parsed.frequencyMinutes)) ? Math.max(5, Number(parsed.frequencyMinutes)) : fallback.frequencyMinutes,
    daysBefore: Number.isFinite(Number(parsed.daysBefore)) ? Math.max(0, Number(parsed.daysBefore)) : fallback.daysBefore,
    windowStart: typeof parsed.windowStart === 'string' ? parsed.windowStart : fallback.windowStart,
    ...(validAttendanceDelay(parsed.delayMinutes) ? { delayMinutes: parsed.delayMinutes } : {}),
    windowEnd: typeof parsed.windowEnd === 'string' ? parsed.windowEnd : fallback.windowEnd,
  }
}

async function ensureNotificationSchema(db: D1Database) {
  const key = db as unknown as object
  const existing = notificationSchemaPromiseByDb.get(key)
  if (existing) return existing

  const promise = ensureSchemaOnce('notification-engine-v10-komite-verifier', async () => {
    await db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS notification_event_settings (
          event_key TEXT PRIMARY KEY,
          enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
          title_template TEXT NOT NULL,
          body_template TEXT NOT NULL,
          url_template TEXT NOT NULL DEFAULT '/dashboard',
          channels_json TEXT NOT NULL DEFAULT '["fcm"]',
          target_json TEXT NOT NULL DEFAULT '{}',
          reminder_json TEXT NOT NULL DEFAULT '{}',
          level TEXT NOT NULL DEFAULT 'info',
          updated_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS notification_dispatches (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          dedup_key TEXT NOT NULL UNIQUE,
          event_key TEXT NOT NULL,
          source_ref TEXT NOT NULL,
          target_scope TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','sent','failed')),
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          queued_at TEXT NOT NULL DEFAULT (datetime('now')),
          sent_at TEXT,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_notification_dispatch_status ON notification_dispatches(status, updated_at)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_notification_dispatch_event ON notification_dispatches(event_key, source_ref)'),
    ])

    const columns = await db.prepare('PRAGMA table_info(notification_dispatches)').all<{ name: string }>()
    const names = new Set((columns.results || []).map(c => c.name))
    for (const name of ['payload_json', 'available_at', 'enqueued_at', 'enqueue_claim_until']) {
      if (!names.has(name)) await db.prepare(`ALTER TABLE notification_dispatches ADD COLUMN ${name} TEXT`).run()
    }
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_notification_outbox_due ON notification_dispatches(enqueued_at, available_at)').run()

    const rows = NOTIFICATION_EVENT_DEFINITIONS.map((definition) => {
      const settings = defaultNotificationSettings(definition)
      return db.prepare(`
        INSERT OR IGNORE INTO notification_event_settings
          (event_key, enabled, title_template, body_template, url_template, channels_json, target_json, reminder_json, level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        settings.event_key,
        settings.enabled,
        settings.title_template,
        settings.body_template,
        settings.url_template,
        settings.channels_json,
        settings.target_json,
        settings.reminder_json,
        settings.level,
      )
    })
    for (let i = 0; i < rows.length; i += 50) await db.batch(rows.slice(i, i + 50))
    const waliDefinition = getNotificationDefinition('attendance_homeroom_alert')!
    await ensureStaffNotificationInbox(db)
    await db.prepare(`UPDATE notification_event_settings SET channels_json = json_insert(channels_json, '$[#]', 'in_app')
      WHERE event_key IN (${KELAS_BINAAN_NOTIFICATION_EVENTS.map(() => '?').join(',')}) AND json_valid(channels_json)
      AND NOT EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(channels_json) THEN channels_json ELSE '[]' END) WHERE value = 'in_app')`)
      .bind(...KELAS_BINAAN_NOTIFICATION_EVENTS).run()
    await db.prepare(`UPDATE notification_event_settings SET url_template = ? WHERE event_key = 'attendance_homeroom_alert' AND url_template = ?`)
      .bind(waliDefinition.defaultUrl, '/dashboard/kelas-binaan?view=keputusan&kelas={kelasId}&tanggal={tanggal}').run()
    const parentDefinition = getNotificationDefinition('attendance_parent_alert')!
    await db.prepare(`UPDATE notification_event_settings SET body_template = ? WHERE event_key = 'attendance_parent_alert' AND body_template = ? AND title_template = ?`)
      .bind(parentDefinition.defaultBody, 'Pada {tanggal}, pelajaran {mapel}, jam {rentang_jam}, Ananda {nama_siswa} tercatat {keterangan_status}. Ini merupakan catatan sesi pembelajaran. Rekap harian tersedia setelah pembelajaran selesai.', parentDefinition.defaultTitle).run()

    // Upgrade only untouched defaults; keep custom templates and delivery preferences.
    const oldBodies = [
      ['komite_final_approved', 'Pengajuan "{judul_pengajuan}" telah disetujui sampai tahap Kepala Madrasah. SPB {nomor_spb} sudah tersedia.'],
      ['attendance_parent_alert', 'Ananda {nama_siswa} tercatat ALFA oleh guru pada {tanggal}. Rekap kehadiran harian masih diproses; silakan buka Portal Orang Tua untuk rincian.'],
      ['attendance_daily_final', 'Rekap kehadiran Ananda {nama_siswa} pada {tanggal} telah selesai. Status akhir: {status_kehadiran}.'],
      ['attendance_daily_final', 'Pembelajaran pada {tanggal} telah selesai. Berdasarkan catatan yang tersedia, status harian Ananda {nama_siswa}: {status_kehadiran}.{kelengkapan} Rincian sesi tersedia di Portal Orang Tua.'],
      ['attendance_daily_update', 'Rekap kehadiran Ananda {nama_siswa} pada {tanggal} telah diperbarui. Berdasarkan catatan terbaru, status harian: {status_kehadiran}.{kelengkapan} Rincian tersedia di Portal Orang Tua.'],
    ] as const
    for (const [key, oldBody] of oldBodies) {
      const definition = getNotificationDefinition(key)!
      await db.prepare(`UPDATE notification_event_settings
        SET body_template = ?, level = CASE WHEN event_key = 'attendance_parent_alert' AND level = 'warning' AND updated_by IS NULL THEN 'info' ELSE level END,
          updated_at = datetime('now')
        WHERE event_key = ? AND body_template = ? AND title_template = ?`)
        .bind(definition.defaultBody, key, oldBody, definition.defaultTitle).run()
    }
  })

  notificationSchemaPromiseByDb.set(key, promise)
  try {
    await promise
  } catch (error) {
    notificationSchemaPromiseByDb.delete(key)
    throw error
  }
  return promise
}

export async function getNotificationSettings(db?: D1Database): Promise<NotificationSetting[]> {
  const database = db || await getDB()
  await ensureNotificationSchema(database)
  const result = await database.prepare('SELECT * FROM notification_event_settings ORDER BY event_key').all<NotificationSetting>()
  return result.results || []
}

export async function getNotificationSetting(eventKey: string, db?: D1Database) {
  const definition = getNotificationDefinition(eventKey)
  if (!definition) return null
  const database = db || await getDB()
  await ensureNotificationSchema(database)
  const cacheKey = database as unknown as object
  const cache = notificationSettingCacheByDb.get(cacheKey)
  const cached = cache?.get(eventKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  const row = await database.prepare('SELECT * FROM notification_event_settings WHERE event_key = ?').bind(eventKey).first<NotificationSetting>()
  const value = row || {
    ...defaultNotificationSettings(definition),
    updated_by: null,
    updated_at: null,
  } as NotificationSetting
  const nextCache = cache || new Map<string, { value: NotificationSetting; expiresAt: number }>()
  nextCache.set(eventKey, { value, expiresAt: Date.now() + NOTIFICATION_SETTING_CACHE_TTL_MS })
  notificationSettingCacheByDb.set(cacheKey, nextCache)
  return value
}

export async function saveNotificationSetting(
  eventKey: string,
  patch: {
    enabled: boolean
    titleTemplate: string
    bodyTemplate: string
    urlTemplate: string
    channels: NotificationChannel[]
    target: NotificationTargetConfig
    reminder: NotificationReminderConfig
    level: string
    updatedBy?: string | null
  },
  db?: D1Database,
) {
  const definition = getNotificationDefinition(eventKey)
  if (!definition) return { error: 'Event notifikasi tidak dikenal.' }
  const database = db || await getDB()
  await ensureNotificationSchema(database)

  const title = patch.titleTemplate.trim()
  const body = patch.bodyTemplate.trim()
  const url = patch.urlTemplate.trim() || '/dashboard'
  if (!title || !body) return { error: 'Judul dan isi notifikasi wajib diisi.' }
  if (title.length > 160 || body.length > 2000) return { error: 'Judul/isi notifikasi terlalu panjang.' }
  if (!validateNotificationUrl(url)) return { error: 'URL harus berupa path internal atau HTTPS.' }

  const unknown = [
    ...validateNotificationTemplate(title, definition.placeholders),
    ...validateNotificationTemplate(body, definition.placeholders),
    ...validateNotificationTemplate(url, definition.placeholders),
  ]
  if (unknown.length > 0) return { error: `Placeholder tidak dikenal: ${[...new Set(unknown)].map((v) => `{${v}}`).join(', ')}` }

  const channels = [...new Set(patch.channels.filter((channel) => ['fcm', 'webpush', 'in_app'].includes(channel)))]
  if (channels.length === 0) return { error: 'Pilih minimal satu channel notifikasi.' }
  if (!['info', 'warning', 'critical'].includes(patch.level)) return { error: 'Level notifikasi tidak valid.' }

  if (eventKey === KOMITE_REVIEW_REMINDER_EVENT) {
    const clock = /^([01]\d|2[0-3]):[0-5]\d$/
    if (!Number.isInteger(patch.reminder.frequencyMinutes) || patch.reminder.frequencyMinutes < 5) {
      return { error: 'Frekuensi reminder harus berupa menit bulat, minimal 5 menit.' }
    }
    if (!clock.test(patch.reminder.windowStart || '') || !clock.test(patch.reminder.windowEnd || '') ||
      patch.reminder.windowStart! >= patch.reminder.windowEnd!) {
      return { error: 'Jam reminder WIB harus valid dan jam selesai harus setelah jam mulai.' }
    }
    if (channels.includes('in_app')) return { error: 'Reminder reviewer Komite menggunakan FCM atau Web Push.' }
  }

  const target = normalizeTarget(JSON.stringify(patch.target), definition.defaultTarget)
  if (eventKey in ATTENDANCE_DELAY_DEFAULTS && patch.reminder.delayMinutes !== undefined && !validAttendanceDelay(patch.reminder.delayMinutes)) {
    return { error: 'Jeda pengiriman harus berupa menit bulat antara 0 dan 60.' }
  }
  const reminder = normalizeReminder(JSON.stringify(patch.reminder), definition.reminder)
  await database.prepare(`
    INSERT INTO notification_event_settings
      (event_key, enabled, title_template, body_template, url_template, channels_json, target_json, reminder_json, level, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(event_key) DO UPDATE SET
      enabled = excluded.enabled,
      title_template = excluded.title_template,
      body_template = excluded.body_template,
      url_template = excluded.url_template,
      channels_json = excluded.channels_json,
      target_json = excluded.target_json,
      reminder_json = excluded.reminder_json,
      level = excluded.level,
      updated_by = excluded.updated_by,
      updated_at = datetime('now')
  `).bind(
    eventKey,
    patch.enabled ? 1 : 0,
    title,
    body,
    url,
    JSON.stringify(channels),
    JSON.stringify(target),
    JSON.stringify(reminder),
    patch.level,
    patch.updatedBy || null,
  ).run()

  notificationSettingCacheByDb.get(database as unknown as object)?.delete(eventKey)

  return { success: true }
}

export async function resetNotificationSetting(eventKey: string, updatedBy?: string | null, db?: D1Database) {
  const definition = getNotificationDefinition(eventKey)
  if (!definition) return { error: 'Event notifikasi tidak dikenal.' }
  const database = db || await getDB()
  const settings = defaultNotificationSettings(definition)
  await ensureNotificationSchema(database)
  await database.prepare(`
    UPDATE notification_event_settings
    SET enabled = ?, title_template = ?, body_template = ?, url_template = ?, channels_json = ?, target_json = ?, reminder_json = ?, level = ?, updated_by = ?, updated_at = datetime('now')
    WHERE event_key = ?
  `).bind(
    settings.enabled,
    settings.title_template,
    settings.body_template,
    settings.url_template,
    settings.channels_json,
    settings.target_json,
    settings.reminder_json,
    settings.level,
    updatedBy || null,
    eventKey,
  ).run()
  notificationSettingCacheByDb.get(database as unknown as object)?.delete(eventKey)
  return { success: true }
}

async function getQueue(): Promise<QueueBinding | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return ((env as unknown as { NOTIFICATION_QUEUE?: QueueBinding }).NOTIFICATION_QUEUE) || null
  } catch {
    return null
  }
}

async function expandTarget(
  db: D1Database,
  target: NotificationTargetConfig,
  context: NotificationContext,
): Promise<ExpandedTarget | null> {
  const idsFromContext = (key: string) => {
    const value = context[key]
    return Array.isArray(value) ? value.map(String).filter(Boolean) : []
  }

  switch (target.kind) {
    case 'staff_users': {
      const ids = idsFromContext('userIds')
      if (ids.length > 0) return { audience: 'staff', ids: [...new Set(ids)].sort() }
      const userId = asText(context.userId)
      return userId ? { audience: 'staff', ids: [userId] } : null
    }
    case 'staff_role': {
      const role = asText(target.value)
      if (!role) return null
      const result = await db.prepare(`
        SELECT DISTINCT u.id
        FROM "user" u
        WHERE u.banned = 0 AND (
          LOWER(u.role) = LOWER(?)
          OR u.id IN (SELECT user_id FROM user_roles WHERE LOWER(role) = LOWER(?))
        )
        ORDER BY u.id
      `).bind(role, role).all<{ id: string }>()
      return { audience: 'staff', ids: (result.results || []).map((row) => row.id) }
    }
    case 'staff_all': {
      const result = await db.prepare('SELECT id FROM "user" WHERE banned = 0 ORDER BY id').all<{ id: string }>()
      return { audience: 'staff', ids: (result.results || []).map((row) => row.id) }
    }
    case 'parent_student': {
      const siswaId = asText(context.siswaId)
      return siswaId ? { audience: 'parent', ids: [siswaId] } : null
    }
    case 'parent_students': {
      const ids = idsFromContext('siswaIds')
      return ids.length > 0 ? { audience: 'parent', ids: [...new Set(ids)].sort() } : null
    }
    case 'parent_class': {
      const kelasId = asText(context.kelasId || target.value)
      if (!kelasId) return null
      const result = await db.prepare(`SELECT id FROM siswa WHERE status = 'aktif' AND kelas_id = ? ORDER BY id`).bind(kelasId).all<{ id: string }>()
      return { audience: 'parent', ids: (result.results || []).map((row) => row.id) }
    }
    case 'parent_grade': {
      const tingkat = Number(context.tingkat || target.value)
      if (!Number.isFinite(tingkat)) return null
      const result = await db.prepare(`
        SELECT s.id
        FROM siswa s
        JOIN kelas k ON k.id = s.kelas_id
        WHERE s.status = 'aktif' AND CAST(k.tingkat AS INTEGER) = ?
        ORDER BY s.id
      `).bind(tingkat).all<{ id: string }>()
      return { audience: 'parent', ids: (result.results || []).map((row) => row.id) }
    }
    case 'parents_all': {
      const result = await db.prepare(`SELECT id FROM siswa WHERE status = 'aktif' ORDER BY id`).all<{ id: string }>()
      return { audience: 'parent', ids: (result.results || []).map((row) => row.id) }
    }
    default:
      return null
  }
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

function targetForChunk(audience: ExpandedAudience, ids: string[]): FcmTarget {
  return audience === 'staff' ? { userIds: ids } : { siswaIds: ids }
}

function queueTarget(audience: ExpandedAudience, ids: string[]): NotificationQueueMessage['target'] {
  return audience === 'staff'
    ? { kind: 'staff_users', ids }
    : { kind: 'parent_students', ids }
}

function targetScope(audience: ExpandedAudience, ids: string[]) {
  return `${audience}:${ids.join(',')}`
}

async function claimDispatch(db: D1Database, eventKey: string, sourceRef: string, scope: string) {
  const dedupKey = `${eventKey}:${sourceRef}:${scope}`
  const id = crypto.randomUUID()
  const result = await db.prepare(`
    INSERT OR IGNORE INTO notification_dispatches
      (id, dedup_key, event_key, source_ref, target_scope, status, queued_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'queued', datetime('now'), datetime('now'))
  `).bind(id, dedupKey, eventKey, sourceRef, scope).run()
  if (!result.meta?.changes) {
    if (!sourceRef.startsWith('attendance-') || !sourceRef.includes('-v2:')) return null
    const retried = await db.prepare(`UPDATE notification_dispatches SET status = 'queued', updated_at = datetime('now')
      WHERE dedup_key = ? AND status = 'failed' RETURNING id`).bind(dedupKey).first<{ id: string }>()
    return retried ? { id: retried.id, dedupKey } : null
  }
  return { id, dedupKey }
}

async function markDispatch(db: D1Database, id: string, status: 'processing' | 'sent' | 'failed', error?: string) {
  await db.prepare(`
    UPDATE notification_dispatches
    SET status = ?, attempts = attempts + CASE WHEN ? = 'processing' THEN 1 ELSE 0 END,
        last_error = ?, sent_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE sent_at END,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(status, status, error || null, status, id).run()
}

function isStaffTarget(target: FcmTarget) {
  return Boolean(target.userId || target.userIds || target.role || target.all)
}

function isRetryableDeliveryError(value: unknown) {
  const text = value instanceof Error ? value.message : String(value || '')
  return /429|quota|timeout|temporar|5\d\d|network|fetch/i.test(text)
}

async function writeParentNotifications(
  db: D1Database,
  siswaIds: string[],
  eventKey: string,
  sourceRef: string,
  title: string,
  body: string,
  level: string,
  parentType: string,
) {
  if (siswaIds.length === 0) return
  const statements = siswaIds.map((siswaId) => db.prepare(`
    INSERT OR IGNORE INTO parent_notifications (siswa_id, type, title, message, source_ref, level)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(siswaId, parentType || eventKey, title, body, sourceRef, level))
  for (let i = 0; i < statements.length; i += 100) await db.batch(statements.slice(i, i + 100))
}

export async function getStudentNotificationContext(db: D1Database, siswaId: string) {
  const row = await db.prepare(`
    SELECT s.id AS siswa_id, s.nama_lengkap, s.kelas_id,
           k.tingkat, k.nomor_kelas, k.kelompok
    FROM siswa s
    LEFT JOIN kelas k ON k.id = s.kelas_id
    WHERE s.id = ?
    LIMIT 1
  `).bind(siswaId).first<{
    siswa_id: string
    nama_lengkap: string
    kelas_id: string | null
    tingkat: string | number | null
    nomor_kelas: string | number | null
    kelompok: string | null
  }>()
  if (!row) return null
  const kelas = [row.tingkat, row.nomor_kelas, row.kelompok]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ')
  return {
    siswaId: row.siswa_id,
    nama_siswa: row.nama_lengkap,
    kelas,
    kelasId: row.kelas_id,
    tingkat: row.tingkat,
  }
}

type AttendanceCandidate = {
  siswa_id: string; status: string; nama_lengkap: string; penugasan_id: string
  updated_at: string; nama_mapel: string; jam_ke_mulai: number; jam_ke_selesai: number
}

export async function notifyParentsAttendanceConfigured(
  db: D1Database,
  options: { penugasanId: string; tanggal: string; siswaIds?: string[]; notifyHomeroom?: boolean },
) {
  await ensureNotificationSchema(db)
  const activation = await attendanceNoticeActivation(db)
  if (!attendanceDateEligible(options.tanggal, activation)) return { notified: 0, students: 0 }
  const setting = await getNotificationSetting('attendance_parent_alert', db)
  const parentEnabled = !!setting && Number(setting.enabled) === 1
  const homeroomSetting = await getNotificationSetting('attendance_homeroom_alert', db)
  const homeroomEnabled = !!homeroomSetting && Number(homeroomSetting.enabled) === 1
  if (!parentEnabled && !homeroomEnabled) return { notified: 0, students: 0, disabled: true }
  const assignment = await db.prepare('SELECT kelas_id FROM penugasan_mengajar WHERE id = ?').bind(options.penugasanId).first<{ kelas_id: string }>()
  if (!assignment) return { notified: 0, students: 0 }
  const selectedIds = options.siswaIds ? [...new Set(options.siswaIds)] : undefined
  if (selectedIds?.length === 0) return { notified: 0, students: 0 }
  const data = await getFinalAttendanceForClass(db, assignment.kelas_id, options.tanggal, options.tanggal, { siswaIds: selectedIds, fresh: true })
  const rows = await db.prepare(`
    SELECT ab.siswa_id, ab.status, s.nama_lengkap, ab.penugasan_id, ab.updated_at,
      mp.nama_mapel, ab.jam_ke_mulai, ab.jam_ke_selesai
    FROM absensi_siswa ab
    JOIN siswa s ON s.id = ab.siswa_id
    JOIN penugasan_mengajar pm ON pm.id = ab.penugasan_id
    JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
    WHERE pm.kelas_id = ? AND s.kelas_id = pm.kelas_id AND s.status = 'aktif'
      AND ab.tanggal = ? AND ab.status IN ('ALFA','SAKIT','IZIN')
      ${selectedIds ? `AND ab.siswa_id IN (${selectedIds.map(() => '?').join(',')})` : ''}
      AND julianday(ab.updated_at) >= julianday(?)
    ORDER BY julianday(ab.updated_at), ab.penugasan_id, ab.siswa_id
  `).bind(assignment.kelas_id, options.tanggal, ...(selectedIds || []), activation).all<AttendanceCandidate>()
  const wali = homeroomEnabled ? await db.prepare(`SELECT u.id FROM kelas k
    JOIN "user" u ON u.id = k.wali_kelas_id AND COALESCE(u.banned, 0) = 0
    WHERE k.id = ?`).bind(assignment.kelas_id).first<{ id: string }>() : null
  let queued = 0
  for (const candidate of rows.results || []) {
    const day = data?.statusByStudent.get(candidate.siswa_id)?.[0]
    if (!effectiveInitialAttendanceStatus(day, candidate.penugasan_id, candidate.status)) continue
    // Staff reports are independent of the parent's one-report-per-day state.
    if (wali?.id && candidate.penugasan_id === options.penugasanId && options.notifyHomeroom !== false && teacherNoticeStillValid(day, candidate.penugasan_id, candidate.status)) {
      const due = Date.parse(utcSourceTimestamp(candidate.updated_at)) + attendanceDelayMinutes('attendance_homeroom_alert', homeroomSetting?.reminder_json) * 60_000
      const result = await emitConfiguredNotification({
        eventKey: 'attendance_homeroom_alert', db,
        sourceRef: `attendance-homeroom-v2:${candidate.siswa_id}:${options.tanggal}:${candidate.penugasan_id}:${candidate.status}:${candidate.updated_at}`,
        delaySeconds: Math.max(0, Math.ceil((due - Date.now()) / 1000)),
        targetOverride: { kind: 'staff_users' },
        context: { userId: wali.id, siswaId: candidate.siswa_id, penugasanId: candidate.penugasan_id, nama_siswa: candidate.nama_lengkap,
          kelas: data?.kelas.label || '', kelasId: assignment.kelas_id, tanggal: options.tanggal,
          status_kehadiran: attendanceStatusLabel(candidate.status), mapel: candidate.nama_mapel,
          rentang_jam: `${candidate.jam_ke_mulai}–${candidate.jam_ke_selesai}`,
          keterangan_status: initialAttendanceContext(candidate.status) },
        validation: { kind: 'attendance_homeroom_session', siswaId: candidate.siswa_id,
          tanggal: options.tanggal, penugasanId: candidate.penugasan_id,
          status: candidate.status, sourceUpdatedAt: candidate.updated_at, dueAt: new Date(due).toISOString() },
      })
      queued += result.queued
    }
    if (!parentEnabled) continue
    await db.prepare(`INSERT OR IGNORE INTO attendance_parent_notice_state (siswa_id, tanggal) VALUES (?, ?)`)
      .bind(candidate.siswa_id, options.tanggal).run()
    let state = await readAttendanceNoticeState(db, candidate.siswa_id, options.tanggal)
    if (!state || state.initial_sent_at) continue
    const signature = `${candidate.penugasan_id}:${candidate.status}:${candidate.updated_at}`
    if (state.initial_ref && state.initial_candidate !== signature) {
      const previous = (rows.results || []).find(row => row.siswa_id === candidate.siswa_id &&
        `${row.penugasan_id}:${row.status}:${row.updated_at}` === state!.initial_candidate)
      if (previous && effectiveInitialAttendanceStatus(day, previous.penugasan_id, previous.status)) continue
      // Also recover candidates whose enqueue failed: there may be no consumer to cancel them.
      await db.prepare(`UPDATE attendance_parent_notice_state SET initial_ref = NULL, initial_due_at = NULL
        WHERE siswa_id = ? AND tanggal = ? AND initial_sent_at IS NULL AND initial_ref = ?`)
        .bind(candidate.siswa_id, options.tanggal, state.initial_ref).run()
      state = await readAttendanceNoticeState(db, candidate.siswa_id, options.tanggal)
    }
    if (!state || state.initial_sent_at) continue
    if (!state.initial_ref) {
      const due = new Date(Date.parse(utcSourceTimestamp(candidate.updated_at)) + attendanceDelayMinutes('attendance_parent_alert', setting?.reminder_json) * 60_000).toISOString()
      state = await db.prepare(`UPDATE attendance_parent_notice_state
        SET initial_revision = initial_revision + 1,
          initial_ref = 'attendance-initial-v2:' || siswa_id || ':' || tanggal || ':' || (initial_revision + 1),
          initial_candidate = ?, initial_due_at = ?
        WHERE siswa_id = ? AND tanggal = ? AND initial_sent_at IS NULL AND initial_ref IS NULL
        RETURNING *`).bind(signature, due, candidate.siswa_id, options.tanggal).first<typeof state>()
    }
    if (!state?.initial_ref || state.initial_candidate !== signature) continue
    const seconds = Math.max(0, Math.ceil((Date.parse(state.initial_due_at!) - Date.now()) / 1000))
    const result = await emitConfiguredNotification({
      eventKey: 'attendance_parent_alert', sourceRef: state.initial_ref, db,
      delaySeconds: seconds, parentType: 'absensi', targetOverride: { kind: 'parent_students' },
      context: { siswaId: candidate.siswa_id, siswaIds: [candidate.siswa_id], nama_siswa: candidate.nama_lengkap,
        status_kehadiran: attendanceStatusLabel(candidate.status), tanggal: options.tanggal,
        mapel: candidate.nama_mapel, rentang_jam: `${candidate.jam_ke_mulai}–${candidate.jam_ke_selesai}`,
        keterangan_status: initialAttendanceContext(candidate.status), sumber_keterangan: 'Ini merupakan catatan sesi pembelajaran.', kelas: data?.kelas.label || '' },
      validation: { kind: 'attendance_session', siswaId: candidate.siswa_id, tanggal: options.tanggal,
        penugasanId: candidate.penugasan_id, status: candidate.status, revision: state.initial_revision,
        sourceUpdatedAt: candidate.updated_at },
    })
    queued += result.queued
  }
  return { notified: queued, students: rows.results?.length || 0 }
}

const FINAL_DAILY_ATTENDANCE_STATUSES = new Set(['HADIR', 'SAKIT', 'IZIN', 'ALFA'])

export async function notifyParentsDailyAttendanceFinal(
  db: D1Database,
  options: { tanggal: string; penugasanId?: string; kelasId?: string; siswaIds?: string[] },
) {
  // Split before preparing IN parameters; D1 permits at most 100 bound values.
  if (options.siswaIds && options.siswaIds.length > 50) {
    let notified = 0, students = 0
    for (let i = 0; i < options.siswaIds.length; i += 50) {
      const result = await notifyParentsDailyAttendanceFinal(db, { ...options, siswaIds: options.siswaIds.slice(i, i + 50) })
      notified += result.notified; students += result.students
    }
    return { notified, students }
  }
  await ensureNotificationSchema(db)
  const activation = await attendanceNoticeActivation(db)
  if (!attendanceDateEligible(options.tanggal, activation)) return { notified: 0, students: 0 }
  const setting = await getNotificationSetting('attendance_daily_final', db)
  if (!setting || Number(setting.enabled) !== 1) return { notified: 0, students: 0, disabled: true }
  const kelasId = options.kelasId || (options.penugasanId
    ? (await db.prepare('SELECT kelas_id FROM penugasan_mengajar WHERE id = ?').bind(options.penugasanId).first<{ kelas_id: string }>())?.kelas_id : null)
  if (!kelasId) return { notified: 0, students: 0 }
  if (options.siswaIds?.length === 0) return { notified: 0, students: 0 }
  const pending = await db.prepare(`SELECT siswa_id, needs_recheck FROM attendance_parent_notice_state WHERE tanggal = ? AND initial_sent_at IS NOT NULL
    AND siswa_id IN (SELECT id FROM siswa WHERE kelas_id = ? AND status = 'aktif')
    ${options.siswaIds ? `AND siswa_id IN (${options.siswaIds.map(() => '?').join(',')})` : ''}`)
    .bind(options.tanggal, kelasId, ...(options.siswaIds || [])).all<{ siswa_id: string; needs_recheck: number }>()
  const pendingIds = (pending.results || []).map(r => r.siswa_id)
  const recheckVersions = new Map((pending.results || []).map(r => [r.siswa_id, r.needs_recheck]))
  if (pendingIds.length === 0) return { notified: 0, students: 0 }
  if (pendingIds.length > 50) {
    let notified = 0
    for (let i = 0; i < pendingIds.length; i += 50) notified += (await notifyParentsDailyAttendanceFinal(db, { ...options, siswaIds: pendingIds.slice(i, i + 50) })).notified
    return { notified, students: pendingIds.length }
  }
  const updateSetting = await getNotificationSetting('attendance_daily_update', db)
  const data = await getFinalAttendanceForClass(db, kelasId, options.tanggal, options.tanggal, { siswaIds: pendingIds, fresh: true })
  if (!data) return { notified: 0, students: 0 }
  const inactiveIds = pendingIds.filter(id => !data.statusByStudent.get(id)?.length)
  if (inactiveIds.length) await db.batch(inactiveIds.map(id => db.prepare(`UPDATE attendance_parent_notice_state SET needs_recheck = 0, next_check_at = NULL
    WHERE tanggal = ? AND siswa_id = ? AND needs_recheck = ?`).bind(options.tanggal, id, recheckVersions.get(id))))
  let queued = 0
  for (const student of data.siswa) {
    const day = data.statusByStudent.get(student.id)?.[0]
    let state = await readAttendanceNoticeState(db, student.id, options.tanggal)
    if (!state?.initial_sent_at) continue
    if (!day?.is_daily_final || !FINAL_DAILY_ATTENDANCE_STATUSES.has(day.status_akhir)) {
      if (options.tanggal < todayWIB()) {
        await db.prepare('UPDATE attendance_parent_notice_state SET needs_recheck = 0, next_check_at = NULL WHERE siswa_id = ? AND tanggal = ? AND needs_recheck = ?').bind(student.id, options.tanggal, recheckVersions.get(student.id)).run()
        continue
      }
      const next = day?.kbm_end_at && Date.parse(day.kbm_end_at) > Date.now() ? new Date(day.kbm_end_at).toISOString() : new Date(Date.now() + 300_000).toISOString()
      await db.prepare('UPDATE attendance_parent_notice_state SET next_check_at = ? WHERE siswa_id = ? AND tanggal = ? AND needs_recheck = ?').bind(next, student.id, options.tanggal, recheckVersions.get(student.id)).run()
      continue
    }
    // The dirty value is a generation counter: do not clear a source change that raced this read.
    await db.prepare('UPDATE attendance_parent_notice_state SET needs_recheck = 0, next_check_at = NULL WHERE siswa_id = ? AND tanggal = ? AND needs_recheck = ?').bind(student.id, options.tanggal, recheckVersions.get(student.id)).run()
    if (state.final_status !== day.status_akhir) {
      // Compare-and-swap provides one revision across cron and simultaneous saves.
      state = await db.prepare(`UPDATE attendance_parent_notice_state
        SET final_revision = final_revision + 1, final_status = ?,
          final_ref = 'attendance-final-v2:' || siswa_id || ':' || tanggal || ':' || (final_revision + 1),
          final_due_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', CASE WHEN final_sent_status IS NULL THEN '+0 seconds' ELSE ? END)
        WHERE siswa_id = ? AND tanggal = ? AND final_revision = ?
        RETURNING *`).bind(day.status_akhir, `+${attendanceDelayMinutes('attendance_daily_update', updateSetting?.reminder_json) * 60} seconds`, student.id, options.tanggal, state.final_revision).first<typeof state>()
    }
    if (!state || state.final_status !== day.status_akhir || state.final_sent_status === day.status_akhir) continue
    const update = state.final_sent_status !== null
    const result = await emitConfiguredNotification({
      eventKey: update ? 'attendance_daily_update' : 'attendance_daily_final', sourceRef: state.final_ref!, db,
      delaySeconds: Math.max(0, Math.ceil((Date.parse(state.final_due_at!) - Date.now()) / 1000)),
      parentType: 'absensi_rekap', targetOverride: { kind: 'parent_students' },
      context: { siswaId: student.id, siswaIds: [student.id], nama_siswa: student.nama_lengkap,
        kelas: data.kelas.label, tanggal: options.tanggal, status_kehadiran: attendanceStatusLabel(day.status_akhir),
        alasan_status: parentDailyReason(day),
        kelengkapan: day.pending_blok > 0 ? ` ${day.pending_blok} sesi pelajaran belum diinput; rekap dapat diperbarui.` : '' },
      validation: { kind: 'attendance_daily', siswaId: student.id, tanggal: options.tanggal,
        status: day.status_akhir, revision: state.final_revision },
    })
    queued += result.queued
  }
  return { notified: queued, students: data.siswa.length }
}

/** Called by the existing five-minute cron. No scan of old attendance history. */
export async function dispatchAttendanceDailyNotices(db: D1Database) {
  await ensureNotificationSchema(db)
  const activation = await attendanceNoticeActivation(db)
  await flushAttendanceNotificationOutbox(db)
  const today = todayWIB()
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const activationDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(activation))
  const minDate = activationDate > yesterday ? activationDate : yesterday
  const rows = await db.prepare(`SELECT n.tanggal, n.siswa_id, s.kelas_id FROM attendance_parent_notice_state n
    JOIN siswa s ON s.id = n.siswa_id
    WHERE n.initial_sent_at IS NOT NULL AND n.needs_recheck > 0
      AND (n.next_check_at IS NULL OR n.next_check_at <= ?)
      AND s.status = 'aktif' AND s.kelas_id IS NOT NULL AND n.tanggal >= ? AND n.tanggal <= ?
    ORDER BY n.next_check_at, n.tanggal, n.siswa_id LIMIT 100`)
    .bind(new Date().toISOString(), minDate, today)
    .all<{ tanggal: string; siswa_id: string; kelas_id: string }>()
  const groups = new Map<string, { tanggal: string; kelasId: string; siswaIds: string[] }>()
  for (const row of rows.results || []) {
    const key = `${row.kelas_id}:${row.tanggal}`
    const group = groups.get(key) || { tanggal: row.tanggal, kelasId: row.kelas_id, siswaIds: [] }
    group.siswaIds.push(row.siswa_id); groups.set(key, group)
  }
  let processed = 0
  for (const group of groups.values()) processed += (await notifyParentsDailyAttendanceFinal(db, group)).notified

  return { processed }
}

export async function notifyParentsGradeAvailable(
  db: D1Database,
  options: { siswaIds: string[]; jenisNilai: string; semester: string; tanggal?: string },
) {
  const ids = [...new Set(options.siswaIds.map(String).filter(Boolean))]
  if (ids.length === 0) return { notified: 0, students: 0 }
  const setting = await getNotificationSetting('grade_available', db)
  if (!setting || Number(setting.enabled) !== 1) return { notified: 0, students: 0, disabled: true }

  let students = 0
  let notified = 0
  const studentRows: any[] = []
  for (let start = 0; start < ids.length; start += 100) {
    const chunkIds = ids.slice(start, start + 100)
    const placeholders = chunkIds.map(() => '?').join(',')
    const rows = await db.prepare(`
      SELECT s.id AS siswa_id, s.nama_lengkap, k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE s.status = 'aktif' AND s.id IN (${placeholders})
    `).bind(...chunkIds).all<any>()
    studentRows.push(...(rows.results || []))
  }

  const configuredTarget = normalizeTarget(setting.target_json, { kind: 'parent_students' })
  if (studentRows.length > NOTIFICATION_DIRECT_RECIPIENT_LIMIT && configuredTarget.kind === 'parent_students') {
    const result = await emitConfiguredNotification({
      eventKey: 'grade_available',
      sourceRef: `grade-available:${options.semester}:${options.jenisNilai}`,
      context: {
        siswaIds: studentRows.map((row) => row.siswa_id),
        nama_siswa: 'siswa',
        jenis_nilai: options.jenisNilai,
        semester: options.semester,
        tanggal: options.tanggal || todayWIB(),
      },
      targetOverride: { kind: 'parent_students' },
      db,
      parentType: 'nilai',
    })
    return { notified: result.sent, students: studentRows.length }
  }

  for (const row of studentRows) {
    const kelas = [row.tingkat, row.nomor_kelas, row.kelompok].filter(Boolean).join(' ')
    const result = await emitConfiguredNotification({
      eventKey: 'grade_available',
      sourceRef: `grade-available:${row.siswa_id}:${options.semester}:${options.jenisNilai}`,
      context: {
        siswaId: row.siswa_id,
        siswaIds: [row.siswa_id],
        nama_siswa: row.nama_lengkap,
        kelas,
        jenis_nilai: options.jenisNilai,
        semester: options.semester,
        tanggal: options.tanggal || todayWIB(),
      },
      db,
      parentType: 'nilai',
    })
    students += 1
    notified += result.sent
  }
  return { notified, students }
}

async function deliverNotification(
  db: D1Database,
  runtimeEnv: FcmRuntimeOptions['env'] | undefined,
  message: Pick<NotificationQueueMessage, 'eventKey' | 'title' | 'body' | 'url' | 'image' | 'channels' | 'parentType' | 'level'>,
  audience: ExpandedAudience,
  ids: string[],
  sourceRef: string,
): Promise<DeliveryResult> {
  const target = targetForChunk(audience, ids)
  const notification: FcmNotif = { title: message.title, body: message.body, url: message.url, image: message.image }
  let sent = 0
  let attemptedChannels = 0
  let successfulChannels = 0
  let retryable = false
  const errors: string[] = []

  if (message.channels.includes('fcm')) {
    attemptedChannels += 1
    try {
      const result = await sendFcmNotification(notification, target, { db, env: runtimeEnv })
      const channelSent = Number((result as any).sent || 0)
      sent += channelSent
      if ((result as any).success && channelSent > 0) successfulChannels += 1
      if ((result as any).success && channelSent === 0) {
        errors.push('Tidak ada token FCM aktif untuk target.')
      }
      if (!(result as any).success) {
        const error = (result as any).error || (result as any).message || 'FCM gagal'
        errors.push(String(error))
        retryable = retryable || isRetryableDeliveryError(error)
      }
      for (const report of ((result as any).report || [])) {
        if (!report.success) {
          const error = report.error || `FCM status ${report.status || 'unknown'}`
          errors.push(String(error))
          if (report.status === 429 || Number(report.status) >= 500) retryable = true
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      retryable = true
    }
  }

  if (message.channels.includes('webpush') && audience === 'staff' && isStaffTarget(target)) {
    attemptedChannels += 1
    try {
      const result = await sendPushNotification(
        { title: message.title, body: message.body, url: message.url },
        target,
        { db, env: runtimeEnv },
      )
      const channelSent = Number((result as any).sent || 0)
      sent += channelSent
      if ((result as any).success && channelSent > 0) successfulChannels += 1
      if ((result as any).success && channelSent === 0) {
        errors.push('Tidak ada subscription Web Push aktif untuk target.')
      }
      if (!(result as any).success) {
        const error = (result as any).error || (result as any).message || 'Web Push gagal'
        errors.push(String(error))
        retryable = retryable || isRetryableDeliveryError(error)
      }
      for (const report of ((result as any).report || [])) {
        if (!report.success) {
          const error = report.error || `Web Push status ${report.status || 'unknown'}`
          errors.push(String(error))
          if (report.status === 429 || Number(report.status) >= 500) retryable = true
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      retryable = true
    }
  }

  if (message.channels.includes('in_app') && audience === 'staff') {
    attemptedChannels += 1
    try {
      await writeStaffNotifications(db, ids, message.eventKey, sourceRef, message.title, message.body, message.url, message.level)
      sent += ids.length
      successfulChannels += 1
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      retryable = true
    }
  }

  if (message.channels.includes('in_app') && audience === 'parent') {
    attemptedChannels += 1
    try {
      await writeParentNotifications(db, ids, message.parentType, sourceRef, message.title, message.body, message.level, message.parentType)
      sent += ids.length
      successfulChannels += 1
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      retryable = true
    }
  }

  // A durable staff inbox must not hide a transient push/write failure.
  const staffInboxRetry = audience === 'staff' && message.channels.includes('in_app') && retryable
  return { ok: !staffInboxRetry && (successfulChannels > 0 || attemptedChannels === 0), retryable, sent, errors }
}

async function validatedQueueRecipientIds(db: D1Database, message: NotificationQueueMessage) {
  if (message.eventKey === ATTENDANCE_CORRECTION_RESULT_EVENT || message.validation?.kind === 'attendance_correction_result') {
    const validation = message.validation
    if (message.eventKey !== ATTENDANCE_CORRECTION_RESULT_EVENT || validation?.kind !== 'attendance_correction_result' ||
      message.target.kind !== 'staff_users') return []
    const [request, setting] = await Promise.all([
      db.prepare(`SELECT r.requested_by FROM attendance_correction_requests r
        JOIN "user" u ON u.id = r.requested_by AND COALESCE(u.banned, 0) = 0
        WHERE r.decision_id = ? AND r.status IN ('APPROVED', 'REJECTED')`)
        .bind(validation.decisionId).first<{ requested_by: string }>(),
      getNotificationSetting(message.eventKey, db),
    ])
    return request && Number(setting?.enabled) === 1 && message.target.ids.includes(request.requested_by)
      ? [request.requested_by] : []
  }
  if (message.eventKey === ATTENDANCE_CORRECTION_REQUEST_EVENT || message.validation?.kind === 'attendance_correction_review') {
    const validation = message.validation
    if (message.eventKey !== ATTENDANCE_CORRECTION_REQUEST_EVENT || validation?.kind !== 'attendance_correction_review' ||
      message.target.kind !== 'staff_users') return []
    const [request, setting] = await Promise.all([
      db.prepare("SELECT requested_by FROM attendance_correction_requests WHERE id = ? AND status = 'PENDING'")
        .bind(validation.requestId).first<{ requested_by: string }>(),
      getNotificationSetting(message.eventKey, db),
    ])
    return request && Number(setting?.enabled) === 1
      ? attendanceCorrectionNotificationRecipients(db, request.requested_by, message.target.ids)
      : []
  }
  if (message.validation?.kind === 'komite_review_request') {
    if (message.eventKey !== 'komite_verifier_review_requested' || message.target.kind !== 'staff_users') return []
    return validKomiteReminderRecipients(db,message.validation,message.target.ids)
  }
  if (message.validation?.kind === 'komite_review') {
    const definition = getNotificationDefinition(KOMITE_REVIEW_REMINDER_EVENT)
    const setting = await getNotificationSetting(KOMITE_REVIEW_REMINDER_EVENT, db)
    if (message.eventKey !== KOMITE_REVIEW_REMINDER_EVENT || message.target.kind !== 'staff_users' ||
      !definition || !setting || Number(setting.enabled) !== 1 ||
      komiteReminderSlot(Date.now(), getNotificationReminderConfig(setting, definition)) !== message.validation.slot) return []
    return validKomiteReminderRecipients(db, message.validation, message.target.ids)
  }
  if (message.validation?.kind === 'attendance_homeroom_session') {
    const v = message.validation
    const activation = await attendanceNoticeActivation(db)
    const setting = await getNotificationSetting(message.eventKey, db)
    if (message.eventKey !== 'attendance_homeroom_alert' || message.target.kind !== 'staff_users' ||
      !setting || Number(setting.enabled) !== 1 || !attendanceDateEligible(v.tanggal, activation)) return []
    const student = await db.prepare(`SELECT s.kelas_id, u.id AS wali_id FROM siswa s
      JOIN kelas k ON k.id = s.kelas_id
      JOIN "user" u ON u.id = k.wali_kelas_id AND COALESCE(u.banned, 0) = 0
      WHERE s.id = ? AND s.status = 'aktif'`).bind(v.siswaId).first<{ kelas_id: string; wali_id: string }>()
    if (!student || !message.target.ids.includes(student.wali_id)) return []
    const raw = await db.prepare(`SELECT updated_at, status FROM absensi_siswa
      WHERE siswa_id = ? AND penugasan_id = ? AND tanggal = ?`)
      .bind(v.siswaId, v.penugasanId, v.tanggal).first<{ updated_at: string; status: string }>()
    if (!raw || !['ALFA','SAKIT','IZIN'].includes(raw.status) || raw.status !== v.status || raw.updated_at !== v.sourceUpdatedAt ||
      Date.parse(utcSourceTimestamp(raw.updated_at)) < Date.parse(activation)) return []
    const data = await getFinalAttendanceForClass(db, student.kelas_id, v.tanggal, v.tanggal, { siswaId: v.siswaId, fresh: true })
    if (!teacherNoticeStillValid(data?.statusByStudent.get(v.siswaId)?.[0], v.penugasanId, v.status)) return []
    return [student.wali_id]
  }
  if (message.validation?.kind === 'attendance_session' || message.validation?.kind === 'attendance_daily') {
    const v = message.validation
    const activation = await attendanceNoticeActivation(db)
    if (!attendanceDateEligible(v.tanggal, activation)) return []
    const setting = await getNotificationSetting(message.eventKey, db)
    if (!setting || Number(setting.enabled) !== 1 || !message.target.ids.includes(v.siswaId)) return []
    const student = await db.prepare("SELECT kelas_id FROM siswa WHERE id = ? AND status = 'aktif'")
      .bind(v.siswaId).first<{ kelas_id: string }>()
    if (!student?.kelas_id) return []
    const state = await readAttendanceNoticeState(db, v.siswaId, v.tanggal)
    const data = await getFinalAttendanceForClass(db, student.kelas_id, v.tanggal, v.tanggal, { siswaId: v.siswaId, fresh: true })
    const day = data?.statusByStudent.get(v.siswaId)?.[0]
    if (v.kind === 'attendance_session') {
      if (!state || state.initial_sent_at || state.initial_ref !== message.sourceRef || state.initial_revision !== v.revision) return []
      const raw = await db.prepare(`SELECT updated_at, status FROM absensi_siswa
        WHERE siswa_id = ? AND penugasan_id = ? AND tanggal = ?`)
        .bind(v.siswaId, v.penugasanId!, v.tanggal).first<{ updated_at: string; status: string }>()
      if (!raw || raw.status !== v.status ||
        Date.parse(utcSourceTimestamp(raw.updated_at)) < Date.parse(activation) ||
        !effectiveInitialAttendanceStatus(day, v.penugasanId!, v.status)) return []
      const effective = effectiveInitialAttendanceStatus(day, v.penugasanId!, v.status)!
      const definition = getNotificationDefinition(message.eventKey)!
      const block = day!.block_statuses.find(b => b.penugasan_id === v.penugasanId)!
      const session = day!.detail_guru.find(detail => detail.sumber === 'guru' && detail.jam_ke_mulai <= block.jam_ke_selesai && detail.jam_ke_selesai >= block.jam_ke_mulai)
      const context = { nama_siswa: day!.nama_lengkap, kelas: data!.kelas.label, tanggal: v.tanggal,
        status_kehadiran: attendanceStatusLabel(effective), keterangan_status: initialAttendanceContext(effective),
        mapel: session?.nama_mapel || '', rentang_jam: session ? `${session.jam_ke_mulai}–${session.jam_ke_selesai}` : '',
        sumber_keterangan: effective !== v.status ? 'Status ini berdasarkan pemeriksaan wali kelas atas catatan sesi pembelajaran.' : 'Ini merupakan catatan sesi pembelajaran.' }
      message.title = renderNotificationTemplate(setting.title_template, context, definition.placeholders)
      message.body = renderNotificationTemplate(setting.body_template, context, definition.placeholders)
      return [v.siswaId]
    }
    if (!state?.initial_sent_at || state.final_ref !== message.sourceRef || state.final_revision !== v.revision ||
      state.final_sent_revision >= v.revision || !day?.is_daily_final || day.status_akhir !== v.status) return []
    // Refresh completeness at delivery; an intervening save may change only notes/counts.
    const definition = getNotificationDefinition(message.eventKey)!
    const context = { nama_siswa: day.nama_lengkap, kelas: data!.kelas.label, tanggal: v.tanggal,
      status_kehadiran: attendanceStatusLabel(day.status_akhir),
      alasan_status: parentDailyReason(day),
      kelengkapan: day.pending_blok > 0 ? ` ${day.pending_blok} sesi pelajaran belum diinput; rekap dapat diperbarui.` : '' }
    message.title = renderNotificationTemplate(setting.title_template, context, definition.placeholders)
    message.body = renderNotificationTemplate(setting.body_template, context, definition.placeholders)
    return [v.siswaId]
  }
  // Legacy attendance messages are readable but never replayed under the new policy.
  if (message.eventKey.startsWith('attendance_') &&
    ['attendance_parent_alert', 'attendance_daily_final', 'attendance_daily_update'].includes(message.eventKey)) return []
  if (!message.validation || message.validation.kind !== 'attendance_status') {
    return message.target.ids
  }

  const ids = [...new Set(message.target.ids.map(String).filter(Boolean))]
  if (ids.length === 0) return []
  const placeholders = ids.map(() => '?').join(',')
  const rows = await db.prepare(`
    SELECT s.id
    FROM siswa s
    WHERE s.id IN (${placeholders})
      AND s.status = 'aktif'
      AND (
        EXISTS (
          SELECT 1
          FROM keterangan_absensi_wali_kelas kawk
          WHERE kawk.siswa_id = s.id
            AND kawk.tanggal = ?
            AND kawk.status = ?
        )
        OR (
          NOT EXISTS (
            SELECT 1
            FROM keterangan_absensi_wali_kelas kawk
            WHERE kawk.siswa_id = s.id AND kawk.tanggal = ?
          )
          AND EXISTS (
            SELECT 1
            FROM absensi_siswa ab
            WHERE ab.siswa_id = s.id
              AND ab.tanggal = ?
              AND ab.status = ?
          )
        )
      )
  `).bind(
    ...ids,
    message.validation.tanggal,
    message.validation.status,
    message.validation.tanggal,
    message.validation.tanggal,
    message.validation.status,
  ).all<{ id: string }>()
  return (rows.results || []).map(row => row.id)
}

export async function emitConfiguredNotification(input: EmitConfiguredNotificationInput): Promise<NotificationDispatchResult> {
  const definition = getNotificationDefinition(input.eventKey)
  if (!definition) return { status: 'skipped', sent: 0, queued: 0, dispatchIds: [], error: 'Event notifikasi tidak dikenal.' }

  const db = input.db || await getDB()
  await ensureNotificationSchema(db)
  const setting = await getNotificationSetting(input.eventKey, db)
  if (!setting || Number(setting.enabled) !== 1) return { status: 'disabled', sent: 0, queued: 0, dispatchIds: [] }

  const context = input.context || {}
  let title: string
  let body: string
  let url: string
  try {
    title = renderNotificationTemplate(setting.title_template, context, definition.placeholders)
    body = renderNotificationTemplate(setting.body_template, context, definition.placeholders)
    url = renderNotificationTemplate(setting.url_template || definition.defaultUrl, context, definition.placeholders)
  } catch (error) {
    return { status: 'failed', sent: 0, queued: 0, dispatchIds: [], error: error instanceof Error ? error.message : String(error) }
  }

  const channels = normalizeChannels(setting.channels_json, definition.defaultChannels)
  const target = normalizeTarget(setting.target_json, input.targetOverride || definition.defaultTarget)
  const expanded = await expandTarget(db, input.targetOverride || target, context)
  if (!expanded || expanded.ids.length === 0) return { status: 'skipped', sent: 0, queued: 0, dispatchIds: [] }

  const ids = [...new Set(expanded.ids)]
  const chunks = chunk(ids, NOTIFICATION_DIRECT_RECIPIENT_LIMIT)
  const queue = await getQueue()
  const delaySeconds = Math.max(0, Math.floor(Number(input.delaySeconds || 0)))
  const shouldQueue = delaySeconds > 0 || chunks.length > 1 || !!input.validation
  const dispatchIds: string[] = []
  let sent = 0
  let queued = 0
  let failed = false
  let firstError = ''

  for (let index = 0; index < chunks.length; index += 1) {
    const idsChunk = chunks[index]
    const scope = targetScope(expanded.audience, idsChunk)
    const claimed = await claimDispatch(db, input.eventKey, input.sourceRef, scope)
    if (!claimed) continue
    dispatchIds.push(claimed.id)

    const message: NotificationQueueMessage = {
      dispatchId: claimed.id,
      eventKey: input.eventKey,
      sourceRef: input.sourceRef,
      title,
      body,
      url,
      channels,
      target: queueTarget(expanded.audience, idsChunk),
      parentType: input.parentType || input.eventKey,
      level: setting.level || definition.defaultLevel,
      validation: input.validation,
    }

    if (shouldQueue && queue) {
      try {
        await db.prepare('UPDATE notification_dispatches SET payload_json = ?, available_at = ? WHERE id = ?')
          .bind(JSON.stringify(message), new Date(Date.now() + delaySeconds * 1000).toISOString(), claimed.id).run()
        await queue.send(message, {
          contentType: 'json',
          ...(delaySeconds > 0 ? { delaySeconds } : {}),
        })
        await db.prepare("UPDATE notification_dispatches SET enqueued_at = datetime('now') WHERE id = ?").bind(claimed.id).run()
        queued += 1
        continue
      } catch (error) {
        await markDispatch(db, claimed.id, 'failed', error instanceof Error ? error.message : String(error))
        failed = true
        firstError ||= error instanceof Error ? error.message : String(error)
        continue
      }
    }

    if (shouldQueue && !queue) {
      await db.prepare('UPDATE notification_dispatches SET payload_json = ?, available_at = ? WHERE id = ?')
        .bind(JSON.stringify(message), new Date(Date.now() + delaySeconds * 1000).toISOString(), claimed.id).run()
      const error = 'Antrean notifikasi tidak tersedia; pengiriman tertunda tidak boleh dikirim langsung.'
      await markDispatch(db, claimed.id, 'failed', error)
      failed = true
      firstError ||= error
      continue
    }

    await markDispatch(db, claimed.id, 'processing')
    const delivered = await deliverNotification(db, input.runtimeEnv, message, expanded.audience, idsChunk, input.sourceRef)
    sent += delivered.sent
    if (delivered.ok) {
      await markDispatch(db, claimed.id, 'sent')
    } else {
      await markDispatch(db, claimed.id, 'failed', delivered.errors.join('; ').slice(0, 2000))
      failed = true
      firstError ||= delivered.errors[0] || 'Pengiriman notifikasi gagal.'
    }
  }

  if (failed) return { status: 'failed', sent, queued, dispatchIds, error: firstError }
  if (queued > 0) return { status: 'queued', sent, queued, dispatchIds }
  return { status: sent > 0 ? 'sent' : 'skipped', sent, queued, dispatchIds }
}

/** Kirim ke wali kelas dahulu agar pemberitahuan orang tua tidak mendahuluinya. */
export async function emitParentAndHomeroomNotification(
  input: EmitConfiguredNotificationInput & { homeroomEventKey: string },
): Promise<NotificationDispatchResult> {
  const db = input.db || await getDB()
  const parentSetting = await getNotificationSetting(input.eventKey, db)
  if (!parentSetting || Number(parentSetting.enabled) !== 1) {
    return { status: 'disabled', sent: 0, queued: 0, dispatchIds: [] }
  }

  const siswaId = asText(input.context?.siswaId)
  if (!siswaId) return { status: 'skipped', sent: 0, queued: 0, dispatchIds: [], error: 'Siswa penerima tidak ditemukan.' }
  const wali = await db.prepare(`
    SELECT u.id
    FROM siswa s
    JOIN kelas k ON k.id = s.kelas_id
    JOIN "user" u ON u.id = k.wali_kelas_id AND u.banned = 0
    WHERE s.id = ?
    LIMIT 1
  `).bind(siswaId).first<{ id: string }>()
  if (!wali?.id) {
    return { status: 'skipped', sent: 0, queued: 0, dispatchIds: [], error: 'Wali kelas aktif belum ditetapkan; notifikasi orang tua ditahan.' }
  }

  const staffResult = await emitConfiguredNotification({
    ...input,
    eventKey: input.homeroomEventKey,
    context: { ...input.context, userId: wali.id },
    targetOverride: { kind: 'staff_users' },
    parentType: undefined,
  })
  if (staffResult.status !== 'sent' && staffResult.status !== 'queued') {
    return { ...staffResult, error: staffResult.error || 'Notifikasi wali kelas belum terkirim; notifikasi orang tua ditahan.' }
  }
  return emitConfiguredNotification(input)
}

export async function dispatchRawNotification(input: DispatchRawNotificationInput): Promise<NotificationDispatchResult> {
  const title = String(input.title || '').trim()
  const body = String(input.body || '').trim()
  if (!title || !body) return { status: 'failed', sent: 0, queued: 0, dispatchIds: [], error: 'Judul dan isi notifikasi wajib diisi.' }
  const channels = [...new Set(input.channels.filter((channel) => ['fcm', 'webpush', 'in_app'].includes(channel)))]
  if (channels.length === 0) return { status: 'failed', sent: 0, queued: 0, dispatchIds: [], error: 'Channel notifikasi kosong.' }

  const db = input.db || await getDB()
  await ensureNotificationSchema(db)
  const target = normalizeTarget(JSON.stringify(input.target), input.target)
  const expanded = await expandTarget(db, target, input.context || {})
  if (!expanded || expanded.ids.length === 0) return { status: 'skipped', sent: 0, queued: 0, dispatchIds: [] }

  const eventKey = input.eventKey || 'manual_broadcast'
  const sourceRef = input.sourceRef
  const ids = [...new Set(expanded.ids)]
  const chunks = chunk(ids, NOTIFICATION_DIRECT_RECIPIENT_LIMIT)
  const queue = await getQueue()
  const shouldQueue = chunks.length > 1
  const dispatchIds: string[] = []
  let sent = 0
  let queued = 0
  let failed = false
  let firstError = ''

  for (const idsChunk of chunks) {
    const scope = targetScope(expanded.audience, idsChunk)
    const claimed = await claimDispatch(db, eventKey, sourceRef, scope)
    if (!claimed) continue
    dispatchIds.push(claimed.id)
    const message: NotificationQueueMessage = {
      dispatchId: claimed.id,
      eventKey,
      sourceRef,
      title,
      body,
      url: input.url || '/dashboard',
      image: input.image,
      channels,
      target: queueTarget(expanded.audience, idsChunk),
      parentType: input.parentType || eventKey,
      level: input.level || 'info',
    }

    if (shouldQueue && queue) {
      try {
        await queue.send(message, { contentType: 'json' })
        queued += 1
        continue
      } catch (error) {
        await markDispatch(db, claimed.id, 'failed', error instanceof Error ? error.message : String(error))
        failed = true
        firstError ||= error instanceof Error ? error.message : String(error)
        continue
      }
    }

    await markDispatch(db, claimed.id, 'processing')
    const delivered = await deliverNotification(db, input.runtimeEnv, message, expanded.audience, idsChunk, sourceRef)
    sent += delivered.sent
    if (delivered.ok) {
      await markDispatch(db, claimed.id, 'sent')
    } else {
      await markDispatch(db, claimed.id, 'failed', delivered.errors.join('; ').slice(0, 2000))
      failed = true
      firstError ||= delivered.errors[0] || 'Pengiriman notifikasi gagal.'
    }
  }

  if (failed) return { status: 'failed', sent, queued, dispatchIds, error: firstError }
  if (queued > 0) return { status: 'queued', sent, queued, dispatchIds }
  return { status: sent > 0 ? 'sent' : 'skipped', sent, queued, dispatchIds }
}

export async function processNotificationQueueMessage(
  message: NotificationQueueMessage,
  env: FcmRuntimeOptions['env'] & { DB: D1Database },
  attempts = 0,
) {
  const db = env.DB
  await ensureNotificationSchema(db)
  if (message.validation?.kind === 'attendance_work') {
    const work = message.validation
    const claim = await db.prepare(`UPDATE notification_dispatches SET status = 'processing', updated_at = datetime('now')
      WHERE id = ? AND (status IN ('queued','failed') OR (status = 'processing' AND updated_at <= datetime('now','-5 minutes')))
      RETURNING id`).bind(message.dispatchId).first<{ id: string }>()
    if (!claim) {
      const current = await db.prepare('SELECT status FROM notification_dispatches WHERE id = ?').bind(message.dispatchId).first<{ status: string }>()
      return { retry: !!current && current.status !== 'sent', sent: 0 }
    }
    try {
      if (work.penugasanId && work.notifyIds.length > 0) await notifyParentsAttendanceConfigured(db, { penugasanId: work.penugasanId, tanggal: work.tanggal, siswaIds: work.notifyIds })
      await notifyParentsDailyAttendanceFinal(db, { kelasId: work.kelasId, tanggal: work.tanggal, siswaIds: work.siswaIds })
      await markDispatch(db, message.dispatchId, 'sent')
      return { retry: false, sent: 0 }
    } catch (error) {
      await markDispatch(db, message.dispatchId, 'failed', error instanceof Error ? error.message : String(error))
      return { retry: true, sent: 0 }
    }
  }
  const row = await db.prepare('SELECT status FROM notification_dispatches WHERE id = ?').bind(message.dispatchId).first<{ status: string }>()
  if (!row || row.status === 'sent') return { retry: false, sent: 0 }
  const attendanceValidation = message.validation?.kind === 'attendance_session' || message.validation?.kind === 'attendance_daily'
    ? message.validation : null
  const homeroomValidation = message.validation?.kind === 'attendance_homeroom_session' ? message.validation : null
  const correctionReview = message.validation?.kind === 'attendance_correction_review'
  const correctionResult = message.validation?.kind === 'attendance_correction_result'
  const guardedDelivery = attendanceValidation || homeroomValidation || correctionReview || correctionResult ||
    message.validation?.kind === 'komite_review' || message.validation?.kind === 'komite_review_request'
  if (homeroomValidation) {
    const due = homeroomValidation.dueAt ? Date.parse(homeroomValidation.dueAt) : Date.parse(utcSourceTimestamp(homeroomValidation.sourceUpdatedAt)) + 300_000
    if (Date.now() < due) return { retry: true, sent: 0 }
  }
  if (attendanceValidation) {
    await attendanceNoticeActivation(db)
    const state = await readAttendanceNoticeState(db, attendanceValidation.siswaId, attendanceValidation.tanggal)
    const due = attendanceValidation.kind === 'attendance_session' ? state?.initial_due_at : state?.final_due_at
    if (due && Date.now() < Date.parse(due)) return { retry: true, sent: 0 }
  }
  if (['komite_chairman_review_requested','komite_principal_review_requested','komite_review_delegated'].includes(message.eventKey)) {
    await markDispatch(db,message.dispatchId,'sent','Dibatalkan: persetujuan Komite telah beralih ke Verifikator.')
    return { retry: false, sent: 0, skipped: true }
  }
  if (message.eventKey === 'permission_exit_created' || message.eventKey === 'permission_exit_returned') {
    await markDispatch(db, message.dispatchId, 'sent', 'Dibatalkan: notifikasi izin keluar kompleks dinonaktifkan.')
    return { retry: false, sent: 0, skipped: true }
  }

  const validRecipientIds = await validatedQueueRecipientIds(db, message)
  if (validRecipientIds.length === 0) {
    await markDispatch(db, message.dispatchId, 'sent', correctionResult
      ? 'Dibatalkan: hasil ajuan atau penerima tidak tersedia.'
      : correctionReview
      ? 'Dibatalkan: ajuan sudah diproses atau penerima tidak lagi berwenang.'
      : (message.validation?.kind === 'komite_review' || message.validation?.kind === 'komite_review_request')
      ? 'Dibatalkan: tahap/penerima review atau jadwal reminder Komite sudah berubah.'
      : 'Dibatalkan: status kehadiran sudah berubah atau dikoreksi wali kelas.')
    if (attendanceValidation) {
      const column = attendanceValidation.kind === 'attendance_session' ? 'initial_ref' : 'final_ref'
      const extra = attendanceValidation.kind === 'attendance_session' ? 'initial_due_at = NULL' : 'final_status = NULL, final_due_at = NULL, needs_recheck = needs_recheck + 1, next_check_at = NULL'
      await db.prepare(`UPDATE attendance_parent_notice_state SET ${column} = NULL, ${extra}
        WHERE siswa_id = ? AND tanggal = ? AND ${column} = ?`)
        .bind(attendanceValidation.siswaId, attendanceValidation.tanggal, message.sourceRef).run()
    }
    if (attendanceValidation?.kind === 'attendance_session' && attendanceValidation.penugasanId) {
      await notifyParentsAttendanceConfigured(db, { penugasanId: attendanceValidation.penugasanId,
        tanggal: attendanceValidation.tanggal, siswaIds: [attendanceValidation.siswaId], notifyHomeroom: false })
    }
    return { retry: false, sent: 0, skipped: true }
  }

  if (guardedDelivery) {
    const claimed = await db.prepare(`UPDATE notification_dispatches
      SET status = 'processing', attempts = attempts + 1, updated_at = datetime('now')
      WHERE id = ? AND (status IN ('queued','failed') OR (status = 'processing' AND updated_at <= datetime('now','-5 minutes')))
      RETURNING id`).bind(message.dispatchId).first<{ id: string }>()
    if (!claimed) return { retry: true, sent: 0 }
  } else {
    await markDispatch(db, message.dispatchId, 'processing')
  }
  const audience: ExpandedAudience = message.target.kind === 'staff_users' ? 'staff' : 'parent'
  const delivered = await deliverNotification(db, env, message, audience, validRecipientIds, message.sourceRef)
  if (delivered.ok) {
    if (attendanceValidation && delivered.sent > 0) {
      const stateUpdate = attendanceValidation.kind === 'attendance_session'
        ? db.prepare(`UPDATE attendance_parent_notice_state SET initial_sent_at = datetime('now'), needs_recheck = needs_recheck + 1, next_check_at = NULL
            WHERE siswa_id = ? AND tanggal = ? AND initial_ref = ?`)
            .bind(attendanceValidation.siswaId, attendanceValidation.tanggal, message.sourceRef)
        : db.prepare(`UPDATE attendance_parent_notice_state SET final_sent_status = ?, final_sent_revision = ?
            WHERE siswa_id = ? AND tanggal = ? AND final_ref = ?`)
            .bind(attendanceValidation.status, attendanceValidation.revision, attendanceValidation.siswaId, attendanceValidation.tanggal, message.sourceRef)
      await db.batch([
        db.prepare(`UPDATE notification_dispatches SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now'), last_error = NULL WHERE id = ?`).bind(message.dispatchId),
        stateUpdate,
      ])
    } else {
      await markDispatch(db, message.dispatchId, 'sent')
    }
    return { retry: false, sent: delivered.sent }
  }

  if (delivered.retryable) {
    const error = delivered.errors.join('; ')
    if (guardedDelivery) await markDispatch(db, message.dispatchId, 'failed', error.slice(0, 2000))
    if (attempts >= 3) {
      await markDispatch(db, message.dispatchId, 'failed', error.slice(0, 2000))
      return { retry: true, terminal: true, sent: delivered.sent, error }
    }
    return { retry: true, sent: delivered.sent, error }
  }
  await markDispatch(db, message.dispatchId, 'failed', delivered.errors.join('; ').slice(0, 2000))
  // Pesan Queue yang gagal permanen tetap di-retry sampai batas consumer;
  // setelah itu Cloudflare memindahkannya ke Dead Letter Queue.
  return { retry: true, terminal: true, sent: delivered.sent, error: delivered.errors.join('; ') }
}

export async function getParentStudentIdsForAnnouncement(db: D1Database, announcementId: string) {
  const row = await db.prepare(`
    SELECT id, target_scope, kelas_id
    FROM parent_announcements
    WHERE id = ?
    LIMIT 1
  `).bind(announcementId).first<{ id: string; target_scope: string; kelas_id: string | null }>()
  if (!row) return []

  if (row.target_scope === 'all') {
    const result = await db.prepare(`SELECT id FROM siswa WHERE status = 'aktif' ORDER BY id`).all<{ id: string }>()
    return (result.results || []).map((item) => item.id)
  }
  if (row.target_scope === 'kelas') {
    const result = await db.prepare(`
      SELECT DISTINCT s.id
      FROM siswa s
      WHERE s.status = 'aktif' AND (
        s.kelas_id = ? OR s.kelas_id IN (
          SELECT kelas_id FROM parent_announcement_targets WHERE announcement_id = ? AND target_type = 'kelas'
        )
      )
      ORDER BY s.id
    `).bind(row.kelas_id, announcementId).all<{ id: string }>()
    return (result.results || []).map((item) => item.id)
  }
  const result = await db.prepare(`
    SELECT DISTINCT s.id
    FROM siswa s
    JOIN kelas k ON k.id = s.kelas_id
    WHERE s.status = 'aktif'
      AND CAST(k.tingkat AS INTEGER) IN (
        SELECT CAST(tingkat AS INTEGER)
        FROM parent_announcement_targets
        WHERE announcement_id = ? AND target_type = 'angkatan'
      )
    ORDER BY s.id
  `).bind(announcementId).all<{ id: string }>()
  return (result.results || []).map((item) => item.id)
}

export async function dispatchDueParentAnnouncements(db: D1Database, runtimeEnv?: FcmRuntimeOptions['env']) {
  const setting = await getNotificationSetting('parent_announcement_published', db)
  if (!setting || Number(setting.enabled) !== 1) return { processed: 0, disabled: true }
  const result = await db.prepare(`
    SELECT id, title, body, publish_at
    FROM parent_announcements
    WHERE is_active = 1
      AND datetime(publish_at) <= datetime('now')
      AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
    ORDER BY datetime(publish_at) ASC
    LIMIT 100
  `).all<{ id: string; title: string; body: string; publish_at: string }>()

  let processed = 0
  for (const announcement of result.results || []) {
    const siswaIds = await getParentStudentIdsForAnnouncement(db, announcement.id)
    if (siswaIds.length === 0) continue
    await emitConfiguredNotification({
      eventKey: 'parent_announcement_published',
      sourceRef: `parent-announcement:${announcement.id}`,
      context: {
        judul: announcement.title,
        isi_pengumuman: announcement.body,
        tanggal: announcement.publish_at,
        siswaIds,
      },
      db,
      runtimeEnv,
      parentType: 'pengumuman',
    })
    processed += 1
  }
  return { processed }
}

export async function dispatchConfiguredReminders(db: D1Database, runtimeEnv?: FcmRuntimeOptions['env']) {
  const today = todayWIB()
  const now = Date.now()
  const weekday = nowWIB().getUTCDay() || 7
  let processed = 0

  const getActiveReminder = async (eventKey: string) => {
    const definition = getNotificationDefinition(eventKey)
    const setting = await getNotificationSetting(eventKey, db)
    if (!definition || !setting || Number(setting.enabled) !== 1) return null
    const reminder = getNotificationReminderConfig(setting, definition)
    // Event reminder memakai `setting.enabled` sebagai satu-satunya sakelar.
    // reminder.enabled adalah field warisan UI lama; menjadikannya syarat kedua
    // membuat event tampak aktif tetapi tidak pernah diproses oleh cron.
    return { definition, setting, reminder }
  }

  const komite = await getActiveReminder(KOMITE_REVIEW_REMINDER_EVENT)
  if (komite) {
    try {
      const slot = komiteReminderSlot(now, komite.reminder)
      if (slot) {
        // Schema is owned by the Komite module; do not recreate or mutate it here.
        const exists = await db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='komite_pengajuan'").first()
        if (exists) {
          const rows = await pendingKomiteReminders(db, slot, komite.reminder.frequencyMinutes, now)
          for (const row of rows) {
            const userIds = await komiteReminderRecipients(db, row)
            if (!userIds.length) continue
            const stage = stageForStatus(row.status)!
            const tahap = { bendahara: 'Bendahara Komite', ketua: 'Verifikator', kepala: 'Kepala Madrasah' }[stage]
            const result = await emitConfiguredNotification({
              eventKey: KOMITE_REVIEW_REMINDER_EVENT,
              sourceRef: komiteReminderSource(row, slot),
              context: { userIds, judul_pengajuan: row.judul, nama_pengaju: row.pengaju_name, nominal: formatRupiah(row.nominal), tahap },
              // Restrict to actual reviewers even when the event's saved target is edited.
              targetOverride: { kind: 'staff_users' },
              validation: { kind: 'komite_review', pengajuanId: row.id, version: row.current_version,
                status: row.status, sourceUpdatedAt: row.updated_at, delegateId: row.ketua_delegate_id || null, slot },
              db, runtimeEnv,
            })
            if (result.status !== 'skipped' && result.status !== 'disabled') processed += 1
            if (result.status === 'failed') console.error('[notification] reminder Komite gagal:', result.error)
          }
        }
      }
    } catch (error) {
      console.error('[notification] reminder Komite gagal:', error)
    }
  }

  const attendance = await getActiveReminder('attendance_missing_reminder')
  if (attendance) {
    try {
      const rows = await db.prepare(`
        SELECT DISTINCT pm.id AS penugasan_id, pm.guru_id, u.nama_lengkap,
               k.id AS kelas_id, k.tingkat, k.nomor_kelas, k.kelompok
        FROM jadwal_mengajar jm
        JOIN penugasan_mengajar pm ON pm.id = jm.penugasan_id
        JOIN kelas k ON k.id = pm.kelas_id
        JOIN "user" u ON u.id = pm.guru_id
        JOIN tahun_ajaran ta ON ta.id = pm.tahun_ajaran_id AND ta.is_active = 1
        WHERE jm.hari = ?
          AND (k.kbm_nonaktif_mulai IS NULL OR k.kbm_nonaktif_mulai > ?)
          AND NOT EXISTS (
            SELECT 1 FROM absensi_sesi_guru ag
            WHERE ag.penugasan_id = pm.id AND ag.tanggal = ?
          )
        ORDER BY pm.guru_id, k.tingkat, k.nomor_kelas
        LIMIT 200
      `).bind(weekday, today, today).all<any>()
      const bucket = Math.floor(now / (Math.max(5, attendance.reminder.frequencyMinutes) * 60_000))
      for (const row of rows.results || []) {
        const kelas = [row.tingkat, row.nomor_kelas, row.kelompok].filter(Boolean).join(' ')
        const result = await emitConfiguredNotification({
          eventKey: 'attendance_missing_reminder',
          sourceRef: `attendance-missing:${today}:${row.penugasan_id}:${bucket}`,
          context: { userId: row.guru_id, userIds: [row.guru_id], nama_guru: row.nama_lengkap, kelas, tanggal: today },
          db,
          runtimeEnv,
        })
        if (result.status !== 'skipped' && result.status !== 'disabled') processed += 1
      }
    } catch (error) {
      console.error('[notification] attendance_missing_reminder gagal:', error)
    }
  }

  const tasks = await getActiveReminder('task_pending_reminder')
  if (tasks) {
    try {
      const currentHhmm = currentTimeWIB().hhmm
      const windowStart = tasks.reminder.windowStart || '06:00'
      const windowEnd = tasks.reminder.windowEnd || '20:00'
      if (currentHhmm >= windowStart && currentHhmm <= windowEnd) {
        const rows = await db.prepare(`
          SELECT dtk.id AS delegasi_kelas_id, dt.tanggal, dt.kepada_user_id,
                 dtk.pelaksana_user_id, COUNT(*) OVER (PARTITION BY dtk.delegasi_id) AS jumlah_sesi
          FROM delegasi_tugas_kelas dtk
          JOIN delegasi_tugas dt ON dt.id = dtk.delegasi_id
          WHERE dt.status = 'DIKIRIM'
            AND dt.tanggal <= ?
            AND dt.tanggal >= date(?, '-14 day')
            AND dtk.absen_selesai = 0
            AND COALESCE(dtk.pelaksana_user_id, dt.kepada_user_id) IS NOT NULL
          ORDER BY dt.tanggal ASC
          LIMIT 100
        `).bind(today, today).all<any>()
      const bucket = Math.floor(now / (Math.max(5, tasks.reminder.frequencyMinutes) * 60_000))
      for (const row of rows.results || []) {
        const userId = row.pelaksana_user_id || row.kepada_user_id
        const result = await emitConfiguredNotification({
          eventKey: 'task_pending_reminder',
          sourceRef: `task-pending:${row.delegasi_kelas_id}:${bucket}`,
          context: { userId, userIds: [userId], tanggal: row.tanggal, nama_guru: '', jumlah_sesi: row.jumlah_sesi },
          db,
          runtimeEnv,
        })
        if (result.status !== 'skipped' && result.status !== 'disabled') processed += 1
        }
      }
    } catch (error) {
      console.error('[notification] task_pending_reminder gagal:', error)
    }
  }

  const meeting = await getActiveReminder('meeting_reminder')
  if (meeting) {
    try {
      const rows = await db.prepare(`
        SELECT pr.id AS peserta_id, pr.user_id, ur.id AS rapat_id,
               ur.agenda, ur.tanggal, ur.waktu, ur.tempat
        FROM peserta_rapat pr
        JOIN undangan_rapat ur ON ur.id = pr.rapat_id
        WHERE pr.status_kehadiran = 'BELUM_RESPOND'
          AND ur.tanggal >= ?
          AND ur.tanggal <= date(?, '+2 day')
        ORDER BY ur.tanggal, ur.waktu
        LIMIT 500
      `).bind(today, today).all<any>()
      const frequency = Math.max(5, meeting.reminder.frequencyMinutes)
      const bucket = Math.floor(now / (frequency * 60_000))
      for (const row of rows.results || []) {
        const meetingAt = new Date(`${row.tanggal}T${String(row.waktu).slice(0, 5)}:00+07:00`).getTime()
        const minutesUntil = (meetingAt - now) / 60_000
        if (!Number.isFinite(minutesUntil) || minutesUntil < 0 || minutesUntil > meeting.reminder.leadMinutes) continue
        const result = await emitConfiguredNotification({
          eventKey: 'meeting_reminder',
          sourceRef: `meeting-reminder:${row.rapat_id}:${row.peserta_id}:${bucket}`,
          context: { userId: row.user_id, userIds: [row.user_id], agenda: row.agenda, tanggal: row.tanggal, waktu: row.waktu, tempat: row.tempat },
          db,
          runtimeEnv,
        })
        if (result.status !== 'skipped' && result.status !== 'disabled') processed += 1
      }
    } catch (error) {
      console.error('[notification] meeting_reminder cron gagal:', error)
    }
  }

  const pbReminder = await getActiveReminder('pramubakti_slot_reminder')
  if (pbReminder) {
    try {
      const { minutes } = await import('@/lib/pramubakti')
      const { getPbData } = await import('@/lib/pramubakti-db')
      const currentHhmm = currentTimeWIB().hhmm
      const currentMin = minutes(currentHhmm)
      const leadMin = pbReminder.reminder.leadMinutes || 15
      const frequency = Math.max(5, pbReminder.reminder.frequencyMinutes || 30)
      const bucket = Math.floor(now / (frequency * 60_000))

      const pbData = await getPbData(db, today, today)
      for (const item of pbData.items) {
        if (!item.slot || item.status !== 'BELUM' || item.report || item.leave) continue
        const startMin = minutes(item.slot.start)
        const endMin = minutes(item.slot.end)
        if (currentMin < startMin - 5 || currentMin > endMin) continue

        const minutesUntilEnd = endMin - currentMin
        if (minutesUntilEnd > leadMin && currentMin < startMin + 20) continue

        const slotWaktu = `${item.slot.start} - ${item.slot.end} WIB`
        const result = await emitConfiguredNotification({
          eventKey: 'pramubakti_slot_reminder',
          sourceRef: `pb-slot-reminder:${today}:${item.slot.id}:${item.user_id}:${bucket}`,
          context: {
            userId: item.user_id,
            userIds: [item.user_id],
            nama_pegawai: item.nama_lengkap,
            slot_waktu: slotWaktu,
            jam_selesai: `${item.slot.end} WIB`,
            tanggal: today,
          },
          db,
          runtimeEnv,
        })
        if (result.status !== 'skipped' && result.status !== 'disabled') processed += 1
      }
    } catch (error) {
      console.error('[notification] pramubakti_slot_reminder cron gagal:', error)
    }
  }

  try {
    const kbmReminderResult = await dispatchTeachingSessionReminders(db, runtimeEnv)
    processed += kbmReminderResult.processed
  } catch (error) {
    console.error('[notification] kbm_teaching_reminder cron gagal:', error)
  }

  return { processed, checkedAt: `${today} ${currentTimeWIB().hhmm}` }
}

export async function dispatchTeachingSessionReminders(
  db: D1Database,
  runtimeEnv?: FcmRuntimeOptions['env'],
): Promise<{ processed: number; checkedAt?: string }> {
  const eventKey = 'kbm_teaching_reminder'
  const definition = getNotificationDefinition(eventKey)
  const setting = await getNotificationSetting(eventKey, db)
  if (!definition || !setting || Number(setting.enabled) !== 1) {
    return { processed: 0 }
  }

  const now = nowWIB()
  const today = todayWIB()
  const weekday = now.getUTCDay() || 7
  if (weekday > 6) return { processed: 0 } // Hari Minggu tidak ada KBM

  // Cek kalender pendidikan (libur / non-efektif KBM)
  try {
    const calendarStatus = await getKalenderDateStatus(db, today)
    if (!calendarStatus.isEffective) return { processed: 0 }
  } catch (err) {
    console.error('[notification] getKalenderDateStatus error:', err)
  }

  // Ambil tahun ajaran aktif & jam pelajaran
  const ta = await db.prepare(
    'SELECT id, jam_pelajaran FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  ).first<{ id: string; jam_pelajaran: string | null }>()
  if (!ta) return { processed: 0 }

  let polaList: PolaJam[] = []
  try {
    const parsed = JSON.parse(ta.jam_pelajaran || '[]')
    polaList = Array.isArray(parsed) ? parsed : []
  } catch {
    polaList = []
  }
  const pola = polaList.find(p => p && Array.isArray(p.hari) && p.hari.includes(weekday))
  const slots: SlotJam[] = pola?.slots ?? []
  if (slots.length === 0) return { processed: 0 }

  // Hitung waktu sekarang WIB dalam menit dari jam 00:00
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()

  // Cari slot yang mulai 10 - 25 menit yang lalu
  const eligibleSlotIds = new Set<number>()
  for (const slot of slots) {
    if (!slot.mulai) continue
    const parts = slot.mulai.split(':').map(Number)
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) continue
    const slotStartMinutes = parts[0] * 60 + parts[1]
    const elapsed = currentMinutes - slotStartMinutes
    if (elapsed >= 10 && elapsed <= 25) {
      eligibleSlotIds.add(Number(slot.id))
    }
  }

  if (eligibleSlotIds.size === 0) {
    return { processed: 0 }
  }

  const kbmExceptions = await getKbmExceptionsForDate(db, today)

  // Ambil blok jadwal hari ini
  const { results: rows } = await db.prepare(`
    SELECT
      jm.penugasan_id,
      MIN(jm.jam_ke) as jam_ke_mulai,
      MAX(jm.jam_ke) as jam_ke_selesai,
      pm.guru_id,
      u.nama_lengkap as guru_nama,
      mp.nama_mapel,
      k.id as kelas_id,
      k.tingkat, k.nomor_kelas, k.kelompok,
      MAX(ag.id) as agenda_id,
      MAX(asg.id) as absensi_sesi_id,
      MAX(dtk.pelaksana_user_id) as pelaksana_user_id,
      MAX(up.nama_lengkap) as pelaksana_nama,
      MAX(dt.id) as delegasi_id
    FROM jadwal_mengajar jm
    JOIN penugasan_mengajar pm ON jm.penugasan_id = pm.id
    JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
    JOIN kelas k ON pm.kelas_id = k.id
    JOIN "user" u ON pm.guru_id = u.id
    LEFT JOIN agenda_guru ag ON ag.penugasan_id = jm.penugasan_id AND ag.tanggal = ?
    LEFT JOIN absensi_sesi_guru asg ON asg.penugasan_id = jm.penugasan_id AND asg.tanggal = ?
    LEFT JOIN delegasi_tugas_kelas dtk ON dtk.penugasan_mengajar_id = jm.penugasan_id
    LEFT JOIN delegasi_tugas dt ON dt.id = dtk.delegasi_id AND dt.tanggal = ? AND dt.status = 'DIKIRIM'
    LEFT JOIN "user" up ON up.id = dtk.pelaksana_user_id
    WHERE jm.tahun_ajaran_id = ? AND jm.hari = ?
      AND (k.kbm_nonaktif_mulai IS NULL OR k.kbm_nonaktif_mulai > ?)
    GROUP BY jm.penugasan_id, pm.guru_id, u.nama_lengkap, mp.nama_mapel, k.id, k.tingkat, k.nomor_kelas, k.kelompok
  `).bind(today, today, today, ta.id, weekday, today).all<any>()

  if (!rows || rows.length === 0) return { processed: 0 }

  let processed = 0

  for (const r of rows) {
    const jamKeMulai = Number(r.jam_ke_mulai)
    const jamKeSelesai = Number(r.jam_ke_selesai)

    // Cek apakah jam awal blok mengajar ini termasuk slot yang dipicu saat ini
    if (!eligibleSlotIds.has(jamKeMulai)) continue

    // Cek pengecualian KBM di kalender
    const isActive = hasActiveTeachingSlotsInRange(
      kbmExceptions,
      { id: r.kelas_id, tingkat: Number(r.tingkat) },
      jamKeMulai,
      jamKeSelesai,
    )
    if (!isActive) continue

    // Jika agenda dan absensi siswa SUDAH diisi dua-duanya, lewati
    if (r.agenda_id && r.absensi_sesi_id) continue

    // Penentuan penerima: jika didelegasikan ke guru lain
    let targetUserId = r.guru_id
    let targetGuruNama = r.guru_nama
    if (r.delegasi_id) {
      if (r.pelaksana_user_id) {
        targetUserId = r.pelaksana_user_id
        targetGuruNama = r.pelaksana_nama || 'Guru Pengganti'
      } else {
        continue
      }
    }

    const slot = slots.find(s => Number(s.id) === jamKeMulai)
    const kelas = formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok)
    const jamKeText = jamKeSelesai > jamKeMulai ? `${jamKeMulai}-${jamKeSelesai}` : `${jamKeMulai}`

    try {
      const result = await emitConfiguredNotification({
        eventKey,
        sourceRef: `kbm-reminder:${today}:${r.penugasan_id}:${jamKeMulai}`,
        context: {
          userId: targetUserId,
          userIds: [targetUserId],
          nama_guru: targetGuruNama,
          kelas,
          mata_pelajaran: r.nama_mapel,
          jam_ke: jamKeText,
          waktu_mulai: slot?.mulai || '',
          tanggal: today,
        },
        db,
        runtimeEnv,
      })

      if (result.status !== 'skipped' && result.status !== 'disabled' && result.status !== 'failed') {
        processed += 1
      }
    } catch (err) {
      console.error(`[notification] kbm_teaching_reminder failed for ${r.penugasan_id}:`, err)
    }
  }

  return { processed, checkedAt: `${today} ${currentTimeWIB().hhmm}` }
}

export function getNotificationReminderConfig(setting: NotificationSetting, definition?: NotificationEventDefinition) {
  return normalizeReminder(setting.reminder_json, definition?.reminder || defaultReminderFallback())
}

function defaultReminderFallback(): NotificationReminderConfig {
  return {
    enabled: false,
    leadMinutes: 60,
    frequencyMinutes: 1440,
    daysBefore: 0,
    windowStart: '06:00',
    windowEnd: '20:00',
  }
}


export async function prepareAttendanceCorrectionReviewNotice(db: D1Database, requestId: string, requesterId: string) {
  const eventKey = ATTENDANCE_CORRECTION_REQUEST_EVENT
  const definition = getNotificationDefinition(eventKey)!
  const sourceRef = `${eventKey}:${requestId}`
  const setting = await getNotificationSetting(eventKey, db)
  if (!setting || Number(setting.enabled) !== 1) return { sourceRef, statements: [] }

  const recipients = await attendanceCorrectionNotificationRecipients(db, requesterId)
  const channels = normalizeChannels(setting.channels_json, definition.defaultChannels)
  const statements = chunk(recipients, NOTIFICATION_DIRECT_RECIPIENT_LIMIT).map(ids => {
    const dispatchId = crypto.randomUUID()
    const scope = targetScope('staff', ids)
    const message: NotificationQueueMessage = {
      dispatchId, eventKey, sourceRef, channels,
      title: setting.title_template, body: setting.body_template,
      url: `${definition.defaultUrl}?ajuan=${encodeURIComponent(requestId)}`,
      target: { kind: 'staff_users', ids }, parentType: '', level: setting.level || definition.defaultLevel,
      validation: { kind: 'attendance_correction_review', requestId },
    }
    return db.prepare(`INSERT INTO notification_dispatches
      (id, dedup_key, event_key, source_ref, target_scope, status, payload_json, available_at)
      SELECT ?,?,?,?,?,'queued',?,? WHERE EXISTS (
        SELECT 1 FROM attendance_correction_requests WHERE id = ? AND status = 'PENDING'
      )`).bind(dispatchId, `${sourceRef}:${scope}`, eventKey, sourceRef, scope,
      JSON.stringify(message), new Date().toISOString(), requestId)
  })
  return { sourceRef, statements }
}

export async function prepareAttendanceCorrectionResultNotice(db: D1Database, input: {
  requestId: string; requesterId: string; decisionId: string; status: 'APPROVED' | 'REJECTED'
}) {
  const eventKey = ATTENDANCE_CORRECTION_RESULT_EVENT
  const definition = getNotificationDefinition(eventKey)!
  const sourceRef = `${eventKey}:${input.requestId}`
  const setting = await getNotificationSetting(eventKey, db)
  if (!setting || Number(setting.enabled) !== 1) return null

  const ids = [input.requesterId]
  const scope = targetScope('staff', ids)
  const context = { hasil: input.status === 'APPROVED' ? 'disetujui' : 'ditolak' }
  const message: NotificationQueueMessage = {
    dispatchId: crypto.randomUUID(), eventKey, sourceRef,
    title: renderNotificationTemplate(setting.title_template, context, definition.placeholders),
    body: renderNotificationTemplate(setting.body_template, context, definition.placeholders),
    url: `${definition.defaultUrl}?ajuan=${encodeURIComponent(input.requestId)}`,
    channels: normalizeChannels(setting.channels_json, definition.defaultChannels),
    target: { kind: 'staff_users', ids }, parentType: '', level: setting.level || definition.defaultLevel,
    validation: { kind: 'attendance_correction_result', decisionId: input.decisionId },
  }
  const statement = db.prepare(`INSERT INTO notification_dispatches
    (id, dedup_key, event_key, source_ref, target_scope, status, payload_json, available_at)
    SELECT ?,?,?,?,?,'queued',?,? WHERE EXISTS (
      SELECT 1 FROM attendance_correction_requests WHERE id = ? AND decision_id = ? AND status = ?
    )`).bind(message.dispatchId, `${sourceRef}:${scope}`, eventKey, sourceRef, scope,
    JSON.stringify(message), new Date().toISOString(), input.requestId, input.decisionId, input.status)
  return { sourceRef, statement }
}

/** Return statements to commit with attendance mutations; no provider I/O on submit. */
export async function prepareAttendanceNotificationWork(db: D1Database, input: {
  tanggal: string; kelasId?: string; penugasanId?: string; siswaIds: string[]; notifyIds?: string[]; correctionDecisionId?: string
}): Promise<D1PreparedStatement[]> {
  const activation = await attendanceNoticeActivation(db)
  if (!attendanceDateEligible(input.tanggal, activation) || input.siswaIds.length === 0) return []
  await ensureNotificationSchema(db)
  const kelasId = input.kelasId || (input.penugasanId ? (await db.prepare('SELECT kelas_id FROM penugasan_mengajar WHERE id = ?')
    .bind(input.penugasanId).first<{ kelas_id: string }>())?.kelas_id : null)
  if (!kelasId) return []
  const siswaIds = [...new Set(input.siswaIds)]
  if (siswaIds.length > 50) {
    const statements: D1PreparedStatement[] = []
    for (let i = 0; i < siswaIds.length; i += 50) {
      const ids = siswaIds.slice(i, i + 50)
      statements.push(...await prepareAttendanceNotificationWork(db, { ...input, kelasId, siswaIds: ids, notifyIds: input.notifyIds?.filter(id => ids.includes(id)) }))
    }
    return statements
  }
  const id = crypto.randomUUID()
  const message: NotificationQueueMessage = {
    dispatchId: id, eventKey: 'attendance_source_changed', sourceRef: `attendance-work:${id}`,
    title: '', body: '', url: '', channels: [], parentType: '', level: 'info',
    target: { kind: 'parent_students', ids: siswaIds },
    validation: { kind: 'attendance_work', tanggal: input.tanggal, kelasId, penugasanId: input.penugasanId,
      siswaIds, notifyIds: [...new Set(input.notifyIds || [])] },
  }
  const correctionGuard = input.correctionDecisionId
    ? " AND EXISTS (SELECT 1 FROM attendance_correction_requests WHERE decision_id = ? AND status = 'APPROVED')"
    : ''
  const guardBindings = input.correctionDecisionId ? [input.correctionDecisionId] : []
  return [db.prepare(`INSERT INTO notification_dispatches (id,dedup_key,event_key,source_ref,target_scope,status,payload_json,available_at)
    SELECT ?,?,?,?,?,'queued',?,? WHERE 1 = 1 ${correctionGuard}`).bind(id, message.sourceRef, message.eventKey, message.sourceRef, `attendance-work:${kelasId}:${input.tanggal}`,
      JSON.stringify(message), new Date().toISOString(), ...guardBindings),
    db.prepare(`UPDATE attendance_parent_notice_state SET needs_recheck = needs_recheck + 1, next_check_at = NULL
      WHERE tanggal = ? AND siswa_id IN (${siswaIds.map(() => '?').join(',')}) ${correctionGuard}`).bind(input.tanggal, ...siswaIds, ...guardBindings)]
}

/** Bounded enqueue recovery, using a lease so submit and cron cannot fan out twice. */
export async function flushAttendanceNotificationOutbox(db: D1Database) {
  await ensureNotificationSchema(db)
  return flushNotificationOutbox(db)
}

export async function flushNotificationOutbox(db: D1Database, sourceRef?: string, binding?: QueueBinding) {
  const queue = binding ?? await getQueue()
  if (!queue) return { queued: 0 }
  const nowMs = Date.now()
  const now = new Date(nowMs).toISOString()
  const rows = await db.prepare(`SELECT id, payload_json, available_at FROM notification_dispatches
    WHERE enqueued_at IS NULL AND payload_json IS NOT NULL AND status IN ('queued','failed')
      AND available_at <= ? AND (enqueue_claim_until IS NULL OR enqueue_claim_until <= ?)
      ${sourceRef ? 'AND source_ref = ?' : ''}
    ORDER BY available_at, id LIMIT 50`)
    .bind(new Date(nowMs + 3600_000).toISOString(), now, ...(sourceRef ? [sourceRef] : []))
    .all<{ id: string; payload_json: string; available_at: string }>()
  let queued = 0
  for (const row of rows.results || []) {
    const claim = await db.prepare(`UPDATE notification_dispatches SET enqueue_claim_until = ?
      WHERE id = ? AND enqueued_at IS NULL AND (enqueue_claim_until IS NULL OR enqueue_claim_until <= ?)
      RETURNING id`).bind(new Date(Date.now() + 60_000).toISOString(), row.id, now).first<{ id: string }>()
    if (!claim) continue
    try {
      const message = JSON.parse(row.payload_json) as NotificationQueueMessage
      const delaySeconds = Math.max(0, Math.ceil((Date.parse(row.available_at) - Date.now()) / 1000))
      await queue.send(message, { contentType: 'json', ...(delaySeconds > 0 ? { delaySeconds } : {}) })
      await db.prepare(`UPDATE notification_dispatches
        SET status = CASE WHEN status = 'failed' AND attempts = 0 THEN 'queued' ELSE status END,
          enqueued_at = COALESCE(enqueued_at, datetime('now')), enqueue_claim_until = NULL WHERE id = ?`)
        .bind(row.id).run()
      queued++
    } catch (error) {
      await db.prepare(`UPDATE notification_dispatches SET enqueue_claim_until = ?, last_error = ? WHERE id = ?`)
        .bind(new Date(Date.now() + 60_000).toISOString(), error instanceof Error ? error.message : String(error), row.id).run()
    }
  }
  return { queued }
}
