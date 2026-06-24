'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { getUserRoles } from '@/lib/features'
import { ensureActivityLogTables } from '@/lib/activity-log'

export type ActivityLogRow = {
  id: string
  created_at: string
  actor_user_id: string | null
  actor_name: string | null
  actor_email: string | null
  actor_roles: string
  module: string
  action: string
  severity: 'info' | 'warning' | 'danger'
  summary: string
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  before_json: string | null
  after_json: string | null
  diff_json: string | null
  metadata_json: string | null
  ip_address: string | null
  user_agent: string | null
  target_count: number
}

export type ActivityLogFilters = {
  startDate?: string
  endDate?: string
  actor?: string
  module?: string
  action?: string
  entityType?: string
  severity?: string
  q?: string
  page?: number
  pageSize?: number
}

export async function requireActivityLogAdmin() {
  const user = await getCurrentUser()
  if (!user) return null
  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  if (!roles.includes('super_admin')) return null
  return { user, db, roles }
}

export async function getActivityLogs(filters: ActivityLogFilters = {}) {
  const ctx = await requireActivityLogAdmin()
  if (!ctx) return { error: 'Akses ditolak.', logs: [], total: 0, modules: [], actions: [], entityTypes: [] }
  const { db } = ctx
  await ensureActivityLogTables(db)

  const where: string[] = []
  const params: unknown[] = []
  applyFilters(where, params, filters)

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const pageSize = Math.max(10, Math.min(100, Number(filters.pageSize) || 25))
  const page = Math.max(1, Number(filters.page) || 1)
  const offset = (page - 1) * pageSize

  const [countRow, logsResult, modulesResult, actionsResult, entityTypesResult] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total FROM activity_logs ${whereSql}`).bind(...params).first<{ total: number }>(),
    db.prepare(`
      SELECT al.*,
             (SELECT COUNT(*) FROM activity_log_targets t WHERE t.log_id = al.id) AS target_count
      FROM activity_logs al
      ${whereSql}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, offset).all<ActivityLogRow>(),
    db.prepare('SELECT DISTINCT module FROM activity_logs ORDER BY module ASC').all<{ module: string }>(),
    db.prepare('SELECT DISTINCT action FROM activity_logs ORDER BY action ASC').all<{ action: string }>(),
    db.prepare('SELECT DISTINCT entity_type FROM activity_logs WHERE entity_type IS NOT NULL ORDER BY entity_type ASC').all<{ entity_type: string }>(),
  ])

  return {
    error: null,
    logs: logsResult.results ?? [],
    total: countRow?.total ?? 0,
    modules: (modulesResult.results ?? []).map(row => row.module),
    actions: (actionsResult.results ?? []).map(row => row.action),
    entityTypes: (entityTypesResult.results ?? []).map(row => row.entity_type),
    page,
    pageSize,
  }
}

export async function getActivityLogTargets(logId: string) {
  const ctx = await requireActivityLogAdmin()
  if (!ctx) return { error: 'Akses ditolak.', targets: [] }
  const rows = await ctx.db.prepare(`
    SELECT target_type, target_id, target_label, metadata_json
    FROM activity_log_targets
    WHERE log_id = ?
    ORDER BY target_label ASC
  `).bind(logId).all<{
    target_type: string
    target_id: string | null
    target_label: string | null
    metadata_json: string | null
  }>()
  return { error: null, targets: rows.results ?? [] }
}

export async function previewActivityLogPurge(startDate: string, endDate: string) {
  const ctx = await requireActivityLogAdmin()
  if (!ctx) return { error: 'Akses ditolak.', logsCount: 0, targetsCount: 0 }
  const range = normalizeRange(startDate, endDate)
  if (!range) return { error: 'Rentang tanggal tidak valid.', logsCount: 0, targetsCount: 0 }
  await ensureActivityLogTables(ctx.db)

  const logsCount = await ctx.db.prepare(`
    SELECT COUNT(*) AS total
    FROM activity_logs
    WHERE created_at >= ? AND created_at <= ?
  `).bind(range.start, range.end).first<{ total: number }>()

  const targetsCount = await ctx.db.prepare(`
    SELECT COUNT(*) AS total
    FROM activity_log_targets
    WHERE log_id IN (
      SELECT id FROM activity_logs WHERE created_at >= ? AND created_at <= ?
    )
  `).bind(range.start, range.end).first<{ total: number }>()

  return {
    error: null,
    logsCount: logsCount?.total ?? 0,
    targetsCount: targetsCount?.total ?? 0,
  }
}

export async function purgeActivityLogs(formData: FormData) {
  const ctx = await requireActivityLogAdmin()
  if (!ctx) return { error: 'Akses ditolak.' }
  const startDate = String(formData.get('startDate') || '')
  const endDate = String(formData.get('endDate') || '')
  const reason = String(formData.get('reason') || '').trim()
  const confirmation = String(formData.get('confirmation') || '').trim()
  const range = normalizeRange(startDate, endDate)

  if (!range) return { error: 'Rentang tanggal tidak valid.' }
  if (reason.length < 10) return { error: 'Alasan wajib diisi minimal 10 karakter.' }
  if (confirmation !== 'HAPUS LOG') return { error: 'Konfirmasi harus persis: HAPUS LOG' }

  const preview = await previewActivityLogPurge(startDate, endDate)
  if (preview.error) return { error: preview.error }

  const hdrs = await headers()
  const purgeId = crypto.randomUUID()
  await ctx.db.batch([
    ctx.db.prepare(`
      INSERT INTO activity_log_purge_runs (
        id, created_at, purged_by, purged_by_name, start_date, end_date,
        deleted_logs_count, deleted_targets_count, reason, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      purgeId,
      new Date().toISOString(),
      ctx.user.id,
      ctx.user.nama_lengkap || ctx.user.name || null,
      range.start,
      range.end,
      preview.logsCount,
      preview.targetsCount,
      reason,
      hdrs.get('cf-connecting-ip') || hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      hdrs.get('user-agent') || null,
    ),
    ctx.db.prepare(`
      DELETE FROM activity_log_targets
      WHERE log_id IN (
        SELECT id FROM activity_logs WHERE created_at >= ? AND created_at <= ?
      )
    `).bind(range.start, range.end),
    ctx.db.prepare('DELETE FROM activity_logs WHERE created_at >= ? AND created_at <= ?').bind(range.start, range.end),
  ])

  revalidatePath('/dashboard/log-aktivitas')
  return {
    success: `Berhasil membersihkan ${preview.logsCount} log dan ${preview.targetsCount} target log.`,
  }
}

export async function getActivityLogPurgeRuns() {
  const ctx = await requireActivityLogAdmin()
  if (!ctx) return []
  await ensureActivityLogTables(ctx.db)
  const rows = await ctx.db.prepare(`
    SELECT *
    FROM activity_log_purge_runs
    ORDER BY created_at DESC
    LIMIT 20
  `).all<{
    id: string
    created_at: string
    purged_by_name: string | null
    start_date: string
    end_date: string
    deleted_logs_count: number
    deleted_targets_count: number
    reason: string
  }>()
  return rows.results ?? []
}

function applyFilters(where: string[], params: unknown[], filters: ActivityLogFilters) {
  const range = normalizeRange(filters.startDate, filters.endDate)
  if (range) {
    where.push('created_at >= ? AND created_at <= ?')
    params.push(range.start, range.end)
  } else {
    if (filters.startDate) {
      where.push('created_at >= ?')
      params.push(`${filters.startDate}T00:00:00.000Z`)
    }
    if (filters.endDate) {
      where.push('created_at <= ?')
      params.push(`${filters.endDate}T23:59:59.999Z`)
    }
  }

  if (filters.actor?.trim()) {
    where.push('(LOWER(COALESCE(actor_name, "")) LIKE LOWER(?) OR LOWER(COALESCE(actor_email, "")) LIKE LOWER(?))')
    params.push(`%${filters.actor.trim()}%`, `%${filters.actor.trim()}%`)
  }
  if (filters.module?.trim()) {
    where.push('module = ?')
    params.push(filters.module.trim())
  }
  if (filters.action?.trim()) {
    where.push('action = ?')
    params.push(filters.action.trim())
  }
  if (filters.entityType?.trim()) {
    where.push('entity_type = ?')
    params.push(filters.entityType.trim())
  }
  if (filters.severity?.trim()) {
    where.push('severity = ?')
    params.push(filters.severity.trim())
  }
  if (filters.q?.trim()) {
    where.push(`(
      LOWER(summary) LIKE LOWER(?)
      OR LOWER(COALESCE(entity_label, '')) LIKE LOWER(?)
      OR LOWER(COALESCE(entity_id, '')) LIKE LOWER(?)
      OR LOWER(COALESCE(metadata_json, '')) LIKE LOWER(?)
    )`)
    const q = `%${filters.q.trim()}%`
    params.push(q, q, q, q)
  }
}

function normalizeRange(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null
  if (startDate > endDate) return null
  return {
    start: `${startDate}T00:00:00.000Z`,
    end: `${endDate}T23:59:59.999Z`,
  }
}
