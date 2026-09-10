import { getSystemSetting } from '@/lib/system-settings'

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
  const [opening, proof, enabled, treasurer, chairman, principal] = await Promise.all([
    getSystemSetting(KOMITE_REPORT_SETTING_KEYS.openingBalanceMode, 'cumulative'),
    getSystemSetting(KOMITE_REPORT_SETTING_KEYS.proofNumberMode, 'automatic'),
    getSystemSetting(KOMITE_REPORT_SETTING_KEYS.signaturesEnabled, '1'),
    getSystemSetting(KOMITE_REPORT_SETTING_KEYS.treasurerName, ''),
    getSystemSetting(KOMITE_REPORT_SETTING_KEYS.chairmanName, ''),
    getSystemSetting(KOMITE_REPORT_SETTING_KEYS.principalName, ''),
  ])
  return {
    openingBalanceMode: ['cumulative', 'manual', 'stored'].includes(opening) ? opening as OpeningBalanceMode : 'cumulative',
    proofNumberMode: ['manual', 'automatic', 'source_first'].includes(proof) ? proof as ProofNumberMode : 'automatic',
    signaturesEnabled: enabled === '1' || enabled === 'true',
    treasurerName: treasurer,
    chairmanName: chairman,
    principalName: principal,
  }
}

