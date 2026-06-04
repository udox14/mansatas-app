import { getSystemSetting } from '@/lib/system-settings'

export type KomitePaymentAccount = {
  id: string
  bankLabel: string
  rekening: string
  atasNama: string
  isActive: boolean
}

export type KomitePaymentSettings = {
  accounts: KomitePaymentAccount[]
  whatsapp: string
  qrisUrl: string
  qrisEnabled: boolean
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function normalizeKomiteAccounts(raw: string): KomitePaymentAccount[] {
  const parsed = raw ? safeJsonParse<KomitePaymentAccount[]>(raw) : null
  if (!Array.isArray(parsed)) return []

  return parsed
    .map((item, index) => ({
      id: String(item.id || `rekening-${index + 1}`),
      bankLabel: String(item.bankLabel || '').trim(),
      rekening: String(item.rekening || '').trim(),
      atasNama: String(item.atasNama || '').trim(),
      isActive: item.isActive !== false,
    }))
    .filter((item) => item.bankLabel && item.rekening && item.atasNama)
}

export async function getKomitePaymentSettings(): Promise<KomitePaymentSettings> {
  const [accountsRaw, bankLabel, rekening, atasNama, whatsapp, qrisUrl, qrisEnabledRaw] = await Promise.all([
    getSystemSetting('keuangan_komite_accounts', ''),
    getSystemSetting('keuangan_komite_bank_label', 'BJB Syariah'),
    getSystemSetting('keuangan_komite_rekening', '5160256984318'),
    getSystemSetting('keuangan_komite_atas_nama', 'Komite MAN 1 Tasikmalaya'),
    getSystemSetting('keuangan_komite_whatsapp', '6282215860650'),
    getSystemSetting('keuangan_komite_qris_url', '/QRISkomite.jpeg'),
    getSystemSetting('keuangan_komite_qris_enabled', '1'),
  ])

  const accounts = normalizeKomiteAccounts(accountsRaw)
  if (accounts.length === 0 && bankLabel && rekening && atasNama) {
    accounts.push({
      id: 'rekening-1',
      bankLabel,
      rekening,
      atasNama,
      isActive: true,
    })
  }

  return {
    accounts,
    whatsapp,
    qrisUrl,
    qrisEnabled: qrisEnabledRaw !== '0' && qrisEnabledRaw.toLowerCase() !== 'false',
  }
}
