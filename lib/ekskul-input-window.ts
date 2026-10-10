import { dateToWIBString } from './time'

export const EKSKUL_INPUT_RULE = 'Input kegiatan hanya tersedia pukul 13.00–14.30 WIB pada hari jadwal latihan.'
const HARI_NAMA = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export function parseHariLatihan(value: unknown): number[] {
  if (value === null || value === undefined || value === '') return []
  try {
    const parsed: unknown = typeof value === 'number' ? value : JSON.parse(String(value))
    return (Array.isArray(parsed) ? parsed : [parsed]).map(Number)
      .filter(hari => Number.isInteger(hari) && hari >= 1 && hari <= 7)
  } catch {
    return []
  }
}

export function getEkskulInputWindow(hariLatihanRaw: unknown, now = new Date()) {
  const hariLatihan = parseHariLatihan(hariLatihanRaw)
  const tanggal = dateToWIBString(now.toISOString())
  const hari = new Date(`${tanggal}T12:00:00Z`).getUTCDay() || 7
  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const menit = shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
  let error: string | null = null
  if (!hariLatihan.length) {
    error = 'Input kegiatan belum tersedia. Hari latihan belum diatur oleh admin.'
  } else if (!hariLatihan.includes(hari)) {
    error = `Hari ini bukan jadwal latihan. Input kegiatan tersedia pada hari ${hariLatihan.map(h => HARI_NAMA[h]).join(', ')} pukul 13.00–14.30 WIB.`
  } else if (menit < 13 * 60 || menit > 14 * 60 + 30) {
    error = 'Input kegiatan ditutup. Silakan input pada hari latihan pukul 13.00–14.30 WIB.'
  }
  return { allowed: error === null, error, tanggal }
}
