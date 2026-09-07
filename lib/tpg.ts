export const TPG_CKH_ROLES = ['guru']

export const TPG_S36_REQUIRED_ROLES = ['guru']

export type TpgUserStatus = {
  id: string
  nama_lengkap: string
  role: string
  roles: string | null
  nip: string | null
  pangkat_golongan: string | null
  jabatan_cetak: string | null
  nomor_whatsapp: string | null
  nuptk: string | null
  nrg: string | null
  no_urut: string | null
  signature_url: string | null
  s36_period_year: number | null
  s36_period_month: number | null
  s36_original_filename: string | null
  s36_file_size: number | null
  s36_uploaded_at: string | null
  ckh_document_id: string | null
  ckh_status: string | null
  ckh_updated_at: string | null
  ckh_row_count: number
  signature_enabled: number | null
}

export function isTpgProfileComplete(user: {
  nama_lengkap?: string | null
  nip?: string | null
  nrg?: string | null
  pangkat_golongan?: string | null
  nomor_whatsapp?: string | null
  no_urut?: string | null
}) {
  return Boolean(
    user.nama_lengkap?.trim() &&
    user.nip?.trim() &&
    user.nrg?.trim() &&
    user.pangkat_golongan?.trim() &&
    user.nomor_whatsapp?.trim() &&
    user.no_urut?.trim()
  )
}

export function getTpgMissingProfileFields(user: {
  nama_lengkap?: string | null
  nip?: string | null
  nrg?: string | null
  pangkat_golongan?: string | null
  nomor_whatsapp?: string | null
  no_urut?: string | null
}) {
  const missing: string[] = []
  if (!user.nama_lengkap?.trim()) missing.push('Nama')
  if (!user.nip?.trim()) missing.push('NIP')
  if (!user.nrg?.trim()) missing.push('NRG')
  if (!user.pangkat_golongan?.trim()) missing.push('Pangkat/Gol')
  if (!user.nomor_whatsapp?.trim()) missing.push('No. WA')
  if (!user.no_urut?.trim()) missing.push('No. Urut')
  return missing
}

export function isS36RequiredForRoles(primaryRole: string | null | undefined, roles: string | null | undefined) {
  const allRoles = new Set([primaryRole, ...(roles || '').split(',')].filter(Boolean))
  return TPG_S36_REQUIRED_ROLES.some(role => allRoles.has(role))
}

export function previousMonthPeriod(today = new Date()) {
  const date = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export function monthName(month: number) {
  if (month >= 1 && month <= 12) {
    return INDONESIAN_MONTHS[month - 1]
  }
  return ''
}

export function monthLabel(year: number, month: number) {
  const name = monthName(month)
  return name ? `${name} ${year}` : `${month}/${year}`
}

export function safeFileSegment(value: string | null | undefined) {
  return String(value || 'file')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'file'
}

