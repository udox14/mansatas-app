export const TPG_CKH_ROLES = [
  'super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas',
  'guru_bk', 'guru_piket', 'guru_tahfidz', 'operator', 'pramubakti', 'satpam',
]

export const TPG_S36_REQUIRED_ROLES = ['guru', 'guru_bk', 'wali_kelas', 'guru_tahfidz']

export type TpgUserStatus = {
  id: string
  nama_lengkap: string
  role: string
  roles: string | null
  nip: string | null
  jabatan_cetak: string | null
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

export function isS36RequiredForRoles(primaryRole: string | null | undefined, roles: string | null | undefined) {
  const allRoles = new Set([primaryRole, ...(roles || '').split(',')].filter(Boolean))
  return TPG_S36_REQUIRED_ROLES.some(role => allRoles.has(role))
}

export function previousMonthPeriod(today = new Date()) {
  const date = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

export function safeFileSegment(value: string | null | undefined) {
  return String(value || 'file')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'file'
}
