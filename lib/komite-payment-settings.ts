import { getSystemSettings } from '@/lib/system-settings'

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
  const settings = await getSystemSettings({
    keuangan_komite_accounts: '',
    keuangan_komite_bank_label: 'BJB Syariah',
    keuangan_komite_rekening: '5160256984318',
    keuangan_komite_atas_nama: 'Komite MAN 1 Tasikmalaya',
    keuangan_komite_whatsapp: '6282215860650',
    keuangan_komite_qris_url: '/QRISkomite.jpeg',
    keuangan_komite_qris_enabled: '1',
  })
  const accountsRaw = settings.keuangan_komite_accounts
  const bankLabel = settings.keuangan_komite_bank_label
  const rekening = settings.keuangan_komite_rekening
  const atasNama = settings.keuangan_komite_atas_nama

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
    whatsapp: settings.keuangan_komite_whatsapp,
    qrisUrl: settings.keuangan_komite_qris_url,
    qrisEnabled: settings.keuangan_komite_qris_enabled !== '0' && settings.keuangan_komite_qris_enabled.toLowerCase() !== 'false',
  }
}
