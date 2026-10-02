import type { FinalAttendanceDetail } from './wali-kelas-attendance'

type SummaryRow = Pick<FinalAttendanceDetail, 'status_akhir' | 'is_daily_final' | 'block_statuses'>

export function isDailyNonAttendance(row: Pick<SummaryRow, 'status_akhir' | 'is_daily_final'> | null | undefined) {
  return !!row?.is_daily_final && ['SAKIT', 'IZIN', 'ALFA'].includes(row.status_akhir)
}

/** Presentation summary: missing input is separate from daily attendance totals. */
export function summarizeKelasBinaanAttendance(rows: Array<SummaryRow | undefined>) {
  const summary = { hadir: 0, sakit: 0, izin: 0, alfa: 0, sementara: 0, belumAdaInput: 0, pendingBlocks: 0, finalCount: 0 }
  const pendingBlocks = new Set<string>()
  for (const row of rows) {
    if (!row) continue
    for (const block of row.block_statuses) {
      if (!block.submitted) pendingBlocks.add(`${block.penugasan_id}:${block.jam_ke_mulai}:${block.jam_ke_selesai}`)
    }
    if (row.is_daily_final) {
      if (row.status_akhir === 'HADIR') summary.hadir++
      else if (row.status_akhir === 'SAKIT') summary.sakit++
      else if (row.status_akhir === 'IZIN') summary.izin++
      else if (row.status_akhir === 'ALFA') summary.alfa++
      else continue
      summary.finalCount++
    } else if (row.status_akhir === 'BELUM_ADA_INPUT') summary.belumAdaInput++
    else summary.sementara++
  }
  summary.pendingBlocks = pendingBlocks.size
  return summary
}
