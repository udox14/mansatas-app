import { getSystemSettings } from '@/lib/system-settings'

export type OpeningBalanceMode = 'cumulative' | 'manual' | 'stored'
export type ProofNumberMode = 'manual' | 'automatic' | 'source_first'

export interface KomiteReportSettings {
  openingBalanceMode: OpeningBalanceMode
  proofNumberMode: ProofNumberMode
  signaturesEnabled: boolean
  treasurerName: string
  chairmanName: string
  principalName: string
}

export const KOMITE_REPORT_SETTING_KEYS = {
  openingBalanceMode: 'keuangan_komite_report_opening_balance_mode',
  proofNumberMode: 'keuangan_komite_report_proof_number_mode',
  signaturesEnabled: 'keuangan_komite_report_signatures_enabled',
  treasurerName: 'keuangan_komite_report_treasurer_name',
  chairmanName: 'keuangan_komite_report_chairman_name',
  principalName: 'keuangan_komite_report_principal_name',
} as const

export async function getKomiteReportSettings(): Promise<KomiteReportSettings> {
  const settings = await getSystemSettings({
    [KOMITE_REPORT_SETTING_KEYS.openingBalanceMode]: 'cumulative',
    [KOMITE_REPORT_SETTING_KEYS.proofNumberMode]: 'automatic',
    [KOMITE_REPORT_SETTING_KEYS.signaturesEnabled]: '1',
    [KOMITE_REPORT_SETTING_KEYS.treasurerName]: '',
    [KOMITE_REPORT_SETTING_KEYS.chairmanName]: '',
    [KOMITE_REPORT_SETTING_KEYS.principalName]: '',
  })
  const opening = settings[KOMITE_REPORT_SETTING_KEYS.openingBalanceMode]
  const proof = settings[KOMITE_REPORT_SETTING_KEYS.proofNumberMode]
  const enabled = settings[KOMITE_REPORT_SETTING_KEYS.signaturesEnabled]
  return {
    openingBalanceMode: ['cumulative', 'manual', 'stored'].includes(opening) ? opening as OpeningBalanceMode : 'cumulative',
    proofNumberMode: ['manual', 'automatic', 'source_first'].includes(proof) ? proof as ProofNumberMode : 'automatic',
    signaturesEnabled: enabled === '1' || enabled === 'true',
    treasurerName: settings[KOMITE_REPORT_SETTING_KEYS.treasurerName],
    chairmanName: settings[KOMITE_REPORT_SETTING_KEYS.chairmanName],
    principalName: settings[KOMITE_REPORT_SETTING_KEYS.principalName],
  }
}
