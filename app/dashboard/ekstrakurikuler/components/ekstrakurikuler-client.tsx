'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Trophy, Users, CalendarPlus, GraduationCap, ChevronRight, ArrowLeft, Printer } from 'lucide-react'
import { AnggotaManager } from './anggota-manager'
import { PertemuanWizard } from './pertemuan-wizard'
import { NilaiGrid } from './nilai-grid'
import { LaporanDialog } from '../master/components/laporan-dialog'
import type { EkskulSaya, KelasOption } from '../actions'

type Section = 'home' | 'anggota' | 'pertemuan' | 'nilai'

const MENU: Array<{
  key: Exclude<Section, 'home'>
  title: string
  desc: string
  icon: typeof Users
  accent: string
}> = [
  { key: 'anggota', title: 'Anggota', desc: 'Kelola siswa peserta', icon: Users, accent: 'bg-sky-500' },
  { key: 'pertemuan', title: 'Pertemuan & Absensi', desc: 'Presensi pembina + absensi latihan', icon: CalendarPlus, accent: 'bg-emerald-500' },
  { key: 'nilai', title: 'Penilaian', desc: 'Nilai & catatan peserta', icon: GraduationCap, accent: 'bg-violet-500' },
]

export function EkstrakurikulerClient({ initialEkskul, kelasList }: {
  initialEkskul: EkskulSaya[]
  kelasList: KelasOption[]
}) {
  const [selectedId, setSelectedId] = useState<string>(initialEkskul[0]?.id ?? '')
  const [section, setSection] = useState<Section>('home')
  const [cetakOpen, setCetakOpen] = useState(false)
  const selected = initialEkskul.find(e => e.id === selectedId) || null

  if (initialEkskul.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-10 text-center">
        <Trophy className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Anda belum ditunjuk sebagai pembina ekstrakurikuler manapun.
        </p>
        <p className="text-xs text-slate-400 mt-1">Hubungi admin untuk penugasan pembina.</p>
      </div>
    )
  }

  const onPickEkskul = (id: string) => { setSelectedId(id); setSection('home') }

  return (
    <div className="space-y-4">
      {/* Selector ekskul */}
      <div className="rounded-2xl border bg-white dark:bg-slate-900 px-4 py-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
          <Trophy className="h-5 w-5 text-amber-500" />
        </div>
        <div className="min-w-0 flex-1">
          <label className="text-[11px] text-slate-500 dark:text-slate-400">Ekstrakurikuler</label>
          <Select value={selectedId} onValueChange={onPickEkskul}>
            <SelectTrigger className="h-9 text-sm mt-0.5 border-0 px-0 font-semibold shadow-none focus:ring-0">
              <SelectValue placeholder="Pilih..." />
            </SelectTrigger>
            <SelectContent>
              {initialEkskul.map(e => (
                <SelectItem key={e.id} value={e.id} className="text-sm">
                  {e.nama} <span className="text-slate-400">· {e.jml_anggota} anggota</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected && section === 'home' && (
        <div className="grid gap-3 sm:grid-cols-3">
          {MENU.map(m => {
            const Icon = m.icon
            return (
              <button
                key={m.key}
                onClick={() => setSection(m.key)}
                className="group flex items-center gap-4 rounded-2xl border bg-white dark:bg-slate-900 p-5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] sm:flex-col sm:items-start sm:gap-3"
              >
                <div className={`h-12 w-12 rounded-2xl ${m.accent} flex items-center justify-center shrink-0`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{m.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{m.desc}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500 sm:hidden" />
              </button>
            )
          })}

          {/* Cetak shortcut */}
          <button
            onClick={() => setCetakOpen(true)}
            className="group flex items-center gap-4 rounded-2xl border border-dashed bg-slate-50 dark:bg-slate-800/40 p-5 text-left transition-all hover:shadow-md active:scale-[0.98] sm:flex-col sm:items-start sm:gap-3 sm:col-span-3"
          >
            <div className="h-12 w-12 rounded-2xl bg-slate-400 flex items-center justify-center shrink-0">
              <Printer className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-slate-800 dark:text-slate-100">Cetak Laporan Kehadiran</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Rekap absensi peserta per bulan (PDF)</p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500 sm:hidden" />
          </button>
        </div>
      )}

      {selected && section !== 'home' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSection('home')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Menu
            </Button>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {MENU.find(m => m.key === section)?.title}
            </span>
          </div>

          {section === 'anggota' && <AnggotaManager ekskulId={selected.id} kelasList={kelasList} />}
          {section === 'pertemuan' && <PertemuanWizard ekskulId={selected.id} />}
          {section === 'nilai' && <NilaiGrid ekskulId={selected.id} modeNilai={selected.mode_nilai} />}
        </div>
      )}

      {selected && cetakOpen && (
        <LaporanDialog ekskulId={selected.id} ekskulNama={selected.nama} onClose={() => setCetakOpen(false)} />
      )}
    </div>
  )
}
