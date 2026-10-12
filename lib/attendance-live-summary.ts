import type { SlotJam } from '@/app/dashboard/settings/types'

type LiveRow = { cells: Array<{ jam_ke: number; status: string; teacher_submitted?: boolean }> }

/** One shared reference hour per class; never mix older student records into that hour. */
export function liveAttendanceSummary(tanggal: string, slots: SlotJam[], rows: LiveRow[], now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const eligible = slots.filter(slot => /^([01]\d|2[0-3]):[0-5]\d$/.test(slot.mulai) &&
    (tanggal < today || (tanggal === today && now.getTime() >= Date.parse(`${tanggal}T${slot.mulai}:00+07:00`))))
  const reference = eligible.sort((a, b) => b.id - a.id).find(slot =>
    rows.some(row => row.cells.some(cell => cell.jam_ke === slot.id && cell.teacher_submitted)))
  const summary = { hadir: 0, sakit: 0, izin: 0, alfa: 0, bolos: 0, perlu_konfirmasi_wali: 0, belum_ada_input: 0, belum_ada_data: 0 }
  for (const row of rows) {
    const status = reference ? row.cells.find(cell => cell.jam_ke === reference.id)?.status : undefined
    if (status === 'HADIR') summary.hadir++
    else if (status === 'SAKIT') summary.sakit++
    else if (status === 'IZIN') summary.izin++
    else if (status === 'ALFA') summary.alfa++
    else summary.belum_ada_input++
  }
  return { ...summary, jam_acuan: reference?.id ?? null, live: true as const }
}
