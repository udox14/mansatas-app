import { headers } from 'next/headers'
import { getDeviceId } from '@/lib/device-identity'
import { ensureSchemaOnce } from '@/lib/schema-guard'

const TOUCH_INTERVAL_MS = 15 * 60 * 1000

export type StaffDeviceSessionRow = {
  session_id: string
  user_id: string
  user_name: string
  user_email: string | null
  device_id: string
  first_seen_at: string
  last_seen_at: string
  ip_address: string | null
  user_agent: string | null
  last_agenda_at: string | null
  last_agenda_id: string | null
  is_active: number
}

export type AccountDeviceDetail = {
  deviceId: string
  firstSeenAt: string
  lastSeenAt: string
  ipAddress: string | null
  userAgent: string | null
  lastAgendaAt: string | null
  lastAgendaId: string | null
  activeSessionCount: number
  sessionCount: number
}

export type AccountDeviceSummary = {
  userId: string
  userName: string
  userEmail: string | null
  activeDeviceCount: number
  knownDeviceCount: number
  activeSessionCount: number
  lastSeenAt: string
  devices: AccountDeviceDetail[]
}

export async function ensureStaffDeviceSessionsSchema(db: D1Database) {
  await ensureSchemaOnce('staff-device-sessions-v2', async () => {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS staff_device_sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        device_id TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        last_agenda_at TEXT,
        last_agenda_id TEXT,
        ended_at TEXT
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_staff_device_sessions_user_seen ON staff_device_sessions(user_id, last_seen_at DESC)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_staff_device_sessions_user_device ON staff_device_sessions(user_id, device_id, last_seen_at DESC)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_staff_device_sessions_device_seen ON staff_device_sessions(device_id, last_seen_at DESC)'),
    ])
    try {
      await db.prepare('ALTER TABLE staff_device_sessions ADD COLUMN ended_at TEXT').run()
    } catch {
      // Kolom sudah tersedia.
    }
  })
}

export async function touchStaffDeviceSession(db: D1Database, input: {
  sessionId: string
  userId: string
  lastAgendaAt?: string | null
  lastAgendaId?: string | null
  headers?: Headers | null
}) {
  if (!input.sessionId || !input.userId) return false
  const hdrs = input.headers === undefined ? await headers().catch(() => null) : input.headers
  const deviceId = getDeviceId(hdrs)
  if (!deviceId) return false

  await ensureStaffDeviceSessionsSchema(db)
  const now = new Date()
  const nowIso = now.toISOString()
  const updateCutoff = new Date(now.getTime() - TOUCH_INTERVAL_MS).toISOString()
  await db.batch([
    db.prepare(`
      UPDATE staff_device_sessions SET ended_at = ?
      WHERE device_id = ? AND session_id <> ? AND ended_at IS NULL
    `).bind(nowIso, deviceId, input.sessionId),
    db.prepare(`
    INSERT INTO staff_device_sessions (
      session_id, user_id, device_id, first_seen_at, last_seen_at,
      ip_address, user_agent, last_agenda_at, last_agenda_id, ended_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(session_id) DO UPDATE SET
      user_id = excluded.user_id,
      device_id = excluded.device_id,
      last_seen_at = excluded.last_seen_at,
      ip_address = excluded.ip_address,
      user_agent = excluded.user_agent,
      last_agenda_at = COALESCE(excluded.last_agenda_at, staff_device_sessions.last_agenda_at),
      last_agenda_id = COALESCE(excluded.last_agenda_id, staff_device_sessions.last_agenda_id),
      ended_at = NULL
    WHERE staff_device_sessions.last_seen_at < ?
       OR staff_device_sessions.device_id <> excluded.device_id
       OR COALESCE(staff_device_sessions.ip_address, '') <> COALESCE(excluded.ip_address, '')
       OR COALESCE(staff_device_sessions.user_agent, '') <> COALESCE(excluded.user_agent, '')
       OR excluded.last_agenda_at IS NOT NULL
       OR staff_device_sessions.ended_at IS NOT NULL
  `).bind(
    input.sessionId, input.userId, deviceId, nowIso, nowIso,
    getIpAddress(hdrs), hdrs?.get('user-agent') || null,
    input.lastAgendaAt || null, input.lastAgendaId || null, updateCutoff,
  ),
  ])
  return true
}

export function buildAccountDeviceInventory(rows: StaffDeviceSessionRow[]): AccountDeviceSummary[] {
  const accounts = new Map<string, AccountDeviceSummary>()

  for (const row of rows) {
    let account = accounts.get(row.user_id)
    if (!account) {
      account = {
        userId: row.user_id,
        userName: row.user_name,
        userEmail: row.user_email,
        activeDeviceCount: 0,
        knownDeviceCount: 0,
        activeSessionCount: 0,
        lastSeenAt: row.last_seen_at,
        devices: [],
      }
      accounts.set(row.user_id, account)
    }

    let device = account.devices.find(item => item.deviceId === row.device_id)
    if (!device) {
      device = {
        deviceId: row.device_id,
        firstSeenAt: row.first_seen_at,
        lastSeenAt: row.last_seen_at,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        lastAgendaAt: row.last_agenda_at,
        lastAgendaId: row.last_agenda_id,
        activeSessionCount: 0,
        sessionCount: 0,
      }
      account.devices.push(device)
    }

    device.sessionCount += 1
    if (row.is_active) device.activeSessionCount += 1
    if (row.first_seen_at < device.firstSeenAt) device.firstSeenAt = row.first_seen_at
    if (row.last_seen_at > device.lastSeenAt) {
      device.lastSeenAt = row.last_seen_at
      device.ipAddress = row.ip_address
      device.userAgent = row.user_agent
    }
    if (row.last_agenda_at && (!device.lastAgendaAt || row.last_agenda_at > device.lastAgendaAt)) {
      device.lastAgendaAt = row.last_agenda_at
      device.lastAgendaId = row.last_agenda_id
    }
    if (row.last_seen_at > account.lastSeenAt) account.lastSeenAt = row.last_seen_at
  }

  for (const account of accounts.values()) {
    account.devices.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    account.knownDeviceCount = account.devices.length
    account.activeDeviceCount = account.devices.filter(device => device.activeSessionCount > 0).length
    account.activeSessionCount = account.devices.reduce((sum, device) => sum + device.activeSessionCount, 0)
  }

  return [...accounts.values()].sort((a, b) =>
    b.activeDeviceCount - a.activeDeviceCount ||
    b.knownDeviceCount - a.knownDeviceCount ||
    a.userName.localeCompare(b.userName, 'id')
  )
}

function getIpAddress(hdrs: Headers | null) {
  if (!hdrs) return null
  return hdrs.get('cf-connecting-ip') || hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || null
}
