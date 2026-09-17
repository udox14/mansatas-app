'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getUserRoles } from '@/lib/features'
import { logActivity } from '@/lib/activity-log'
import {
  calculateAgendaAccessRisk,
  canManageAgendaAccessAudit,
  canViewAgendaAccessAudit,
  dateKeyWIB,
  ensureAgendaAccessAuditSchema,
  HISTORICAL_AUDIT_START_DATE,
  stableAuditHash,
  type AgendaAccessEvidence,
  type AgendaAccessReason,
} from '@/lib/agenda-access-audit'

export type AuditAccessFilters = {
  startDate?: string
  endDate?: string
  riskLevel?: string
  teacher?: string
  page?: number
  pageSize?: number
}

export type AuditAlertRow = {
  id: string
  source: 'live' | 'historical'
  detected_at: string
  last_event_at: string
  device_id: string | null
  ip_address: string | null
  user_agent: string | null
  user_a_id: string
  user_a_name: string
  user_b_id: string
  user_b_name: string
  risk_score: number
  risk_level: 'low' | 'medium' | 'high'
  reasons_json: string
  evidence_json: string
  agenda_id: string | null
  agenda_owner_id: string | null
  agenda_actor_id: string | null
  user_a_blocked: number
  user_b_blocked: number
}

async function requireAgendaAuditViewer() {
  const user = await getCurrentUser()
  if (!user) return null
  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  const structural = await db.prepare('SELECT jabatan_struktural_id FROM "user" WHERE id = ?')
    .bind(user.id).first<{ jabatan_struktural_id: string | null }>()
  const allowed = canViewAgendaAccessAudit(roles, structural?.jabatan_struktural_id)
  if (!allowed) return null
  await ensureAgendaAccessAuditSchema(db)
  return { user, db, roles, canManage: canManageAgendaAccessAudit(roles) }
}

export async function getAgendaAuditData(filters: AuditAccessFilters = {}) {
  const ctx = await requireAgendaAuditViewer()
  if (!ctx) return { error: 'Akses ditolak.', alerts: [], total: 0, summary: emptySummary(), canManage: false, lastScan: null }
  const where: string[] = []
  const params: unknown[] = []
  if (validDate(filters.startDate)) {
    where.push('a.last_event_at >= ?')
    params.push(`${filters.startDate}T00:00:00.000Z`)
  }
  if (validDate(filters.endDate)) {
    where.push('a.last_event_at <= ?')
    params.push(`${filters.endDate}T23:59:59.999Z`)
  }
  if (['low', 'medium', 'high'].includes(filters.riskLevel || '')) {
    where.push('a.risk_level = ?')
    params.push(filters.riskLevel)
  }
  if (filters.teacher?.trim()) {
    where.push('(LOWER(COALESCE(ua.nama_lengkap, ua.name, ua.email)) LIKE LOWER(?) OR LOWER(COALESCE(ub.nama_lengkap, ub.name, ub.email)) LIKE LOWER(?))')
    const query = `%${filters.teacher.trim()}%`
    params.push(query, query)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const pageSize = Math.max(10, Math.min(100, Number(filters.pageSize) || 25))
  const page = Math.max(1, Number(filters.page) || 1)
  const offset = (page - 1) * pageSize

  const baseFrom = `
    FROM agenda_access_alerts a
    JOIN "user" ua ON ua.id = a.user_a_id
    JOIN "user" ub ON ub.id = a.user_b_id
    LEFT JOIN agenda_access_blocks ba ON ba.user_id = a.user_a_id AND ba.is_active = 1
    LEFT JOIN agenda_access_blocks bb ON bb.user_id = a.user_b_id AND bb.is_active = 1
    ${whereSql}
  `
  const [rows, count, summaryRows, lastScan] = await Promise.all([
    ctx.db.prepare(`
      SELECT a.*,
        COALESCE(ua.nama_lengkap, ua.name, ua.email) AS user_a_name,
        COALESCE(ub.nama_lengkap, ub.name, ub.email) AS user_b_name,
        CASE WHEN ba.user_id IS NULL THEN 0 ELSE 1 END AS user_a_blocked,
        CASE WHEN bb.user_id IS NULL THEN 0 ELSE 1 END AS user_b_blocked
      ${baseFrom}
      ORDER BY a.last_event_at DESC LIMIT ? OFFSET ?
    `).bind(...params, pageSize, offset).all<AuditAlertRow>(),
    ctx.db.prepare(`SELECT COUNT(*) AS total ${baseFrom}`).bind(...params).first<{ total: number }>(),
    ctx.db.prepare(`SELECT a.risk_level, COUNT(*) AS total ${baseFrom} GROUP BY a.risk_level`)
      .bind(...params).all<{ risk_level: string; total: number }>(),
    ctx.db.prepare(`SELECT start_date, end_date, finished_at, alerts_created, status
      FROM agenda_access_scan_runs ORDER BY started_at DESC LIMIT 1`).first<any>(),
  ])
  const summary = emptySummary()
  for (const row of summaryRows.results || []) {
    if (row.risk_level in summary) summary[row.risk_level as keyof typeof summary] = Number(row.total)
  }
  summary.blocked = Number((await ctx.db.prepare('SELECT COUNT(*) AS total FROM agenda_access_blocks WHERE is_active = 1').first<{ total: number }>())?.total || 0)
  return {
    error: null,
    alerts: rows.results || [],
    total: Number(count?.total || 0),
    summary,
    canManage: ctx.canManage,
    page,
    pageSize,
    lastScan: lastScan || null,
  }
}

export async function blockAgendaAccess(userId: string, reason: string) {
  const ctx = await requireAgendaAuditViewer()
  if (!ctx?.canManage) return { error: 'Hanya super admin yang dapat memblokir pengisian Agenda.' }
  const cleanReason = reason.trim()
  if (cleanReason.length < 10) return { error: 'Alasan blokir wajib diisi minimal 10 karakter.' }
  if (userId === ctx.user.id) return { error: 'Super admin tidak dapat memblokir pengisian Agenda miliknya sendiri dari modul ini.' }
  const target = await ctx.db.prepare('SELECT id, COALESCE(nama_lengkap, name, email) AS nama FROM "user" WHERE id = ?')
    .bind(userId).first<{ id: string; nama: string }>()
  if (!target) return { error: 'Guru tidak ditemukan.' }
  const now = new Date().toISOString()
  const actorName = ctx.user.nama_lengkap || ctx.user.name || ctx.user.email || 'Super Admin'
  await ctx.db.prepare(`
    INSERT INTO agenda_access_blocks (user_id, is_active, reason, blocked_at, blocked_by, blocked_by_name, updated_at)
    VALUES (?, 1, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET is_active = 1, reason = excluded.reason,
      blocked_at = excluded.blocked_at, blocked_by = excluded.blocked_by,
      blocked_by_name = excluded.blocked_by_name, lifted_at = NULL, lifted_by = NULL,
      lifted_by_name = NULL, lift_reason = NULL, updated_at = excluded.updated_at
  `).bind(userId, cleanReason, now, ctx.user.id, actorName, now).run()
  await logActivity({
    db: ctx.db, module: 'audit_akses_agenda', action: 'block_agenda', severity: 'warning',
    summary: `Memblokir pengisian Agenda Guru ${target.nama}`,
    entityType: 'user', entityId: userId, entityLabel: target.nama,
    metadata: { reason: cleanReason },
  })
  revalidatePath('/dashboard/audit-akses-agenda')
  revalidatePath('/dashboard/agenda')
  return { success: `Pengisian Agenda ${target.nama} berhasil diblokir.` }
}

export async function unblockAgendaAccess(userId: string, reason: string) {
  const ctx = await requireAgendaAuditViewer()
  if (!ctx?.canManage) return { error: 'Hanya super admin yang dapat membuka blokir pengisian Agenda.' }
  const cleanReason = reason.trim()
  if (cleanReason.length < 10) return { error: 'Alasan membuka blokir wajib diisi minimal 10 karakter.' }
  const target = await ctx.db.prepare('SELECT id, COALESCE(nama_lengkap, name, email) AS nama FROM "user" WHERE id = ?')
    .bind(userId).first<{ id: string; nama: string }>()
  if (!target) return { error: 'Guru tidak ditemukan.' }
  const now = new Date().toISOString()
  const actorName = ctx.user.nama_lengkap || ctx.user.name || ctx.user.email || 'Super Admin'
  const result = await ctx.db.prepare(`
    UPDATE agenda_access_blocks SET is_active = 0, lifted_at = ?, lifted_by = ?,
      lifted_by_name = ?, lift_reason = ?, updated_at = ?
    WHERE user_id = ? AND is_active = 1
  `).bind(now, ctx.user.id, actorName, cleanReason, now, userId).run()
  if (!result.meta.changes) return { error: 'Akun ini tidak sedang diblokir.' }
  await logActivity({
    db: ctx.db, module: 'audit_akses_agenda', action: 'unblock_agenda',
    summary: `Membuka blokir pengisian Agenda Guru ${target.nama}`,
    entityType: 'user', entityId: userId, entityLabel: target.nama,
    metadata: { reason: cleanReason },
  })
  revalidatePath('/dashboard/audit-akses-agenda')
  revalidatePath('/dashboard/agenda')
  return { success: `Blokir Agenda ${target.nama} berhasil dibuka.` }
}

export async function runHistoricalAgendaAccessScan() {
  const ctx = await requireAgendaAuditViewer()
  if (!ctx?.canManage) return { error: 'Hanya super admin yang dapat menjalankan analisis historis.' }
  const startDate = HISTORICAL_AUDIT_START_DATE
  const endDate = new Date().toISOString().slice(0, 10)
  const scanKey = `agenda-access:${startDate}:${endDate}`
  const existing = await ctx.db.prepare('SELECT status, alerts_created FROM agenda_access_scan_runs WHERE scan_key = ?')
    .bind(scanKey).first<{ status: string; alerts_created: number }>()
  if (existing?.status === 'completed') return { success: `Analisis historis sudah pernah dijalankan (${existing.alerts_created} indikasi).` }

  const runId = crypto.randomUUID()
  const startedAt = new Date().toISOString()
  await ctx.db.prepare(`INSERT INTO agenda_access_scan_runs
    (id, scan_key, started_at, start_date, end_date, run_by, status)
    VALUES (?, ?, ?, ?, ?, ?, 'running')
    ON CONFLICT(scan_key) DO UPDATE SET started_at=excluded.started_at, finished_at=NULL,
      alerts_created=0, run_by=excluded.run_by, status='running', error_message=NULL`)
    .bind(runId, scanKey, startedAt, startDate, endDate, ctx.user.id).run()

  try {
    const [eventResult, agendaResult] = await Promise.all([
      ctx.db.prepare(`SELECT id, created_at, actor_user_id, actor_name, session_id, action, summary, ip_address, user_agent
        FROM activity_logs
        WHERE module='auth' AND action IN ('login','logout') AND created_at >= ?
          AND actor_user_id IS NOT NULL AND ip_address IS NOT NULL AND user_agent IS NOT NULL
        ORDER BY created_at ASC`).bind(`${startDate}T00:00:00.000Z`).all<any>(),
      ctx.db.prepare(`SELECT id, waktu_input, diubah_oleh, guru_id, tanggal, penugasan_id
        FROM agenda_guru WHERE tanggal >= ? AND waktu_input IS NOT NULL ORDER BY waktu_input ASC`)
        .bind(startDate).all<any>(),
    ])
    const agendasByActor = new Map<string, any[]>()
    for (const agenda of agendaResult.results || []) {
      const actor = String(agenda.diubah_oleh || agenda.guru_id || '')
      if (!actor) continue
      if (!agendasByActor.has(actor)) agendasByActor.set(actor, [])
      agendasByActor.get(actor)!.push(agenda)
    }
    const lastEvent = new Map<string, any>()
    const lastLogout = new Map<string, any>()
    const seenPairDays = new Set<string>()
    const statements: D1PreparedStatement[] = []

    for (const event of eventResult.results || []) {
      const signature = `${event.ip_address}|${event.user_agent}`
      const previous = lastEvent.get(signature)
      lastEvent.set(signature, event)
      if (event.action === 'logout') {
        lastLogout.set(signature, event)
        continue
      }
      if (!previous || previous.actor_user_id === event.actor_user_id) continue
      const currentAt = new Date(event.created_at).getTime()
      const previousAt = new Date(previous.created_at).getTime()
      if (!Number.isFinite(currentAt) || currentAt - previousAt > 30 * 60 * 1000) continue

      const logout = previous.action === 'logout' ? previous : lastLogout.get(signature)
      const logoutThenLogin = Boolean(logout && logout.actor_user_id === previous.actor_user_id &&
        currentAt - new Date(logout.created_at).getTime() <= 10 * 60 * 1000)
      const agenda = (agendasByActor.get(String(event.actor_user_id)) || []).find(row => {
        const agendaAt = new Date(row.waktu_input).getTime()
        return agendaAt >= currentAt && agendaAt - currentAt <= 30 * 60 * 1000
      })
      const [userA, userB] = [String(previous.actor_user_id), String(event.actor_user_id)].sort()
      const day = dateKeyWIB(event.created_at)
      const pairKey = `${stableAuditHash(signature)}:${userA}:${userB}`
      const repeated = Array.from(seenPairDays).some(value => value.startsWith(`${pairKey}:`) && value !== `${pairKey}:${day}`)
      seenPairDays.add(`${pairKey}:${day}`)
      const risk = calculateAgendaAccessRisk({
        accountSwitch: true, logoutThenLogin, agendaAfterSwitch: Boolean(agenda),
        repeatedDifferentDay: repeated, historical: true,
      })
      const reasons: AgendaAccessReason[] = ['HISTORICAL_IP_BROWSER_MATCH', 'ACCOUNT_SWITCH_SAME_DEVICE']
      if (logoutThenLogin) reasons.push('LOGOUT_THEN_OTHER_LOGIN')
      if (agenda) reasons.push('AGENDA_AFTER_SWITCH')
      if (repeated) reasons.push('REPEATED_ON_DIFFERENT_DAY')
      const evidence: AgendaAccessEvidence[] = [
        ...(previous.action === 'login' ? [{ type: 'login' as const, at: previous.created_at, userId: previous.actor_user_id, userName: previous.actor_name, sessionId: previous.session_id, activityLogId: previous.id, summary: previous.summary }] : []),
        ...(logoutThenLogin ? [{ type: 'logout' as const, at: logout.created_at, userId: logout.actor_user_id, userName: logout.actor_name, sessionId: logout.session_id, activityLogId: logout.id, summary: logout.summary }] : []),
        { type: 'login', at: event.created_at, userId: event.actor_user_id, userName: event.actor_name, sessionId: event.session_id, activityLogId: event.id, summary: event.summary },
        ...(agenda ? [{ type: 'agenda' as const, at: agenda.waktu_input, userId: event.actor_user_id, userName: event.actor_name, agendaId: agenda.id, summary: `Mengisi agenda tanggal ${agenda.tanggal}` }] : []),
      ]
      const alertKey = `historical:${day}:${pairKey}`
      const normalizedLastEventAt = agenda ? new Date(agenda.waktu_input).toISOString() : event.created_at
      statements.push(ctx.db.prepare(`INSERT OR IGNORE INTO agenda_access_alerts (
        id, alert_key, source, detected_at, last_event_at, ip_address, user_agent,
        user_a_id, user_b_id, risk_score, risk_level, reasons_json, evidence_json,
        agenda_id, agenda_owner_id, agenda_actor_id, updated_at
      ) VALUES (?, ?, 'historical', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), alertKey, event.created_at, normalizedLastEventAt,
          event.ip_address, event.user_agent, userA, userB, risk.score, risk.level,
          JSON.stringify(reasons), JSON.stringify(evidence), agenda?.id || null,
          agenda?.guru_id || null, agenda ? event.actor_user_id : null, new Date().toISOString()))
    }
    let created = 0
    for (let index = 0; index < statements.length; index += 50) {
      const result = await ctx.db.batch(statements.slice(index, index + 50))
      created += result.reduce((sum, item) => sum + Number(item.meta.changes || 0), 0)
    }
    await ctx.db.prepare(`UPDATE agenda_access_scan_runs SET finished_at=?, alerts_created=?, status='completed' WHERE scan_key=?`)
      .bind(new Date().toISOString(), created, scanKey).run()
    await logActivity({
      db: ctx.db, module: 'audit_akses_agenda', action: 'historical_scan',
      summary: `Menjalankan analisis historis akses Agenda sejak ${startDate}`,
      metadata: { startDate, endDate, alertsCreated: created },
    })
    revalidatePath('/dashboard/audit-akses-agenda')
    return { success: `Analisis historis selesai. ${created} indikasi baru ditemukan.` }
  } catch (error: any) {
    await ctx.db.prepare(`UPDATE agenda_access_scan_runs SET finished_at=?, status='failed', error_message=? WHERE scan_key=?`)
      .bind(new Date().toISOString(), String(error?.message || error).slice(0, 500), scanKey).run()
    return { error: 'Analisis historis gagal. Silakan periksa log sistem dan coba kembali.' }
  }
}

function validDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function emptySummary() {
  return { low: 0, medium: 0, high: 0, blocked: 0 }
}
