import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSystemSettings = vi.fn()

vi.mock('@/lib/system-settings', () => ({ getSystemSettings }))

describe('getKomiteReportSettings', () => {
  beforeEach(() => getSystemSettings.mockReset())

  it('membaca seluruh pengaturan dalam satu operasi bulk', async () => {
    getSystemSettings.mockResolvedValue({
      keuangan_komite_report_opening_balance_mode: 'stored',
      keuangan_komite_report_proof_number_mode: 'manual',
      keuangan_komite_report_signatures_enabled: 'true',
      keuangan_komite_report_treasurer_name: 'Bendahara',
      keuangan_komite_report_chairman_name: 'Ketua',
      keuangan_komite_report_principal_name: 'Kepala',
    })

    const { getKomiteReportSettings } = await import('./komite-report-settings')
    const result = await getKomiteReportSettings()

    expect(getSystemSettings).toHaveBeenCalledTimes(1)
    expect(getSystemSettings).toHaveBeenCalledWith({
      keuangan_komite_report_opening_balance_mode: 'cumulative',
      keuangan_komite_report_proof_number_mode: 'automatic',
      keuangan_komite_report_signatures_enabled: '1',
      keuangan_komite_report_treasurer_name: '',
      keuangan_komite_report_chairman_name: '',
      keuangan_komite_report_principal_name: '',
    })
    expect(result).toEqual({
      openingBalanceMode: 'stored',
      proofNumberMode: 'manual',
      signaturesEnabled: true,
      treasurerName: 'Bendahara',
      chairmanName: 'Ketua',
      principalName: 'Kepala',
    })
  })
})
