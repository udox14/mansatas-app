import { enumerateDateStrings, getKalenderEventsForRange, hariNumFromDateString } from '@/lib/kalender-pendidikan'
import { formatNamaKelas } from '@/lib/utils'

export const CKH_TEACHING_ACTIVITY = 'Melaksanakan proses pembelajaran'
export const CKH_OTHER_DUTY_ACTIVITY = 'Melaksanakan tugas dinas lainnya'
export const CKH_DEFAULT_VOL = 1
export const CKH_DEFAULT_SATUAN = 'Kegiatan'

export type CkhGeneratedRow = {
  tanggal: string
  kegiatan_bulanan: string
  catatan_harian: string
  source: 'autofill' | 'calendar'
  source_key: string
}

export type CkhTemplate = {
  id: string
  role: string
  jabatan_cetak: string | null
  title: string
  sort_order: number
  is_active: number
  notes: CkhTemplateNote[]
}

export type CkhTemplateNote = {
  id: string
  template_id: string
  note: string
  sort_order: number
  is_active: number
}

export function monthRange(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { startDate, endDate, lastDay }
}

export function formatCkhDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export function formatCkhMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  }).toUpperCase()
}

export function normalizeCkhText(value: string | null | undefined) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function joinIndonesian(items: string[]) {
  const clean = items.filter(Boolean)
  if (clean.length <= 1) return clean[0] || ''
  if (clean.length === 2) return `${clean[0]} dan ${clean[1]}`
  return `${clean.slice(0, -1).join(', ')} dan ${clean[clean.length - 1]}`
}

export async function getCkhEffectiveDates(db: D1Database, year: number, month: number) {
  const { startDate, endDate } = monthRange(year, month)
  const events = await getKalenderEventsForRange(db, startDate, endDate)
  const byDate = new Map<string, typeof events>()

  for (const event of events) {
    for (const tanggal of enumerateDateStrings(event.start_date, event.end_date)) {
      if (tanggal < startDate || tanggal > endDate) continue
      if (!byDate.has(tanggal)) byDate.set(tanggal, [])
      byDate.get(tanggal)!.push(event)
    }
  }

  return enumerateDateStrings(startDate, endDate).filter(tanggal => {
    if (hariNumFromDateString(tanggal) === 7) return false
    const dayEvents = byDate.get(tanggal) || []
    const manual = dayEvents.find(event => event.source === 'manual')
    const official = dayEvents.find(event => event.source === 'official')
    const deciding = manual || official || dayEvents[0] || null
    if (!deciding) return true
    if (Number(deciding.is_effective) === 1) return true
    return !['TANGGAL_MERAH', 'LIBUR_SEMESTER'].includes(deciding.category)
  })
}

type AgendaRow = {
  tanggal: string
  materi: string | null
  nama_mapel: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
}

export function buildTeachingRows(rows: AgendaRow[]) {
  const grouped = new Map<string, Set<string>>()

  for (const row of rows) {
    const materi = normalizeCkhText(row.materi)
    if (!materi) continue
    const key = `${row.tanggal}::${row.nama_mapel}::${materi}`
    if (!grouped.has(key)) grouped.set(key, new Set())
    grouped.get(key)!.add(formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelompok))
  }

  return Array.from(grouped.entries()).map(([key, kelasSet]) => {
    const [tanggal, mapel, materi] = key.split('::')
    const kelas = Array.from(kelasSet).sort((a, b) => a.localeCompare(b, 'id-ID'))
    return {
      tanggal,
      kegiatan_bulanan: CKH_TEACHING_ACTIVITY,
      catatan_harian: `Mengajar ${mapel}: "${materi}" di kelas ${joinIndonesian(kelas)}`,
      source: 'autofill' as const,
      source_key: `agenda:${tanggal}:${mapel}:${materi}`,
    }
  })
}
