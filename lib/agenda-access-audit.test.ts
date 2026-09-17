import { describe, expect, it } from 'vitest'
import {
  calculateAgendaAccessRisk,
  canManageAgendaAccessAudit,
  canViewAgendaAccessAudit,
  dateKeyWIB,
  riskLevelForScore,
  stableAuditHash,
} from './agenda-access-audit'

describe('agenda access audit risk', () => {
  it('does not flag one account using multiple devices', () => {
    expect(calculateAgendaAccessRisk({ accountSwitch: false })).toEqual({ score: 0, level: 'low' })
  })

  it('rates a same-device account switch as medium', () => {
    expect(calculateAgendaAccessRisk({ accountSwitch: true })).toEqual({ score: 40, level: 'medium' })
  })

  it('rates logout, account switch, and agenda submission as high', () => {
    expect(calculateAgendaAccessRisk({ accountSwitch: true, logoutThenLogin: true, agendaAfterSwitch: true }))
      .toEqual({ score: 100, level: 'high' })
  })

  it('rates a repeated cross-account device pattern as high', () => {
    expect(calculateAgendaAccessRisk({ accountSwitch: true, repeatedDifferentDay: true }))
      .toEqual({ score: 80, level: 'high' })
  })

  it('caps historical indicators at medium', () => {
    expect(calculateAgendaAccessRisk({ accountSwitch: true, logoutThenLogin: true, agendaAfterSwitch: true, historical: true }))
      .toEqual({ score: 79, level: 'medium' })
  })

  it('uses stable WIB dates and hashes', () => {
    expect(dateKeyWIB('2026-09-01T18:00:00.000Z')).toBe('2026-09-02')
    expect(stableAuditHash('same')).toBe(stableAuditHash('same'))
    expect(riskLevelForScore(80)).toBe('high')
  })

  it('limits audit viewing to super admin, principal, and curriculum vice principal', () => {
    expect(canViewAgendaAccessAudit(['super_admin'])).toBe(true)
    expect(canViewAgendaAccessAudit(['kepsek'])).toBe(true)
    expect(canViewAgendaAccessAudit(['wakamad'], 'jbt_waka_kurikulum')).toBe(true)
    expect(canViewAgendaAccessAudit(['wakamad'], 'jbt_waka_sarpras')).toBe(false)
    expect(canViewAgendaAccessAudit(['guru'])).toBe(false)
  })

  it('allows only super admin to manage blocks', () => {
    expect(canManageAgendaAccessAudit(['super_admin'])).toBe(true)
    expect(canManageAgendaAccessAudit(['kepsek'])).toBe(false)
    expect(canManageAgendaAccessAudit(['wakamad'])).toBe(false)
  })
})
