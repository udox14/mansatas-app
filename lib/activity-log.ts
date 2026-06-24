import { headers } from 'next/headers'
import { getDB, serializeValue } from '@/utils/db'
import { getSession } from '@/utils/auth/server'
import { getUserRoles } from '@/lib/features'

export type ActivitySeverity = 'info' | 'warning' | 'danger'

export type ActivityLogTarget = {
  type: string
  id?: string | null
  label?: string | null
  metadata?: unknown
}

export type ActivityLogInput = {
  db?: D1Database
  module: string
  action: string
  summary: string
  severity?: ActivitySeverity
  entityType?: string | null
  entityId?: string | null
  entityLabel?: string | null
  before?: unknown
  after?: unknown
  diff?: unknown
  metadata?: unknown
  targets?: ActivityLogTarget[]
}

const SENSITIVE_KEY_PATTERN = /(password|token|secret|hash|cookie|authorization|accessToken|refreshToken|idToken|session)/i
const MASKED_KEY_PATTERN = /^(nik|nik_ayah|nik_ibu|nomor_kk)$/i

export async function ensureActivityLogTables(db?: D1Database) {
  const database = db ?? await getDB()
  await database.batch([
    database.prepare(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id                 TEXT PRIMARY KEY,
        created_at         TEXT NOT NULL DEFAULT (datetime('now')),
        actor_user_id      TEXT REFERENCES "user"(id) ON DELETE SET NULL,
        actor_name         TEXT,
        actor_email        TEXT,
        actor_roles        TEXT NOT NULL DEFAULT '[]',
        session_id         TEXT,
        module             TEXT NOT NULL,
        action             TEXT NOT NULL,
        severity           TEXT NOT NULL DEFAULT 'info' CHECK(severity IN ('info', 'warning', 'danger')),
        summary            TEXT NOT NULL,
        entity_type        TEXT,
        entity_id          TEXT,
        entity_label       TEXT,
        before_json        TEXT,
        after_json         TEXT,
        diff_json          TEXT,
        metadata_json      TEXT,
        ip_address         TEXT,
        user_agent         TEXT
      )
    `),
    database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)'),
    database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs(actor_user_id, created_at)'),
    database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module, created_at)'),
    database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action, created_at)'),
    database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id, created_at)'),
    database.prepare(`
      CREATE TABLE IF NOT EXISTS activity_log_targets (
        id            TEXT PRIMARY KEY,
        log_id        TEXT NOT NULL REFERENCES activity_logs(id) ON DELETE CASCADE,
        target_type   TEXT NOT NULL,
        target_id     TEXT,
        target_label  TEXT,
        metadata_json TEXT
      )
    `),
    database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_log_targets_log ON activity_log_targets(log_id)'),
    database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_log_targets_target ON activity_log_targets(target_type, target_id)'),
    database.prepare(`
      CREATE TABLE IF NOT EXISTS activity_log_purge_runs (
        id                  TEXT PRIMARY KEY,
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        purged_by           TEXT REFERENCES "user"(id) ON DELETE SET NULL,
        purged_by_name      TEXT,
        start_date          TEXT NOT NULL,
        end_date            TEXT NOT NULL,
        deleted_logs_count  INTEGER NOT NULL DEFAULT 0,
        deleted_targets_count INTEGER NOT NULL DEFAULT 0,
        reason              TEXT NOT NULL,
        ip_address          TEXT,
        user_agent          TEXT
      )
    `),
    database.prepare('CREATE INDEX IF NOT EXISTS idx_activity_log_purge_runs_created_at ON activity_log_purge_runs(created_at)'),
  ])
}

export function redactForActivityLog(value: unknown, keyName = ''): unknown {
  if (value === null || value === undefined) return value
  if (SENSITIVE_KEY_PATTERN.test(keyName)) return '[REDACTED]'
  if (MASKED_KEY_PATTERN.test(keyName)) return maskSensitiveNumber(value)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(item => redactForActivityLog(item, keyName))
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      output[key] = redactForActivityLog(child, key)
    }
    return output
  }
  return value
}

export function createActivityDiff(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) {
  const oldData = before ?? {}
  const newData = after ?? {}
  const keys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))
  const diff: Record<string, { before: unknown; after: unknown }> = {}
  for (const key of keys) {
    const oldValue = normalizeComparable(oldData[key])
    const newValue = normalizeComparable(newData[key])
    if (oldValue !== newValue) {
      diff[key] = {
        before: redactForActivityLog(oldData[key], key),
        after: redactForActivityLog(newData[key], key),
      }
    }
  }
  return diff
}

export async function logActivity(input: ActivityLogInput) {
  try {
    const db = input.db ?? await getDB()
    await ensureActivityLogTables(db)

    const [session, hdrs] = await Promise.all([
      getSession().catch(() => null),
      headers().catch(() => null),
    ])
    const actor = session?.user ?? null
    const roles = actor ? await getUserRoles(db, actor.id).catch(() => [actor.role].filter(Boolean)) : []
    const id = crypto.randomUUID()
    const before = input.before === undefined ? null : JSON.stringify(redactForActivityLog(input.before))
    const after = input.after === undefined ? null : JSON.stringify(redactForActivityLog(input.after))
    const diff = input.diff === undefined ? null : JSON.stringify(redactForActivityLog(input.diff))
    const metadata = input.metadata === undefined ? null : JSON.stringify(redactForActivityLog(input.metadata))

    await db.prepare(`
      INSERT INTO activity_logs (
        id, created_at, actor_user_id, actor_name, actor_email, actor_roles, session_id,
        module, action, severity, summary, entity_type, entity_id, entity_label,
        before_json, after_json, diff_json, metadata_json, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      new Date().toISOString(),
      actor?.id ?? null,
      actor?.nama_lengkap || actor?.name || null,
      actor?.email ?? null,
      JSON.stringify(roles),
      session?.session?.id ?? null,
      input.module,
      input.action,
      input.severity ?? 'info',
      input.summary,
      input.entityType ?? null,
      input.entityId ?? null,
      input.entityLabel ?? null,
      before,
      after,
      diff,
      metadata,
      getIpAddress(hdrs),
      hdrs?.get('user-agent') ?? null,
    ).run()

    const targets = input.targets ?? []
    if (targets.length > 0) {
      const statements = targets.map(target =>
        db.prepare(`
          INSERT INTO activity_log_targets (id, log_id, target_type, target_id, target_label, metadata_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          id,
          target.type,
          target.id ?? null,
          target.label ?? null,
          target.metadata === undefined ? null : JSON.stringify(redactForActivityLog(target.metadata)),
        )
      )
      for (let i = 0; i < statements.length; i += 100) {
        await db.batch(statements.slice(i, i + 100))
      }
    }
  } catch (error) {
    console.error('Gagal mencatat activity log:', error)
  }
}

function maskSensitiveNumber(value: unknown) {
  const raw = String(value ?? '')
  if (raw.length <= 4) return raw ? '****' : raw
  return `${'*'.repeat(Math.max(4, raw.length - 4))}${raw.slice(-4)}`
}

function normalizeComparable(value: unknown) {
  return JSON.stringify(serializeValue(value) ?? null)
}

function getIpAddress(hdrs: Headers | null) {
  if (!hdrs) return null
  return (
    hdrs.get('cf-connecting-ip') ||
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    hdrs.get('x-real-ip') ||
    null
  )
}
