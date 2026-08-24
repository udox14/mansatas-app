'use client'

import { useMemo, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { FinanceExportExcelDialog, type ExportSource, type FinanceExportRow } from '../components/export-excel-dialog'
import { SiswaStatusFilter, matchSiswaStatusFilter, type SiswaStatusFilterValue } from '../components/siswa-status-filter'

export function KeuanganExportClient({
  rows,
  sources,
}: {
  rows: FinanceExportRow[]
  sources: ExportSource[]
}) {
  const [filterSiswaStatus, setFilterSiswaStatus] = useState<SiswaStatusFilterValue>('aktif')

  const filteredRows = useMemo(
    () => rows.filter(row => matchSiswaStatusFilter(row.siswa_status, filterSiswaStatus)),
    [rows, filterSiswaStatus],
  )

  const totalDspt = filteredRows.filter(row => row.source === 'DSPT').length
  const totalSpp = filteredRows.filter(row => row.source === 'SPP').length

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Export fleksibel DSPT dan SPP</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Pilih sumber data, cakupan siswa, kelas, angkatan, dan kolom yang ingin dimasukkan ke file Excel.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">DSPT: {totalDspt} baris</span>
              <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">SPP: {totalSpp} baris</span>
              <SiswaStatusFilter value={filterSiswaStatus} onValueChange={setFilterSiswaStatus} />
            </div>
          </div>
          <FinanceExportExcelDialog
            rows={filteredRows}
            sources={sources}
            defaultSources={sources}
            triggerLabel="Mulai Export"
            filePrefix="MANSATAS_Keuangan_Gabungan"
          />
        </div>
      </div>
    </div>
  )
}
