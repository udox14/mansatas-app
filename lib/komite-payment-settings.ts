import { getSystemSettings } from '@/lib/system-settings'

export const KOMITE_GRADES = [10, 11, 12] as const
export type KomiteGrade = typeof KOMITE_GRADES[number]
export type KomitePaymentAccount = {
  id: string
  bankLabel: string
  rekening: string
  atasNama: string
  isActive: boolean
}
export type KomiteGradePaymentSettings = {
  accounts: KomitePaymentAccount[]
  qrisUrl: string
  qrisEnabled: boolean
}
export type KomitePaymentSettings = {
  byGrade: Record<KomiteGrade, KomiteGradePaymentSettings>
  whatsapp: string
}
export function parseKomiteGrade(value: unknown): KomiteGrade | null {
  return value === 10 || value === '10' ? 10 : value === 11 || value === '11' ? 11 : value === 12 || value === '12' ? 12 : null
}
export function komiteGradeKeys(grade: KomiteGrade) {
  return {
    accounts: `keuangan_komite_${grade}_accounts`,
    qrisUrl: `keuangan_komite_${grade}_qris_url`,
    qrisEnabled: `keuangan_komite_${grade}_qris_enabled`,
  }
}
export function normalizeKomiteAccounts(raw: string): KomitePaymentAccount[] {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return [] }
  if (!Array.isArray(parsed)) return []
  const seen = new Set<string>()
  return parsed.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const account = {
      id: String(item.id || '').trim(),
      bankLabel: String(item.bankLabel || '').trim(),
      rekening: String(item.rekening || '').trim(),
      atasNama: String(item.atasNama || '').trim(),
      isActive: item.isActive !== false,
    }
    if (!account.id || !account.bankLabel || !account.rekening || !account.atasNama || seen.has(account.id)) return []
    seen.add(account.id)
    return [account]
  })
}
export function selectKomitePaymentSettings(settings: KomitePaymentSettings, tingkat: unknown) {
  const grade = parseKomiteGrade(tingkat)
  const selected = grade ? settings.byGrade[grade] : null
  return {
    tingkat: grade,
    whatsapp: settings.whatsapp,
    accounts: selected?.accounts.filter(account => account.isActive) ?? [],
    qrisUrl: selected?.qrisUrl ?? '',
    qrisEnabled: Boolean(selected?.qrisEnabled && selected.qrisUrl),
  }
}
export async function getKomitePaymentSettings(db?: D1Database): Promise<KomitePaymentSettings> {
  const defaults: Record<string, string> = { keuangan_komite_whatsapp: '6282215860650' }
  for (const grade of KOMITE_GRADES) {
    const keys = komiteGradeKeys(grade)
    defaults[keys.accounts] = ''
    defaults[keys.qrisUrl] = ''
    defaults[keys.qrisEnabled] = '0'
  }
  const stored = await getSystemSettings(defaults, db)
  const byGrade = {} as KomitePaymentSettings['byGrade']
  for (const grade of KOMITE_GRADES) {
    const keys = komiteGradeKeys(grade)
    byGrade[grade] = {
      accounts: normalizeKomiteAccounts(stored[keys.accounts]),
      qrisUrl: stored[keys.qrisUrl],
      qrisEnabled: stored[keys.qrisEnabled] === '1',
    }
  }
  return { byGrade, whatsapp: stored.keuangan_komite_whatsapp }
}
