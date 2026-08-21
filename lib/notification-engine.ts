import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getDB } from '@/utils/db-server'
import { currentTimeWIB, nowWIB, todayWIB } from '@/lib/time'
import { ensureSchemaOnce } from '@/lib/schema-guard'
import {
  defaultNotificationSettings,
  getNotificationDefinition,
  NOTIFICATION_EVENT_DEFINITIONS,
  type NotificationChannel,
  type NotificationEventDefinition,
  type NotificationReminderConfig,
  type NotificationTargetConfig,
} from '@/lib/notification-catalog'
import { sendFcmNotification, type FcmRuntimeOptions, type FcmTarget, type FcmNotif } from '@/lib/fcm'
import { sendPushNotification } from '@/lib/web-push'

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
}

export type EmitConfiguredNotificationInput = {
  eventKey: string
  sourceRef: string
  context?: NotificationContext
  targetOverride?: NotificationTargetConfig
  db?: D1Database
  runtimeEnv?: FcmRuntimeOptions['env']
  parentType?: string
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
    windowEnd: typeof parsed.windowEnd === 'string' ? parsed.windowEnd : fallback.windowEnd,
  }
}

async function ensureNotificationSchema(db: D1Database) {
  const key = db as unknown as object
  const existing = notificationSchemaPromiseByDb.get(key)
  if (existing) return existing

  const promise = ensureSchemaOnce('notification-engine', async () => {
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

  const target = normalizeTarget(JSON.stringify(patch.target), definition.defaultTarget)
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
  if (!result.meta?.changes) return null
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

export async function notifyParentsAttendanceConfigured(
  db: D1Database,
  options: { penugasanId: string; tanggal: string; siswaIds?: string[] },
) {
  if (options.siswaIds && options.siswaIds.length === 0) return { notified: 0, students: 0 }
  const setting = await getNotificationSetting('attendance_parent_alert', db)
  if (!setting || Number(setting.enabled) !== 1) return { notified: 0, students: 0, disabled: true }
  const siswaFilter = options.siswaIds?.length
    ? `AND ab.siswa_id IN (${options.siswaIds.map(() => '?').join(',')})`
    : ''
  const rows = await db.prepare(`
    SELECT ab.siswa_id, ab.status, s.nama_lengkap
    FROM absensi_siswa ab
    JOIN siswa s ON s.id = ab.siswa_id
    WHERE ab.penugasan_id = ? AND ab.tanggal = ?
      AND ab.status IN ('ALFA', 'SAKIT')
      AND s.status = 'aktif'
      ${siswaFilter}
    ORDER BY s.nama_lengkap
  `).bind(options.penugasanId, options.tanggal, ...(options.siswaIds || [])).all<{ siswa_id: string; status: string; nama_lengkap: string }>()

  const attendanceRows = rows.results || []
  let notified = 0

  // Bila admin memilih target multi-siswa, gabungkan fan-out besar per status.
  // Target per-siswa tetap dipertahankan untuk konfigurasi parent_student agar
  // redaksi personal dan pilihan target admin tidak berubah.
  const configuredTarget = normalizeTarget(setting.target_json, { kind: 'parent_students' })
  if (attendanceRows.length > NOTIFICATION_DIRECT_RECIPIENT_LIMIT && configuredTarget.kind === 'parent_students') {
    const grouped = new Map<string, typeof attendanceRows>()
    for (const row of attendanceRows) {
      const bucket = grouped.get(row.status) || []
      bucket.push(row)
      grouped.set(row.status, bucket)
    }
    for (const [status, group] of grouped) {
      const label = status === 'ALFA' ? 'ALFA (tanpa keterangan)' : 'SAKIT'
      const result = await emitConfiguredNotification({
        eventKey: 'attendance_parent_alert',
        sourceRef: `${options.penugasanId}:${options.tanggal}:${status}`,
        context: {
          siswaIds: group.map((row) => row.siswa_id),
          nama_siswa: 'siswa',
          status_kehadiran: label,
          tanggal: options.tanggal,
        },
        targetOverride: { kind: 'parent_students' },
        db,
        parentType: 'absensi',
      })
      notified += result.sent
    }
    return { notified, students: attendanceRows.length }
  }

  for (const row of attendanceRows) {
    const label = row.status === 'ALFA' ? 'ALFA (tanpa keterangan)' : 'SAKIT'
    const result = await emitConfiguredNotification({
      eventKey: 'attendance_parent_alert',
      sourceRef: `${options.penugasanId}:${options.tanggal}:${row.status}`,
      context: {
        siswaId: row.siswa_id,
        siswaIds: [row.siswa_id],
        nama_siswa: row.nama_lengkap,
        status_kehadiran: label,
        tanggal: options.tanggal,
      },
      db,
      parentType: 'absensi',
    })
    notified += result.sent
  }
  return { notified, students: attendanceRows.length }
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
  message: Pick<NotificationQueueMessage, 'title' | 'body' | 'url' | 'image' | 'channels' | 'parentType' | 'level'>,
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
      sent += Number((result as any).sent || 0)
      if ((result as any).success) successfulChannels += 1
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
      sent += Number((result as any).sent || 0)
      if ((result as any).success) successfulChannels += 1
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

  return { ok: successfulChannels > 0 || attemptedChannels === 0, retryable, sent, errors }
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
  const shouldQueue = chunks.length > 1
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
  const row = await db.prepare('SELECT status FROM notification_dispatches WHERE id = ?').bind(message.dispatchId).first<{ status: string }>()
  if (!row || row.status === 'sent') return { retry: false, sent: 0 }

  await markDispatch(db, message.dispatchId, 'processing')
  const audience: ExpandedAudience = message.target.kind === 'staff_users' ? 'staff' : 'parent'
  const delivered = await deliverNotification(db, env, message, audience, message.target.ids, message.sourceRef)
  if (delivered.ok) {
    await markDispatch(db, message.dispatchId, 'sent')
    return { retry: false, sent: delivered.sent }
  }

  if (delivered.retryable) {
    const error = delivered.errors.join('; ')
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
    return reminder.enabled ? { definition, setting, reminder } : null
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
      const rows = await db.prepare(`
        SELECT dtk.id AS delegasi_kelas_id, dt.tanggal, dt.kepada_user_id,
               dtk.pelaksana_user_id, COUNT(*) OVER (PARTITION BY dtk.delegasi_id) AS jumlah_sesi
        FROM delegasi_tugas_kelas dtk
        JOIN delegasi_tugas dt ON dt.id = dtk.delegasi_id
        WHERE dt.status = 'DIKIRIM'
          AND dt.tanggal <= ?
          AND dtk.absen_selesai = 0
          AND COALESCE(dtk.pelaksana_user_id, dt.kepada_user_id) IS NOT NULL
        ORDER BY dt.tanggal ASC
        LIMIT 200
      `).bind(today).all<any>()
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
