import { headers } from 'next/headers'
import { agendaAuditPhoneSql, isAgendaAuditPhone } from './agenda-audit-device'
import { ensureSchemaOnce } from '@/lib/schema-guard'
import { getDeviceId } from '@/lib/device-identity'
import { touchStaffDeviceSession } from '@/lib/staff-device-sessions'

export const AGENDA_AUDIT_FEATURE_ID = 'audit-akses-agenda'
export const HISTORICAL_AUDIT_START_DATE = '2026-09-01'
const SWITCH_WINDOW_MS = 30 * 60 * 1000
const LOGOUT_WINDOW_MS = 10 * 60 * 1000

export type AgendaAccessReason =
  | 'ACCOUNT_SWITCH_SAME_DEVICE'
  | 'LOGOUT_THEN_OTHER_LOGIN'
  | 'AGENDA_AFTER_SWITCH'
  | 'REPEATED_ON_DIFFERENT_DAY'
  | 'HISTORICAL_IP_BROWSER_MATCH'

export type AgendaAccessEvidence = {
  type: 'login' | 'logout' | 'agenda'
  at: string
  userId: string | null
  userName?: string | null
  sessionId?: string | null
  activityLogId?: string | null
  agendaId?: string | null
  summary?: string | null
}

export type AgendaAccessWarning = {
  detectedAt: string
  riskLevel: 'low' | 'medium' | 'high'
  isBlocked: boolean
  blockReason: string | null
}

export function canViewAgendaAccessAudit(roles: string[], structuralRoleId?: string | null) {
  return roles.includes('super_admin') || roles.includes('kepsek') ||
    (roles.includes('wakamad') && structuralRoleId === 'jbt_waka_kurikulum')
}

export function canManageAgendaAccessAudit(roles: string[]) {
  return roles.includes('super_admin')
}

export function riskLevelForScore(score: number): 'low' | 'medium' | 'high' {
  if (score >= 80) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

export function calculateAgendaAccessRisk(input: {
  accountSwitch: boolean
  logoutThenLogin?: boolean
  agendaAfterSwitch?: boolean
  repeatedDifferentDay?: boolean
  historical?: boolean
}) {
  let score = input.accountSwitch ? 40 : 0
  if (input.logoutThenLogin) score += 20
  if (input.agendaAfterSwitch) score += 40
  if (input.repeatedDifferentDay) score += 40
  if (input.historical && !input.agendaAfterSwitch) score = Math.min(score, 79)
  return { score, level: riskLevelForScore(score) }
}

export async function isGuruMapelAndGuruPplPair(db: D1Database, userAId: string, userBId: string): Promise<boolean> {
  if (!userAId || !userBId || userAId === userBId) return false
  try {
    const row = await db.prepare(`
      SELECT
        EXISTS(
          SELECT 1 FROM guru_ppl_mapping
          WHERE (guru_ppl_id = ?1 AND guru_utama_id = ?2)
             OR (guru_ppl_id = ?2 AND guru_utama_id = ?1)
        ) AS is_mapped,
        EXISTS(
          SELECT 1 FROM "user" u
          LEFT JOIN user_roles ur ON ur.user_id = u.id
          LEFT JOIN guru_ppl_mapping gpm ON gpm.guru_ppl_id = u.id
          LEFT JOIN guru_ppl_profile gpp ON gpp.user_id = u.id
          WHERE u.id = ?1 AND (u.role = 'guru_ppl' OR ur.role = 'guru_ppl' OR gpm.id IS NOT NULL OR gpp.user_id IS NOT NULL)
        ) AS is_a_ppl,
        EXISTS(
          SELECT 1 FROM "user" u
          LEFT JOIN user_roles ur ON ur.user_id = u.id
          LEFT JOIN penugasan_mengajar pm ON pm.guru_id = u.id
          LEFT JOIN guru_ppl_mapping gpm ON gpm.guru_utama_id = u.id
          WHERE u.id = ?1
            AND (
              u.role IN ('guru', 'guru_mapel', 'wali_kelas', 'guru_piket', 'guru_bk')
              OR ur.role IN ('guru', 'guru_mapel')
              OR pm.id IS NOT NULL
              OR gpm.id IS NOT NULL
            )
            AND u.role <> 'guru_ppl'
            AND (ur.role IS NULL OR ur.role <> 'guru_ppl')
        ) AS is_a_guru,
        EXISTS(
          SELECT 1 FROM "user" u
          LEFT JOIN user_roles ur ON ur.user_id = u.id
          LEFT JOIN guru_ppl_mapping gpm ON gpm.guru_ppl_id = u.id
          LEFT JOIN guru_ppl_profile gpp ON gpp.user_id = u.id
          WHERE u.id = ?2 AND (u.role = 'guru_ppl' OR ur.role = 'guru_ppl' OR gpm.id IS NOT NULL OR gpp.user_id IS NOT NULL)
        ) AS is_b_ppl,
        EXISTS(
          SELECT 1 FROM "user" u
          LEFT JOIN user_roles ur ON ur.user_id = u.id
          LEFT JOIN penugasan_mengajar pm ON pm.guru_id = u.id
          LEFT JOIN guru_ppl_mapping gpm ON gpm.guru_utama_id = u.id
          WHERE u.id = ?2
            AND (
              u.role IN ('guru', 'guru_mapel', 'wali_kelas', 'guru_piket', 'guru_bk')
              OR ur.role IN ('guru', 'guru_mapel')
              OR pm.id IS NOT NULL
              OR gpm.id IS NOT NULL
            )
            AND u.role <> 'guru_ppl'
            AND (ur.role IS NULL OR ur.role <> 'guru_ppl')
        ) AS is_b_guru
    `).bind(userAId, userBId).first<{
      is_mapped: number
      is_a_ppl: number
      is_a_guru: number
      is_b_ppl: number
      is_b_guru: number
    }>()

    if (!row) return false
    if (Boolean(row.is_mapped)) return true
    const aPpl = Boolean(row.is_a_ppl)
    const bPpl = Boolean(row.is_b_ppl)
    const aGuru = Boolean(row.is_a_guru && !aPpl)
    const bGuru = Boolean(row.is_b_guru && !bPpl)
    return (aPpl && bGuru) || (bPpl && aGuru)
  } catch (error) {
    console.error('Gagal mengecek pasangan guru mapel dan PPL:', error)
    return false
  }
}

export async function cleanupGuruMapelAndPplAlerts(db: D1Database): Promise<void> {
  try {
    await db.prepare(`
      DELETE FROM agenda_access_alerts
      WHERE EXISTS (
        SELECT 1 FROM guru_ppl_mapping gpm
        WHERE (gpm.guru_ppl_id = agenda_access_alerts.user_a_id AND gpm.guru_utama_id = agenda_access_alerts.user_b_id)
           OR (gpm.guru_ppl_id = agenda_access_alerts.user_b_id AND gpm.guru_utama_id = agenda_access_alerts.user_a_id)
      )
      OR (
        user_a_id IN (
          SELECT u.id FROM "user" u LEFT JOIN user_roles ur ON ur.user_id = u.id
          WHERE u.role = 'guru_ppl' OR ur.role = 'guru_ppl'
        )
        AND
        user_b_id IN (
          SELECT u.id FROM "user" u LEFT JOIN user_roles ur ON ur.user_id = u.id
          LEFT JOIN penugasan_mengajar pm ON pm.guru_id = u.id
          LEFT JOIN guru_ppl_mapping gpm ON gpm.guru_utama_id = u.id
          WHERE (u.role IN ('guru', 'guru_mapel', 'wali_kelas', 'guru_piket', 'guru_bk')
                 OR ur.role IN ('guru', 'guru_mapel')
                 OR pm.id IS NOT NULL OR gpm.id IS NOT NULL)
            AND u.role <> 'guru_ppl'
            AND (ur.role IS NULL OR ur.role <> 'guru_ppl')
        )
      )
      OR (
        user_b_id IN (
          SELECT u.id FROM "user" u LEFT JOIN user_roles ur ON ur.user_id = u.id
          WHERE u.role = 'guru_ppl' OR ur.role = 'guru_ppl'
        )
        AND
        user_a_id IN (
          SELECT u.id FROM "user" u LEFT JOIN user_roles ur ON ur.user_id = u.id
          LEFT JOIN penugasan_mengajar pm ON pm.guru_id = u.id
          LEFT JOIN guru_ppl_mapping gpm ON gpm.guru_utama_id = u.id
          WHERE (u.role IN ('guru', 'guru_mapel', 'wali_kelas', 'guru_piket', 'guru_bk')
                 OR ur.role IN ('guru', 'guru_mapel')
                 OR pm.id IS NOT NULL OR gpm.id IS NOT NULL)
            AND u.role <> 'guru_ppl'
            AND (ur.role IS NULL OR ur.role <> 'guru_ppl')
        )
      )
    `).run()
  } catch (error) {
    console.error('Gagal membersihkan alert guru mapel dan PPL:', error)
  }
}

export async function ensureAgendaAccessAuditSchema(db: D1Database) {
  await ensureSchemaOnce('agenda-access-audit-v3', async () => {
    try {
      await db.prepare('ALTER TABLE activity_logs ADD COLUMN device_id TEXT').run()
    } catch {
      // Kolom sudah tersedia.
    }
    await db.batch([
      db.prepare('CREATE INDEX IF NOT EXISTS idx_activity_logs_device ON activity_logs(device_id, created_at)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS agenda_access_alerts (
        id TEXT PRIMARY KEY, alert_key TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL DEFAULT 'live' CHECK(source IN ('live','historical')),
        detected_at TEXT NOT NULL, last_event_at TEXT NOT NULL,
        device_id TEXT, ip_address TEXT, user_agent TEXT,
        user_a_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        user_b_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        risk_score INTEGER NOT NULL DEFAULT 0,
        risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low','medium','high')),
        reasons_json TEXT NOT NULL DEFAULT '[]', evidence_json TEXT NOT NULL DEFAULT '[]',
        agenda_id TEXT, agenda_owner_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
        agenda_actor_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_agenda_access_alerts_time ON agenda_access_alerts(last_event_at DESC)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_agenda_access_alerts_users ON agenda_access_alerts(user_a_id, user_b_id, last_event_at DESC)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_agenda_access_alerts_device ON agenda_access_alerts(device_id, last_event_at DESC)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS agenda_access_blocks (
        user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
        is_active INTEGER NOT NULL DEFAULT 1, reason TEXT NOT NULL,
        blocked_at TEXT NOT NULL, blocked_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
        blocked_by_name TEXT, lifted_at TEXT, lifted_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
        lifted_by_name TEXT, lift_reason TEXT, updated_at TEXT NOT NULL
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_agenda_access_blocks_active ON agenda_access_blocks(is_active, blocked_at DESC)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS agenda_access_scan_runs (
        id TEXT PRIMARY KEY, scan_key TEXT NOT NULL UNIQUE, started_at TEXT NOT NULL,
        finished_at TEXT, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
        alerts_created INTEGER NOT NULL DEFAULT 0, run_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'running', error_message TEXT
      )`),
    ])
    await cleanupGuruMapelAndPplAlerts(db)
    try {
      await db.prepare(`
        UPDATE agenda_access_alerts
        SET risk_score = 100, risk_level = 'high', updated_at = datetime('now')
        WHERE source = 'historical' AND agenda_id IS NOT NULL AND risk_level = 'medium'
      `).run()
    } catch {
      // ignore
    }
  })
}

export async function recordLoginAccessAudit(db: D1Database, input: {
  activityLogId: string | null
  userId: string
  userName: string
  sessionId: string
}) {
  try {
    await ensureAgendaAccessAuditSchema(db)
    const hdrs = await headers()
    const deviceId = getDeviceId(hdrs)
    if (!deviceId) return null
    await touchStaffDeviceSession(db, {
      sessionId: input.sessionId,
      userId: input.userId,
      headers: hdrs,
    })

    if (!isAgendaAuditPhone(hdrs.get('user-agent'))) return null

    const now = new Date()
    const cutoff = new Date(now.getTime() - SWITCH_WINDOW_MS).toISOString()
    const previous = await db.prepare(`
      SELECT id, created_at, actor_user_id, actor_name, session_id, action, summary, ip_address, user_agent
      FROM activity_logs
      WHERE module = 'auth' AND action IN ('login','logout') AND device_id = ?
        AND actor_user_id IS NOT NULL AND actor_user_id <> ? AND created_at >= ?
        AND ${agendaAuditPhoneSql('user_agent')}
      ORDER BY created_at DESC LIMIT 1
    `).bind(deviceId, input.userId, cutoff).first<any>()
    if (!previous) return null

    if (await isGuruMapelAndGuruPplPair(db, String(previous.actor_user_id), input.userId)) {
      return null
    }

    const logoutCutoff = new Date(now.getTime() - LOGOUT_WINDOW_MS).toISOString()
    const recentLogout = previous.action === 'logout' ? previous : await db.prepare(`
      SELECT id, created_at, actor_user_id, actor_name, session_id, summary
      FROM activity_logs
      WHERE module = 'auth' AND action = 'logout' AND device_id = ?
        AND actor_user_id = ? AND created_at >= ?
        AND ${agendaAuditPhoneSql('user_agent')}
      ORDER BY created_at DESC LIMIT 1
    `).bind(deviceId, previous.actor_user_id, logoutCutoff).first<any>()
    const logout = recentLogout && now.getTime() - new Date(recentLogout.created_at).getTime() <= LOGOUT_WINDOW_MS
      ? recentLogout
      : null

    const [userA, userB] = [String(previous.actor_user_id), input.userId].sort()
    const day = dateKeyWIB(now)
    const alertKey = `live:${day}:${deviceId}:${userA}:${userB}`
    const [existing, prior] = await Promise.all([
      db.prepare('SELECT risk_score, reasons_json, evidence_json FROM agenda_access_alerts WHERE alert_key = ?')
        .bind(alertKey).first<any>(),
      db.prepare(`
      SELECT id, detected_at FROM agenda_access_alerts
      WHERE source = 'live' AND device_id = ? AND user_a_id = ? AND user_b_id = ?
        AND ${agendaAuditPhoneSql('user_agent')}
        AND alert_key <> ?
      ORDER BY detected_at DESC
      LIMIT 1
    `).bind(deviceId, userA, userB, alertKey).first<{ id: string; detected_at: string }>(),
    ])
    const repeated = Boolean(prior && dateKeyWIB(prior.detected_at) !== day)
    const risk = calculateAgendaAccessRisk({
      accountSwitch: true,
      logoutThenLogin: Boolean(logout),
      repeatedDifferentDay: Boolean(repeated),
    })
    const reasons = parseJsonArray<AgendaAccessReason>(existing?.reasons_json)
    if (!reasons.includes('ACCOUNT_SWITCH_SAME_DEVICE')) reasons.push('ACCOUNT_SWITCH_SAME_DEVICE')
    if (logout) reasons.push('LOGOUT_THEN_OTHER_LOGIN')
    if (repeated && !reasons.includes('REPEATED_ON_DIFFERENT_DAY')) reasons.push('REPEATED_ON_DIFFERENT_DAY')
    const newEvidence: AgendaAccessEvidence[] = [
      ...(previous.action === 'login' ? [{
        type: 'login', at: previous.created_at, userId: previous.actor_user_id,
        userName: previous.actor_name, sessionId: previous.session_id,
        activityLogId: previous.id, summary: previous.summary,
      } as AgendaAccessEvidence] : []),
      ...(logout ? [{
        type: 'logout' as const, at: logout.created_at, userId: logout.actor_user_id,
        userName: logout.actor_name, sessionId: logout.session_id,
        activityLogId: logout.id, summary: logout.summary,
      }] : []),
      {
        type: 'login', at: now.toISOString(), userId: input.userId,
        userName: input.userName, sessionId: input.sessionId,
        activityLogId: input.activityLogId, summary: `${input.userName} login`,
      },
    ]
    const evidence = [...parseJsonArray<AgendaAccessEvidence>(existing?.evidence_json), ...newEvidence].slice(-20)
    const effectiveScore = Math.max(Number(existing?.risk_score || 0), risk.score)
    const id = crypto.randomUUID()
    await db.prepare(`
      INSERT INTO agenda_access_alerts (
        id, alert_key, source, detected_at, last_event_at, device_id, ip_address, user_agent,
        user_a_id, user_b_id, risk_score, risk_level, reasons_json, evidence_json, updated_at
      ) VALUES (?, ?, 'live', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(alert_key) DO UPDATE SET
        last_event_at = excluded.last_event_at,
        risk_score = MAX(agenda_access_alerts.risk_score, excluded.risk_score),
        risk_level = CASE
          WHEN MAX(agenda_access_alerts.risk_score, excluded.risk_score) >= 80 THEN 'high'
          WHEN MAX(agenda_access_alerts.risk_score, excluded.risk_score) >= 40 THEN 'medium'
          ELSE 'low' END,
        reasons_json = excluded.reasons_json,
        evidence_json = excluded.evidence_json,
        updated_at = excluded.updated_at
    `).bind(
      id, alertKey, now.toISOString(), now.toISOString(), deviceId,
      previous.ip_address || getIpAddress(hdrs), previous.user_agent || hdrs.get('user-agent'),
      userA, userB, effectiveScore, riskLevelForScore(effectiveScore), JSON.stringify(Array.from(new Set(reasons))), JSON.stringify(evidence), now.toISOString()
    ).run()
    return id
  } catch (error) {
    console.error('Gagal mendeteksi pergantian akun:', error)
    return null
  }
}

export async function recordAgendaAccessAudit(db: D1Database, input: {
  activityLogId: string | null
  agendaId: string
  actorUserId: string
  actorName: string
  ownerUserId: string
  summary: string
  isActingAs: boolean
}) {
  if (input.isActingAs) return
  try {
    await ensureAgendaAccessAuditSchema(db)
    if (input.actorUserId !== input.ownerUserId && await isGuruMapelAndGuruPplPair(db, input.actorUserId, input.ownerUserId)) {
      return
    }
    const hdrs = await headers()
    const deviceId = getDeviceId(hdrs)
    if (!deviceId) return
    const now = new Date()
    if (input.activityLogId) {
      const activity = await db.prepare('SELECT session_id FROM activity_logs WHERE id = ?')
        .bind(input.activityLogId).first<{ session_id: string | null }>()
      if (activity?.session_id) {
        await touchStaffDeviceSession(db, {
          sessionId: activity.session_id,
          userId: input.actorUserId,
          lastAgendaAt: now.toISOString(),
          lastAgendaId: input.agendaId,
          headers: hdrs,
        })
      }
    }
    if (!isAgendaAuditPhone(hdrs.get('user-agent'))) return
    const cutoff = new Date(now.getTime() - SWITCH_WINDOW_MS).toISOString()
    const alert = await db.prepare(`
      SELECT * FROM agenda_access_alerts
      WHERE source = 'live' AND device_id = ? AND last_event_at >= ?
        AND ${agendaAuditPhoneSql('user_agent')}
        AND (user_a_id = ? OR user_b_id = ?)
      ORDER BY last_event_at DESC LIMIT 1
    `).bind(deviceId, cutoff, input.actorUserId, input.actorUserId).first<any>()
    if (!alert) return
    if (await isGuruMapelAndGuruPplPair(db, alert.user_a_id, alert.user_b_id)) return

    const reasons = parseJsonArray<AgendaAccessReason>(alert.reasons_json)
    const evidence = parseJsonArray<AgendaAccessEvidence>(alert.evidence_json)
    if (!reasons.includes('AGENDA_AFTER_SWITCH')) reasons.push('AGENDA_AFTER_SWITCH')
    evidence.push({
      type: 'agenda', at: now.toISOString(), userId: input.actorUserId,
      userName: input.actorName, activityLogId: input.activityLogId,
      agendaId: input.agendaId, summary: input.summary,
    })
    const score = Math.max(Number(alert.risk_score) || 0, 40) + (alert.agenda_id ? 0 : 40)
    await db.prepare(`
      UPDATE agenda_access_alerts SET last_event_at = ?, risk_score = ?, risk_level = ?,
        reasons_json = ?, evidence_json = ?, agenda_id = ?, agenda_owner_id = ?, agenda_actor_id = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      now.toISOString(), score, riskLevelForScore(score), JSON.stringify(reasons), JSON.stringify(evidence.slice(-20)),
      input.agendaId, input.ownerUserId, input.actorUserId, now.toISOString(), alert.id
    ).run()
  } catch (error) {
    console.error('Gagal memperbarui audit akses agenda:', error)
  }
}

export async function getAgendaAccessBlock(db: D1Database, userId: string) {
  await ensureAgendaAccessAuditSchema(db)
  return db.prepare(`
    SELECT reason, blocked_at, blocked_by_name
    FROM agenda_access_blocks WHERE user_id = ? AND is_active = 1
  `).bind(userId).first<{ reason: string; blocked_at: string; blocked_by_name: string | null }>()
}

export async function getAgendaAccessWarningForUser(db: D1Database, userId: string): Promise<AgendaAccessWarning | null> {
  await ensureAgendaAccessAuditSchema(db)
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [alert, block] = await Promise.all([
    db.prepare(`
      SELECT last_event_at, risk_level, user_a_id, user_b_id FROM agenda_access_alerts
      WHERE source = 'live' AND (user_a_id = ? OR user_b_id = ?) AND last_event_at >= ?
        AND ${agendaAuditPhoneSql('user_agent')}
      ORDER BY last_event_at DESC LIMIT 1
    `).bind(userId, userId, cutoff).first<{ last_event_at: string; risk_level: 'low' | 'medium' | 'high'; user_a_id: string; user_b_id: string }>(),
    getAgendaAccessBlock(db, userId),
  ])
  if (!alert && !block) return null
  if (alert && await isGuruMapelAndGuruPplPair(db, alert.user_a_id, alert.user_b_id)) {
    if (!block) return null
    return {
      detectedAt: block.blocked_at,
      riskLevel: 'high',
      isBlocked: true,
      blockReason: block.reason,
    }
  }
  return {
    detectedAt: alert?.last_event_at || block!.blocked_at,
    riskLevel: alert?.risk_level || 'high',
    isBlocked: Boolean(block),
    blockReason: block?.reason || null,
  }
}

export function parseJsonArray<T>(value: string | null | undefined): T[] {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function dateKeyWIB(date: Date | string) {
  const value = typeof date === 'string' ? new Date(date) : date
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value)
  const get = (type: string) => parts.find(part => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function stableAuditHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function getIpAddress(hdrs: Headers) {
  return hdrs.get('cf-connecting-ip') || hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || null
}
