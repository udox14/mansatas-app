/**
 * Utility functions untuk timezone WIB (Asia/Jakarta, UTC+7)
 * Digunakan di seluruh aplikasi agar semua perhitungan tanggal/jam
 * menggunakan waktu lokal Kab. Tasikmalaya (WIB).
 *
 * PENTING: Jangan pakai new Date().toISOString() untuk tanggal lokal —
 * itu akan menghasilkan UTC (selisih 7 jam dari WIB).
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000 // UTC+7
export const WIB_TIME_ZONE = 'Asia/Jakarta'

function getWIBParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || '00'
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
    second: pick('second'),
    millisecond: String(date.getMilliseconds()).padStart(3, '0'),
  }
}

/**
 * Mengembalikan objek Date yang mewakili "sekarang" dalam WIB.
 * Gunakan ini sebagai pengganti `new Date()` ketika butuh jam/menit lokal.
 */
export function nowWIB(): Date {
  const utcMs = Date.now()
  // Buat Date baru dengan timestamp yang digeser +7 jam,
  // sehingga getHours()/getMinutes() mengembalikan waktu WIB.
  return new Date(utcMs + WIB_OFFSET_MS)
}

/**
 * Mengembalikan string tanggal hari ini dalam format YYYY-MM-DD (WIB).
 * Pengganti: new Date().toISOString().split('T')[0]
 */
export function todayWIB(): string {
  const p = getWIBParts()
  return `${p.year}-${p.month}-${p.day}`
}

/**
 * Mengembalikan jam dalam format "HH:MM" berdasarkan waktu WIB saat ini.
 */
export function currentTimeWIB(): { hours: number; minutes: number; hhmm: string } {
  const d = nowWIB()
  const hours = d.getUTCHours()
  const minutes = d.getUTCMinutes()
  return {
    hours,
    minutes,
    hhmm: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  }
}

/**
 * Mengembalikan string ISO Date hari ini versi WIB dalam format penuh.
 * Cocok untuk updated_at, created_at yang perlu timestamp penuh tapi berbasis WIB.
 */
export function nowWIBISO(): string {
  const p = getWIBParts()
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${p.millisecond}+07:00`
}

/**
 * Format timestamp ke jam WIB.
 *
 * Opsi legacyShiftedWIB dipakai untuk field lama yang pernah disimpan dengan
 * nowWIB().toISOString(): nilainya sudah WIB, tetapi akhiran "Z" membuat
 * browser menganggapnya UTC dan menambah 7 jam lagi.
 */
export function formatTimeWIB(
  value: string | null | undefined,
  options: { legacyShiftedWIB?: boolean; suffix?: boolean } = {}
): string {
  if (!value) return ''

  if (options.legacyShiftedWIB && /Z$/i.test(value)) {
    const match = value.match(/T(\d{2}):(\d{2})/)
    if (match) return `${match[1]}.${match[2]}${options.suffix === false ? '' : ' WIB'}`
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
  const parseable = hasExplicitZone ? normalized : `${normalized}Z`
  const date = new Date(parseable)
  if (isNaN(date.getTime())) return value

  const formatted = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: WIB_TIME_ZONE,
  }).format(date)

  return `${formatted}${options.suffix === false ? '' : ' WIB'}`
}

function parseTimestampAsUTC(value: string | Date): Date {
  if (value instanceof Date) return value
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
  return new Date(hasExplicitZone ? normalized : `${normalized}Z`)
}

function parseDateOnly(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function formatDateWIB(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
): string {
  if (!value) return ''
  const date = typeof value === 'string'
    ? parseDateOnly(value) ?? parseTimestampAsUTC(value)
    : value
  if (isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('id-ID', {
    ...options,
    timeZone: parseDateOnly(String(value)) ? undefined : WIB_TIME_ZONE,
  }).format(date)
}

export function formatDateTimeWIB(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
): string {
  if (!value) return ''
  const date = typeof value === 'string' ? parseTimestampAsUTC(value) : value
  if (isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('id-ID', {
    ...options,
    timeZone: WIB_TIME_ZONE,
  }).format(date)
}

export function dateInputWIB(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string'
    ? parseDateOnly(value) ?? parseTimestampAsUTC(value)
    : value
  if (isNaN(date.getTime())) return String(value)

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: typeof value === 'string' && parseDateOnly(value) ? undefined : WIB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

/**
 * Ambil tanggal dari timestamp ISO string, dikonversi ke WIB terlebih dahulu.
 * Berguna agar tanggal dari field updated_at/created_at tampil benar.
 */
export function dateToWIBString(isoString: string): string {
  const d = new Date(new Date(isoString).getTime() + WIB_OFFSET_MS)
  return d.toISOString().split('T')[0]
}

/**
 * Format tanggal dari "2024-05-12" menjadi "12 Mei 2024" (Bahasa Indonesia)
 */
export function formatTanggalPanjang(dateString: string): string {
  if (!dateString) return ''
  const tgl = new Date(dateString)
  if (isNaN(tgl.getTime())) return dateString
  
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(tgl)
}


/**
 * Parsing tanggal fleksibel yang mendukung:
 * - Date instance
 * - Angka serial Excel (misal 40179 -> 1 Januari 2010)
 * - Format ISO (YYYY-MM-DD atau YYYY-MM-DDTHH:mm:ss)
 * - Format garis miring/tanda hubung Indonesia (DD/MM/YYYY atau DD-MM-YYYY)
 */
export function parseFlexibleDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value

  const text = String(value).trim()
  if (!text || text === '-' || text === 'null' || text === 'undefined') return null

  // Deteksi nomor serial tanggal Excel (antara ~1954 s/d 2077)
  if (/^\d{4,5}$/.test(text)) {
    const num = Number(text)
    if (num >= 20000 && num <= 65000) {
      // 25569 adalah jumlah hari dari 1899-12-30/1900-01-01 ke 1970-01-01
      const ms = Math.round((num - 25569) * 86400 * 1000)
      const d = new Date(ms)
      if (!isNaN(d.getTime())) return d
    }
  }

  // Deteksi YYYY-MM-DD
  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (isoMatch) {
    const y = Number(isoMatch[1])
    const m = Number(isoMatch[2]) - 1
    const d = Number(isoMatch[3])
    const parsed = new Date(y, m, d)
    if (parsed.getFullYear() === y && parsed.getMonth() === m && parsed.getDate() === d) {
      return parsed
    }
  }

  // Deteksi DD/MM/YYYY atau DD-MM-YYYY
  const slashMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (slashMatch) {
    const d = Number(slashMatch[1])
    const m = Number(slashMatch[2]) - 1
    const y = Number(slashMatch[3])
    const parsed = new Date(y, m, d)
    if (parsed.getFullYear() === y && parsed.getMonth() === m && parsed.getDate() === d) {
      return parsed
    }
  }

  const general = new Date(text)
  return isNaN(general.getTime()) ? null : general
}

/**
 * Format tanggal ke bahasa Indonesia secara aman.
 * Menghindari bug seperti "1/1/40179" jika input berupa serial Excel.
 */
export function formatTanggalIndoSafe(value: unknown, fallback = '-'): string {
  if (!value && value !== 0) return fallback
  const d = parseFlexibleDate(value)
  if (!d) return String(value).trim() || fallback

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

/**
 * Konversi tanggal ke string "YYYY-MM-DD" untuk <input type="date">.
 */
export function dateToInputFormatSafe(value: unknown): string {
  if (!value && value !== 0) return ''
  const d = parseFlexibleDate(value)
  if (!d) return ''

  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${date}`
}
