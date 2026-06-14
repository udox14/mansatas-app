'use client'

import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Activity, Users, CalendarDays, ImageIcon, Printer } from 'lucide-react'
import { formatDateWIB } from '@/lib/time'
import { LaporanDialog } from './laporan-dialog'
import type { MonitoringRow } from '../actions'

export function MonitoringTab({ rows }: { rows: MonitoringRow[] }) {
  const [foto, setFoto] = useState<{ url: string; nama: string; judul: string | null } | null>(null)
  const [laporan, setLaporan] = useState<{ id: string; nama: string } | null>(null)

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-10 text-center">
        <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada data ekstrakurikuler aktif.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">Rekap kegiatan ekstrakurikuler aktif (tahun ajaran berjalan).</p>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {rows.map(r => (
          <div key={r.id} className="rounded-xl border bg-white dark:bg-slate-900 p-3 flex gap-3">
            {/* Foto pertemuan terakhir */}
            <button
              type="button"
              onClick={() => r.foto_terakhir && setFoto({ url: r.foto_terakhir, nama: r.nama, judul: r.judul_terakhir })}
              disabled={!r.foto_terakhir}
              className="h-16 w-16 shrink-0 rounded-lg overflow-hidden border bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
            >
              {r.foto_terakhir
                ? <img src={r.foto_terakhir} alt="" className="h-full w-full object-cover" />
                : <ImageIcon className="h-5 w-5 text-slate-300" />}
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{r.nama}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.jml_anggota} anggota</span>
                <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{r.jml_pertemuan} pertemuan</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                {r.pertemuan_terakhir ? `Terakhir: ${formatDateWIB(r.pertemuan_terakhir)}` : 'Belum ada pertemuan'}
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs mt-2"
                onClick={() => setLaporan({ id: r.id, nama: r.nama })}>
                <Printer className="h-3 w-3 mr-1" /> Cetak Kehadiran
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox foto */}
      {foto && (
        <Dialog open onOpenChange={open => !open && setFoto(null)}>
          <DialogContent className="sm:max-w-lg rounded-xl p-2">
            <img src={foto.url} alt={foto.nama} className="w-full rounded-lg" />
            <p className="text-xs text-center text-slate-500 dark:text-slate-400 pb-1">
              {foto.nama}{foto.judul ? ` · ${foto.judul}` : ''}
            </p>
          </DialogContent>
        </Dialog>
      )}

      {laporan && (
        <LaporanDialog ekskulId={laporan.id} ekskulNama={laporan.nama} onClose={() => setLaporan(null)} />
      )}
    </div>
  )
}
