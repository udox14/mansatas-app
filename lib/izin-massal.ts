// Lokasi: lib/izin-massal.ts
// Helper murni untuk input izin tidak masuk kelas massal (per kegiatan/event).
export const MAX_SISWA_MASSAL = 100
export const MAX_HARI_MASSAL = 60

const TANGGAL_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function isValidTanggal(value: string | null | undefined): value is string {
  return !!value && TANGGAL_REGEX.test(value)
}

export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function buildTanggalRange(mulai: string, selesai: string): string[] {
  if (!isValidTanggal(mulai) || !isValidTanggal(selesai)) return []

  const start = new Date(`${mulai}T00:00:00`)
  const end = new Date(`${selesai}T00:00:00`)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return []

  const dates: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    dates.push(toDateString(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export function pasanganKunci(siswaId: string, tanggal: string) {
  return `${siswaId}|${tanggal}`
}

export function rencanaIzinMassal(input: {
  siswaIds: string[]
  tanggalList: string[]
  existingPairs: string[]
}): { dibuat: Array<{ siswaId: string; tanggal: string }>; dilewati: number } {
  const existing = new Set(input.existingPairs)
  const dibuat: Array<{ siswaId: string; tanggal: string }> = []
  let dilewati = 0

  for (const siswaId of input.siswaIds) {
    for (const tanggal of input.tanggalList) {
      if (existing.has(pasanganKunci(siswaId, tanggal))) {
        dilewati++
      } else {
        dibuat.push({ siswaId, tanggal })
      }
    }
  }

  return { dibuat, dilewati }
}

export function gabungKeterangan(namaKegiatan: string, keterangan?: string | null): string {
  const nama = namaKegiatan.trim()
  const detail = keterangan?.trim()
  return detail ? `${nama} — ${detail}` : nama
}

export function normalisasiJamPelajaran(jams: Array<number | string> | null | undefined): number[] | null {
  if (!jams || jams.length === 0) return null
  const normalized = Array.from(new Set(
    jams.map(jam => Number(jam)).filter(jam => Number.isInteger(jam) && jam >= 1 && jam <= 10)
  )).sort((a, b) => a - b)
  return normalized.length > 0 ? normalized : null
}
