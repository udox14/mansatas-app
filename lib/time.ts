/**
 * Utility functions untuk timezone WIB (Asia/Jakarta, UTC+7)
 * Digunakan di seluruh aplikasi agar semua perhitungan tanggal/jam
 * menggunakan waktu lokal Kab. Tasikmalaya (WIB).
 *
 * PENTING: Jangan pakai new Date().toISOString() untuk tanggal lokal —
 * itu akan menghasilkan UTC (selisih 7 jam dari WIB).
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000 // UTC+7

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
  return nowWIB().toISOString().split('T')[0]
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
  return nowWIB().toISOString()
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
