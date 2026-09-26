import { describe, expect, it } from 'vitest'
import { buildAccountDeviceInventory, type StaffDeviceSessionRow } from './staff-device-sessions'

function row(overrides: Partial<StaffDeviceSessionRow> = {}): StaffDeviceSessionRow {
  return {
    session_id: 'session-1',
    user_id: 'user-1',
    user_name: 'Guru Satu',
    user_email: 'guru1@example.test',
    device_id: 'device-phone',
    first_seen_at: '2026-09-20T01:00:00.000Z',
    last_seen_at: '2026-09-26T01:00:00.000Z',
    ip_address: '192.0.2.1',
    user_agent: 'Android Phone',
    last_agenda_at: null,
    last_agenda_id: null,
    is_active: 1,
    ...overrides,
  }
}

describe('staff device inventory', () => {
  it('counts one active phone for one account', () => {
    const [account] = buildAccountDeviceInventory([row()])
    expect(account.activeDeviceCount).toBe(1)
    expect(account.knownDeviceCount).toBe(1)
    expect(account.activeSessionCount).toBe(1)
  })

  it('counts a phone and laptop as two devices', () => {
    const [account] = buildAccountDeviceInventory([
      row(),
      row({ session_id: 'session-2', device_id: 'device-laptop', user_agent: 'Windows Laptop' }),
    ])
    expect(account.activeDeviceCount).toBe(2)
    expect(account.knownDeviceCount).toBe(2)
  })

  it('does not count two sessions on the same device as two devices', () => {
    const [account] = buildAccountDeviceInventory([
      row(),
      row({ session_id: 'session-2', first_seen_at: '2026-09-21T01:00:00.000Z' }),
    ])
    expect(account.activeDeviceCount).toBe(1)
    expect(account.activeSessionCount).toBe(2)
    expect(account.devices[0].sessionCount).toBe(2)
  })

  it('separates active devices from inactive device history', () => {
    const [account] = buildAccountDeviceInventory([
      row(),
      row({ session_id: 'old-session', device_id: 'old-phone', is_active: 0 }),
    ])
    expect(account.activeDeviceCount).toBe(1)
    expect(account.knownDeviceCount).toBe(2)
  })

  it('keeps the latest device and agenda evidence', () => {
    const [account] = buildAccountDeviceInventory([
      row({ last_seen_at: '2026-09-25T01:00:00.000Z', last_agenda_at: '2026-09-24T01:00:00.000Z', last_agenda_id: 'agenda-old' }),
      row({ session_id: 'session-2', last_seen_at: '2026-09-26T02:00:00.000Z', last_agenda_at: '2026-09-26T01:30:00.000Z', last_agenda_id: 'agenda-new' }),
    ])
    expect(account.lastSeenAt).toBe('2026-09-26T02:00:00.000Z')
    expect(account.devices[0].lastAgendaId).toBe('agenda-new')
  })
})
