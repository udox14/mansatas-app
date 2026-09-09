'use client'

import { FileSpreadsheet } from 'lucide-react'
import { FinanceExportExcelDialog, type ExportSource, type FinanceExportRow } from '../components/export-excel-dialog'

export function KeuanganExportClient({ activeRows, inactiveRows, sources }: {
  activeRows: FinanceExportRow[]
  inactiveRows: FinanceExportRow[]
  sources: ExportSource[]
}) {
  const groups = [
    { title: 'Siswa Aktif', rows: activeRows, prefix: 'MANSATAS_DSPT_SPP_AKTIF' },
    { title: 'Siswa Nonaktif', rows: inactiveRows, prefix: 'MANSATAS_DSPT_SPP_NONAKTIF' },
  ]
  return <div className="grid gap-3 lg:grid-cols-2">
    {groups.map(group => (
      <div key={group.title} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><FileSpreadsheet className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{group.title}</p><p className="mt-1 text-xs text-slate-500">{group.rows.length} item keuangan, dihitung terpisah.</p></div>
          <FinanceExportExcelDialog rows={group.rows} currentRows={group.rows} sources={sources} defaultSources={sources} triggerLabel="Export Excel" filePrefix={group.prefix} />
        </div>
      </div>
    ))}
  </div>
}
