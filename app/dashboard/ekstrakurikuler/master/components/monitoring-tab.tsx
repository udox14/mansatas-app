'use client'

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Activity } from 'lucide-react'
import { formatDateWIB } from '@/lib/time'
import type { MonitoringRow } from '../actions'

export function MonitoringTab({ rows }: { rows: MonitoringRow[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">Rekap kegiatan ekstrakurikuler aktif (tahun ajaran berjalan).</p>
      <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Ekstrakurikuler</TableHead>
              <TableHead className="text-xs text-center">Anggota</TableHead>
              <TableHead className="text-xs text-center">Pertemuan</TableHead>
              <TableHead className="text-xs">Pertemuan Terakhir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-sm text-slate-400">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  Belum ada data.
                </TableCell>
              </TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-sm font-medium text-slate-800 dark:text-slate-200">{r.nama}</TableCell>
                <TableCell className="text-center text-sm text-slate-700 dark:text-slate-300">{r.jml_anggota}</TableCell>
                <TableCell className="text-center text-sm text-slate-700 dark:text-slate-300">{r.jml_pertemuan}</TableCell>
                <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                  {r.pertemuan_terakhir ? formatDateWIB(r.pertemuan_terakhir) : <span className="text-slate-400 italic">Belum ada</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
