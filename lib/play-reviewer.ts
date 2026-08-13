export const PLAY_REVIEWER_ROLE = 'play_reviewer'
export const PLAY_REVIEWER_LABEL = 'Google Play Reviewer (Read Only)'
export const PLAY_REVIEWER_WRITE_ERROR = 'Akun Google Play Reviewer hanya memiliki akses baca.'

const NAME_FIELDS = /^(nama_lengkap|nama_siswa|nama_pegawai|nama_guru|nama_ayah|nama_ibu|nama_wali|nama_orang_tua|student_name|teacher_name|parent_name|created_by_name|updated_by_name|actor_name|submitted_by)$/i
const EMAIL_FIELDS = /(^|_)(email|surel)$/i
const PHONE_FIELDS = /(^|_)(telepon|telp|phone|whatsapp|wa)(_|$)/i
const IDENTITY_FIELDS = /^(nisn|nis|nik|nip|nuptk|no_kk|nomor_kk|nomor_identitas|identity_number)$/i
const ADDRESS_FIELDS = /(^|_)(alamat|address|tempat_tinggal|desa_kelurahan)(_|$)/i
const BIRTH_FIELDS = /^(tanggal_lahir|tgl_lahir|date_of_birth|birth_date|tempat_lahir)$/i
const PRIVATE_TEXT_FIELDS = /^(catatan_pribadi|catatan_khusus|keterangan_medis|riwayat_penyakit)$/i
const PRIVATE_MEDIA_FIELDS = /(^|_)(avatar_url|foto_url|photo_url|tanda_tangan_url|signature_url)(_|$)/i
const PERSONAL_TABLES = /\b(siswa|user|users|pegawai|buku_tamu|parent_credentials|orang_tua|wali_siswa|pmb_pendaftar)\b/i

export function maskReviewerName(value: string): string {
  return value.replace(/[\p{L}\p{N}]+/gu, part => {
    const chars = Array.from(part)
    return chars.length <= 1 ? `${chars[0] || ''}*` : `${chars[0]}${'*'.repeat(chars.length - 1)}`
  })
}

function maskEmail(value: string): string {
  const [local, domain = ''] = value.split('@')
  if (!domain) return maskReviewerName(value)
  const domainParts = domain.split('.')
  return `${maskReviewerName(local)}@${domainParts.map(maskReviewerName).join('.')}`
}

function maskIdentifier(value: string): string {
  const chars = Array.from(value)
  if (chars.length <= 2) return '*'.repeat(Math.max(chars.length, 1))
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`
}

export function maskReviewerRecord<T>(record: T, sql = ''): T {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record
  const output: Record<string, unknown> = { ...(record as Record<string, unknown>) }

  for (const [key, rawValue] of Object.entries(output)) {
    if (rawValue == null) continue
    const value = String(rawValue)
    if (NAME_FIELDS.test(key) || (key.toLowerCase() === 'nama' && PERSONAL_TABLES.test(sql))) output[key] = maskReviewerName(value)
    else if (EMAIL_FIELDS.test(key)) output[key] = maskEmail(value)
    else if (PHONE_FIELDS.test(key) || IDENTITY_FIELDS.test(key)) output[key] = maskIdentifier(value)
    else if (ADDRESS_FIELDS.test(key) || PRIVATE_TEXT_FIELDS.test(key)) output[key] = '[disamarkan untuk reviewer]'
    else if (BIRTH_FIELDS.test(key)) output[key] = '[disamarkan]'
    else if (PRIVATE_MEDIA_FIELDS.test(key)) output[key] = null
  }

  return output as T
}

export function isReviewerReadSql(sql: string): boolean {
  const normalized = sql.replace(/^\s*(?:--[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/\s*)*/g, '').trim()
  if (/^(SELECT|PRAGMA|EXPLAIN)\b/i.test(normalized)) return true
  if (/^WITH\b/i.test(normalized)) {
    return !/\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP)\b/i.test(normalized)
  }
  // DDL idempoten diperlukan oleh schema guard lama ketika halaman pertama dibuka.
  return /^(CREATE\s+(TABLE|INDEX)\s+IF\s+NOT\s+EXISTS|ALTER\s+TABLE\b[\s\S]*\bADD\s+COLUMN\b)/i.test(normalized)
}

export function isPlayReviewerRole(roles: readonly string[]): boolean {
  return roles.includes(PLAY_REVIEWER_ROLE)
}
