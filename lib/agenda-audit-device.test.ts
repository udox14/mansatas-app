import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { agendaAuditPhoneSql, isAgendaAuditPhone } from './agenda-audit-device'
import { buildAccountDeviceInventory, type StaffDeviceSessionRow } from './staff-device-sessions'
import { getAgendaAccessWarningForUser, recordAgendaAccessAudit, recordLoginAccessAudit } from './agenda-access-audit'

const { requestHeaders, touchSession } = vi.hoisted(() => ({
  requestHeaders: vi.fn(), touchSession: vi.fn(),
}))
vi.mock('next/headers', () => ({ headers: requestHeaders }))
vi.mock('@/lib/schema-guard', () => ({ ensureSchemaOnce: vi.fn() }))
vi.mock('@/lib/device-identity', () => ({ getDeviceId: () => 'device-1' }))
vi.mock('@/lib/staff-device-sessions', async importOriginal => ({
  ...await importOriginal<typeof import('./staff-device-sessions')>(),
  touchStaffDeviceSession: touchSession,
}))

const android = 'Mozilla/5.0 (Linux; Android 15; 23021RAA2Y; wv) Chrome/151.0 Mobile Safari/537.36'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile Safari/604.1'
const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0 Safari/537.36'
const agents = [
  [android, true], [iphone, true],
  [windows, false],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1', false],
  ['Mozilla/5.0 (X11; Linux x86_64) Chrome/128.0', false],
  ['Mozilla/5.0 (Linux; Android 14; Tablet; wv) Mobile Safari/537.36', false],
  ['Mozilla/5.0 (Linux; Android 14) Safari/537.36', false],
  ['Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) Mobile Safari/604.1', false],
  [null, false], ['', false], ['Unknown browser', false],
] as const

afterEach(() => vi.clearAllMocks())

describe('phone scope for Agenda audit', () => {
  it.each(agents)('classifies %s consistently in live detection and SQL', (ua, included) => {
    const sqlite = new DatabaseSync(':memory:')
    try {
      sqlite.exec('CREATE TABLE devices (user_agent TEXT)')
      sqlite.prepare('INSERT INTO devices VALUES (?)').run(ua)
      const result = sqlite.prepare(`SELECT COUNT(*) AS total FROM devices WHERE ${agendaAuditPhoneSql('user_agent')}`).get()!
      expect(isAgendaAuditPhone(ua)).toBe(included)
      expect(result.total).toBe(included ? 1 : 0)
    } finally { sqlite.close() }
  })

  it('filters old desktop alerts before counts and pagination', () => {
    const sqlite = new DatabaseSync(':memory:')
    try {
      sqlite.exec('CREATE TABLE alerts (id TEXT, user_agent TEXT, risk_level TEXT)')
      sqlite.prepare('INSERT INTO alerts VALUES (?, ?, ?)').run('desktop', windows, 'high')
      sqlite.prepare('INSERT INTO alerts VALUES (?, ?, ?)').run('phone', android, 'medium')
      const where = agendaAuditPhoneSql('user_agent')
      expect(sqlite.prepare(`SELECT id FROM alerts WHERE ${where} ORDER BY id LIMIT 1`).get()!.id).toBe('phone')
      expect(sqlite.prepare(`SELECT COUNT(*) AS total FROM alerts WHERE ${where}`).get()!.total).toBe(1)
      expect(sqlite.prepare(`SELECT risk_level FROM alerts WHERE ${where} GROUP BY risk_level`).all()).toHaveLength(1)
      expect(sqlite.prepare('SELECT COUNT(*) AS total FROM alerts').get()!.total).toBe(2)
    } finally { sqlite.close() }
  })

  it('counts only phone sessions and preserves multiple-phone detection', () => {
    const rows = [android, windows, iphone].map((ua, index) => ({
      session_id: `session-${index}`, device_id: `device-${index}`, user_id: 'teacher',
      user_name: 'Guru', user_email: null, first_seen_at: '2026-10-01', last_seen_at: '2026-10-02',
      ip_address: null, user_agent: ua, last_agenda_at: null, last_agenda_id: null, is_active: 1,
    } satisfies StaffDeviceSessionRow))
    const [account] = buildAccountDeviceInventory(rows.filter(row => isAgendaAuditPhone(row.user_agent)))
    expect(account.activeDeviceCount).toBe(2)
    expect(account.activeSessionCount).toBe(2)
    expect(account.knownDeviceCount).toBe(2)
    expect(account.devices.map(device => device.userAgent)).toEqual([android, iphone])
  })

  it('records a laptop session without querying for account-switch alerts', async () => {
    requestHeaders.mockResolvedValue(new Headers({ 'user-agent': windows }))
    const prepare = vi.fn()
    const result = await recordLoginAccessAudit({ prepare } as unknown as D1Database, {
      activityLogId: null, userId: 'teacher', userName: 'Guru', sessionId: 'session',
    })
    expect(result).toBeNull()
    expect(touchSession).toHaveBeenCalledOnce()
    expect(prepare).not.toHaveBeenCalled()
  })

  it('still checks phone account switching against phone activity', async () => {
    requestHeaders.mockResolvedValue(new Headers({ 'user-agent': android }))
    const statement = { bind: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) }
    const prepare = vi.fn().mockReturnValue(statement)
    await recordLoginAccessAudit({ prepare } as unknown as D1Database, {
      activityLogId: null, userId: 'teacher', userName: 'Guru', sessionId: 'session',
    })
    expect(prepare).toHaveBeenCalledOnce()
    expect(prepare.mock.calls[0][0]).toContain(agendaAuditPhoneSql('user_agent'))
  })

  it('does not escalate old alerts after agenda submission from a laptop', async () => {
    requestHeaders.mockResolvedValue(new Headers({ 'user-agent': windows }))
    const prepare = vi.fn()
    await recordAgendaAccessAudit({ prepare } as unknown as D1Database, {
      activityLogId: null, agendaId: 'agenda', actorUserId: 'teacher', actorName: 'Guru',
      ownerUserId: 'teacher', summary: 'Agenda', isActingAs: false,
    })
    expect(prepare).not.toHaveBeenCalled()
  })

  it('limits user warnings to phone alerts while preserving explicit blocks', async () => {
    const prepare = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) })
    expect(await getAgendaAccessWarningForUser({ prepare } as unknown as D1Database, 'teacher')).toBeNull()
    expect(prepare.mock.calls[0][0]).toContain(agendaAuditPhoneSql('user_agent'))
    expect(prepare.mock.calls[1][0]).toContain('agenda_access_blocks')
  })
})
