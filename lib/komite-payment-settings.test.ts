import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getKomitePaymentSettings, normalizeKomiteAccounts, selectKomitePaymentSettings } from './komite-payment-settings'
import { getSystemSettings } from './system-settings'
vi.mock('./system-settings', () => ({ getSystemSettings: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
describe('Komite payment settings by grade', () => {
  it('never falls back to legacy settings or defaults', async () => {
    vi.mocked(getSystemSettings).mockImplementation(async defaults => ({ ...defaults, keuangan_komite_rekening: 'legacy' }))
    const settings = await getKomitePaymentSettings()
    for (const grade of [10, 11, 12, null, 13, '']) {
      expect(selectKomitePaymentSettings(settings, grade)).toMatchObject({ accounts: [], qrisUrl: '', qrisEnabled: false })
    }
  })
  it('uses current grade and only exposes active accounts and available QRIS', async () => {
    vi.mocked(getSystemSettings).mockImplementation(async defaults => {
      const stored = { ...defaults }
      for (const grade of [10, 11, 12]) {
        stored[`keuangan_komite_${grade}_accounts`] = JSON.stringify([
          { id: `bank-${grade}`, bankLabel: 'Bank', rekening: `${grade}`, atasNama: 'Komite', isActive: true },
          { id: 'inactive', bankLabel: 'Bank', rekening: '0', atasNama: 'Komite', isActive: false },
        ])
        stored[`keuangan_komite_${grade}_qris_url`] = grade === 12 ? '' : `/qris-${grade}.png`
        stored[`keuangan_komite_${grade}_qris_enabled`] = grade === 11 ? '0' : '1'
      }
      return stored
    })
    const settings = await getKomitePaymentSettings()
    for (const grade of [10, 11, 12]) {
      const selected = selectKomitePaymentSettings(settings, String(grade))
      expect(selected.accounts.map(a => a.id)).toEqual([`bank-${grade}`])
      expect(selected.qrisEnabled).toBe(grade === 10)
      expect(selected).not.toHaveProperty('byGrade')
    }
  })
  it('handles malformed account data safely', () => {
    expect(normalizeKomiteAccounts('invalid')).toEqual([])
    expect(normalizeKomiteAccounts('[null, {}, 3]')).toEqual([])
  })
})
