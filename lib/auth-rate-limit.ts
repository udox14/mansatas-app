import { logSecurityEvent } from '@/lib/security-log'

export type LoginActorType = 'staff' | 'parent'

const encoder = new TextEncoder()

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function getPepper(): string {
  const pepper = process.env.AUTH_RATE_LIMIT_PEPPER || process.env.BETTER_AUTH_SECRET
  if (!pepper) throw new Error('AUTH_RATE_LIMIT_PEPPER is not configured')
  return pepper
}

async function identifiers(actorType: LoginActorType, account: string, ip: string) {
  const pepper = getPepper()
  const normalizedAccount = actorType === 'staff'
    ? account.trim().toLowerCase()
    : account.replace(/\D/g, '')
  return {
    accountHash: await sha256Hex(`${pepper}|account|${actorType}|${normalizedAccount}`),
    ipHash: await sha256Hex(`${pepper}|ip|${ip || 'unknown'}`),
  }
}

async function ipIdentifier(ip: string) {
  return sha256Hex(`${getPepper()}|ip|${ip || 'unknown'}`)
}

export function getRequestIp(request: Request): string {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
}

export async function checkIpBlock(db: D1Database, ip: string) {
  const ipHash = await ipIdentifier(ip)
  const row = await db.prepare(`
    SELECT MAX(0, CAST(strftime('%s', blocked_until) AS INTEGER) - CAST(strftime('%s', 'now') AS INTEGER)) retry_after
    FROM auth_ip_blocks WHERE ip_hash = ? AND blocked_until > datetime('now')
  `).bind(ipHash).first<{ retry_after: number }>()
  return { blocked: Boolean(row?.retry_after), retryAfter: Number(row?.retry_after || 0), ipHash }
}

export async function blockIpForTenMinutes(db: D1Database, ip: string) {
  const ipHash = await ipIdentifier(ip)
  await db.prepare(`
    INSERT INTO auth_ip_blocks (ip_hash, blocked_until, updated_at)
    VALUES (?, datetime('now', '+10 minutes'), datetime('now'))
    ON CONFLICT(ip_hash) DO UPDATE SET blocked_until = excluded.blocked_until, updated_at = excluded.updated_at
  `).bind(ipHash).run()
  logSecurityEvent('warning', 'login_ip_rate_limited', { ipHash })
}

export async function checkLoginAllowed(
  db: D1Database,
  actorType: LoginActorType,
  account: string,
  ip: string
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  const { accountHash, ipHash } = await identifiers(actorType, account, ip)
  const [pairResult, accountResult] = await db.batch([
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM auth_login_attempts
      WHERE actor_type = ? AND account_hash = ? AND ip_hash = ?
        AND failed_at >= datetime('now', '-15 minutes')
    `).bind(actorType, accountHash, ipHash),
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM auth_login_attempts
      WHERE actor_type = ? AND account_hash = ?
        AND failed_at >= datetime('now', '-60 minutes')
    `).bind(actorType, accountHash),
  ])

  const pairCount = Number((pairResult.results?.[0] as { count?: number } | undefined)?.count || 0)
  const accountCount = Number((accountResult.results?.[0] as { count?: number } | undefined)?.count || 0)
  if (accountCount >= 20) return { allowed: false, retryAfter: 60 * 60 }
  if (pairCount >= 5) return { allowed: false, retryAfter: 15 * 60 }
  return { allowed: true }
}

export async function recordLoginFailure(
  db: D1Database,
  actorType: LoginActorType,
  account: string,
  ip: string
) {
  const { accountHash, ipHash } = await identifiers(actorType, account, ip)
  await db.batch([
    db.prepare(`DELETE FROM auth_login_attempts WHERE failed_at < datetime('now', '-24 hours')`),
    db.prepare(`
      INSERT INTO auth_login_attempts (actor_type, account_hash, ip_hash, failed_at)
      VALUES (?, ?, ?, datetime('now'))
    `).bind(actorType, accountHash, ipHash),
  ])
  logSecurityEvent('warning', 'login_failed', { actorType, accountHash, ipHash })
}

export async function clearLoginFailures(
  db: D1Database,
  actorType: LoginActorType,
  account: string,
  ip: string
) {
  const { accountHash, ipHash } = await identifiers(actorType, account, ip)
  await db.prepare(`
    DELETE FROM auth_login_attempts
    WHERE actor_type = ? AND account_hash = ? AND ip_hash = ?
  `).bind(actorType, accountHash, ipHash).run()
}
