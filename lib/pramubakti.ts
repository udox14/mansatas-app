import { teacherPerformance } from './teacher-leave'

export const PB_MONTHLY = 'Melaksanakan layanan kebersihan dan pemeliharaan lingkungan madrasah.'
export const PB_DAILY = 'Melaksanakan pekerjaan {pekerjaan} di {tempat}.'
export const PB_DAYS = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
export type PbSlot = { id: string; weekday: number; start: string; end: string }
export type PbVersion = { id: string; effective_date: string; slots: PbSlot[] }

export const DEFAULT_PB_SLOT_TIMES = [
  { start: '06:45', end: '08:00' },
  { start: '08:00', end: '10:00' },
  { start: '10:00', end: '12:00' },
  { start: '12:00', end: '15:00' },
]

export function getDefaultPbSlots(): PbSlot[] {
  const slots: PbSlot[] = []
  for (let weekday = 1; weekday <= 6; weekday++) {
    DEFAULT_PB_SLOT_TIMES.forEach((t, i) => {
      slots.push({
        id: `slot_${weekday}_${i + 1}`,
        weekday,
        start: t.start,
        end: t.end,
      })
    })
  }
  return slots
}

export const DEFAULT_PB_SLOTS: PbSlot[] = getDefaultPbSlots()
export type PbMember = { id: string; user_id: string; nama_lengkap: string; start_date: string; end_date: string | null }
export type PbHoliday = { id: string; start_date: string; end_date: string; reason: string }
export type PbJob = { id: string; name: string; sort_order: number; active: number }
export type PbReport = { id: string; user_id: string; tanggal: string; slot_id: string | null; jobs: string[]; tempat: string; foto_url: string; waktu_input: string; status: 'TEPAT_WAKTU' | 'TELAT' | 'TAMBAHAN'; revision: number }
export type PbLeave = { user_id: string; tanggal: string; slot_id: string; status: 'SAKIT' | 'IZIN'; reason_id: string | null; reason_name: string | null; kepentingan_sekolah: boolean; note: string }
export type PbItem = { key: string; user_id: string; nama_lengkap: string; tanggal: string; slot: PbSlot | null; status: 'TEPAT_WAKTU' | 'TELAT' | 'SAKIT' | 'IZIN' | 'ALFA' | 'BELUM' | 'TAMBAHAN'; report: PbReport | null; leave: PbLeave | null }

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
export function addDays(date: string, days: number) {
  return new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10)
}
export function pbDates(start: string, end: string) {
  if (!validDate(start) || !validDate(end) || end < start || Date.parse(end) - Date.parse(start) > 366 * 86400000) throw new Error('Rentang tanggal tidak valid (maksimal 366 hari).')
  const dates: string[] = []
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date)
  return dates
}
export function minutes(time: string) { return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) }
export function validateSlots(slots: PbSlot[]) {
  if (!Array.isArray(slots) || slots.length > 70) throw new Error('Maksimal 70 slot per minggu.')
  const ids = new Set<string>()
  for (const slot of slots) {
    if (!slot.id || ids.has(slot.id) || !Number.isInteger(slot.weekday) || slot.weekday < 1 || slot.weekday > 7 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.end) || slot.end <= slot.start) throw new Error('Hari/jam slot tidak valid. Slot harus selesai pada hari yang sama.')
    ids.add(slot.id)
    if (slots.some(other => other.id !== slot.id && other.weekday === slot.weekday && other.start < slot.end && slot.start < other.end)) throw new Error('Slot pada hari yang sama tidak boleh tumpang tindih.')
  }
}
export function pbSlotsForDate(versions: PbVersion[], holidays: PbHoliday[], date: string) {
  if (holidays.some(h => h.start_date <= date && h.end_date >= date)) return []
  const version = versions.filter(v => v.effective_date <= date).sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0]
  const weekday = new Date(date + 'T00:00:00Z').getUTCDay() || 7
  return (version?.slots || []).filter(s => s.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start))
}
export function pbInputStatus(slot: PbSlot | null, time: string, restricted: boolean, late: boolean, threshold: number): PbReport['status'] {
  if (!slot) return 'TAMBAHAN'
  const now = minutes(time)
  if (restricted && (now < minutes(slot.start) - 5 || now > minutes(slot.end))) throw new Error(`Laporan hanya dapat dikirim mulai lima menit sebelum ${slot.start} sampai ${slot.end} WIB.`)
  return late && now > minutes(slot.start) + threshold ? 'TELAT' : 'TEPAT_WAKTU'
}
export function buildPbItems(input: { start: string; end: string; today: string; time: string; versions: PbVersion[]; holidays: PbHoliday[]; members: PbMember[]; reports: PbReport[]; leaves: PbLeave[] }): PbItem[] {
  const { start, end, today, time, versions, holidays, members, reports, leaves } = input
  const reportMap = new Map(reports.filter(r => r.slot_id).map(r => [`${r.user_id}:${r.tanggal}:${r.slot_id}`, r]))
  const leaveMap = new Map(leaves.map(l => [`${l.user_id}:${l.tanggal}:${l.slot_id}`, l]))
  const items = new Map<string, PbItem>()
  for (const date of pbDates(start, end)) {
    for (const member of members.filter(m => m.start_date <= date && (!m.end_date || m.end_date > date))) {
      for (const slot of pbSlotsForDate(versions, holidays, date)) {
        const key = `${member.user_id}:${date}:${slot.id}`
        const report = reportMap.get(key) || null
        const leave = leaveMap.get(key) || null
        const ended = date < today || (date === today && time > slot.end)
        items.set(key, { key, user_id: member.user_id, nama_lengkap: member.nama_lengkap, tanggal: date, slot, report, leave, status: leave?.status || report?.status || (ended ? 'ALFA' : 'BELUM') })
      }
    }
  }
  // Evidence remains visible even when an administrator later marks a date as a holiday.
  for (const report of reports) {
    const key = report.slot_id ? `${report.user_id}:${report.tanggal}:${report.slot_id}` : `report:${report.id}`
    if (items.has(key)) continue
    const slot = report.slot_id ? versions.flatMap(v => v.slots).find(s => s.id === report.slot_id) || null : null
    items.set(key, { key, user_id: report.user_id, nama_lengkap: members.find(m => m.user_id === report.user_id)?.nama_lengkap || report.user_id, tanggal: report.tanggal, slot, report, leave: null, status: 'TAMBAHAN' })
  }
  return [...items.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nama_lengkap.localeCompare(b.nama_lengkap, 'id') || (a.slot?.start || a.report?.waktu_input || '').localeCompare(b.slot?.start || b.report?.waktu_input || ''))
}
export function summarizePb(items: PbItem[]) {
  const result = { total: 0, hadir: 0, telat: 0, sakit: 0, izin: 0, izinSekolah: 0, alfa: 0, tambahan: 0, belum: 0 }
  for (const item of items) {
    if (item.status === 'TAMBAHAN') { result.tambahan++; continue }
    if (item.status === 'BELUM') { result.belum++; continue }
    result.total++
    if (item.status === 'TEPAT_WAKTU' || item.status === 'TELAT') result.hadir++
    if (item.status === 'TELAT') result.telat++
    if (item.status === 'SAKIT') result.sakit++
    if (item.status === 'IZIN') { result.izin++; if (item.leave?.kepentingan_sekolah) result.izinSekolah++ }
    if (item.status === 'ALFA') result.alfa++
  }
  return { ...result, performance: result.total ? teacherPerformance(result) : null }
}
export function validatePbTemplates(monthly: string, daily: string) {
  if (!monthly.trim() || !daily.includes('{pekerjaan}') || !daily.includes('{tempat}') || monthly.length > 2000 || daily.length > 2000) throw new Error('Template bulanan wajib diisi dan catatan harian wajib memuat {pekerjaan} serta {tempat} (maksimal 2000 karakter).')
  if (/\{(?!pekerjaan\}|tempat\})[^}]*\}/.test(monthly + daily)) throw new Error('Placeholder yang tersedia hanya {pekerjaan} dan {tempat}.')
}
export function pbCkhRow(report: PbReport, monthly = PB_MONTHLY, daily = PB_DAILY) {
  const jobs = new Intl.ListFormat('id', { style: 'long', type: 'conjunction' }).format(report.jobs)
  const render = (template: string) => template.replace(/\{pekerjaan\}|\{tempat\}/g, token => token === '{pekerjaan}' ? jobs : report.tempat)
  return { tanggal: report.tanggal, kegiatan_bulanan: render(monthly), catatan_harian: render(daily), vol: 1, satuan: 'Kegiatan', source: 'autofill' as const, source_key: `pramubakti:${report.id}` }
}
