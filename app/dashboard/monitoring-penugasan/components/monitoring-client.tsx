'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Users, CheckCircle2, Clock, CalendarDays,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Search, ChevronsUpDown, AlertTriangle, BookOpen, UserCheck, ClipboardCheck
} from 'lucide-react'
import type { MonitoringDelegasi, MonitoringPetugasPiket } from '../actions'
import { todayWIB } from '@/lib/time'

const ALASAN_STYLE: Record<'SAKIT' | 'IZIN', { label: string; badge: string; border: string; text: string }> = {
  SAKIT: {
    label: 'Sakit',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-800',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
  },
  IZIN: {
    label: 'Izin',
    badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-400 dark:border-sky-800',
    border: 'border-sky-200 dark:border-sky-800',
    text: 'text-sky-700 dark:text-sky-400',
  },
}

function AlasanBadge({ alasan }: { alasan: 'SAKIT' | 'IZIN' }) {
  const style = ALASAN_STYLE[alasan] || ALASAN_STYLE.IZIN
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full border font-semibold tracking-wide ${style.badge}`}>
      <AlertTriangle className="h-3 w-3" />
      {style.label}
    </span>
  )
}

function getAvatarInitials(name: string) {
  if (!name) return 'G'
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function MonitoringClient({
  initialData, initialTanggal, petugasPiket
}: {
  initialData: MonitoringDelegasi[]
  initialTanggal: string
  petugasPiket: MonitoringPetugasPiket[]
}) {
  const router = useRouter()
  const [tanggal, setTanggal] = useState(initialTanggal)
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(initialData.map(d => d.delegasi_id)))

  function handleFilterDate(newDate: string) {
    setTanggal(newDate)
    router.push(`/dashboard/monitoring-penugasan?tanggal=${newDate}`)
  }

  function navigateDate(offset: number) {
    const d = new Date(tanggal + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    const newTgl = d.toISOString().split('T')[0]
    handleFilterDate(newTgl)
  }

  const filteredData = initialData.filter(d =>
    d.dari_nama.toLowerCase().includes(search.toLowerCase()) ||
    d.kepada_nama.toLowerCase().includes(search.toLowerCase())
  )

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isAllExpanded = filteredData.length > 0 && filteredData.every(d => expandedIds.has(d.delegasi_id))

  const toggleAll = () => {
    if (isAllExpanded) {
      setExpandedIds(new Set())
    } else {
      setExpandedIds(new Set(filteredData.map(d => d.delegasi_id)))
    }
  }

  // Statistics calculation
  const totalDelegasi = filteredData.length
  const totalKelas = filteredData.reduce((acc, dt) => acc + dt.items.length, 0)
  const totalKelasSelesai = filteredData.reduce((acc, dt) => acc + dt.items.filter(i => i.absen_selesai).length, 0)
  const totalSelesaiDelegasi = filteredData.filter(dt => dt.status === 'SELESAI' || (dt.items.length > 0 && dt.items.every(i => i.absen_selesai))).length
  const totalSakit = filteredData.filter(dt => dt.alasan_ketidakhadiran === 'SAKIT').length
  const totalIzin = filteredData.filter(dt => dt.alasan_ketidakhadiran === 'IZIN').length

  const progressPercentage = totalKelas > 0 ? Math.round((totalKelasSelesai / totalKelas) * 100) : 0

  return (
    <div className="space-y-4">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Guru Izin/Sakit</span>
            <Users className="h-4 w-4 text-violet-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{totalDelegasi} <span className="text-xs font-normal text-slate-400">Guru</span></p>
          <p className="text-[11px] text-slate-400 truncate">{totalSakit} Sakit • {totalIzin} Izin</p>
        </div>

        <div className="rounded-xl border bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Penugasan Kelas</span>
            <BookOpen className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{totalKelas} <span className="text-xs font-normal text-slate-400">Kelas</span></p>
          <p className="text-[11px] text-slate-400 truncate">Pendelegasian jam mengajar</p>
        </div>

        <div className="rounded-xl border bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Kelas Selesai</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{totalKelasSelesai} / {totalKelas}</p>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
          </div>
        </div>

        <div className="rounded-xl border bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Status Delegasi</span>
            <UserCheck className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{totalSelesaiDelegasi} <span className="text-xs font-normal text-slate-400">/ {totalDelegasi} Tuntas</span></p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium truncate">{totalDelegasi - totalSelesaiDelegasi} Belum Selesai</p>
        </div>

        <div className="col-span-2 lg:col-span-1 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/60 dark:bg-teal-950/30 p-3.5 shadow-sm space-y-1 min-w-0">
          <div className="flex items-center justify-between text-xs text-teal-700 dark:text-teal-300">
            <span>Petugas Piket</span>
            <ClipboardCheck className="h-4 w-4 text-teal-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {petugasPiket.length} <span className="text-xs font-normal text-slate-400">Petugas</span>
          </p>
          <p
            className="text-[11px] leading-4 text-teal-700 dark:text-teal-400 line-clamp-2"
            title={petugasPiket.map(p => `${p.nama} (${p.shift_nama})`).join(', ')}
          >
            {petugasPiket.length > 0
              ? petugasPiket.map(p => p.nama).join(', ')
              : 'Belum ada jadwal piket'}
          </p>
        </div>
      </div>

      {/* Control Bar & Filters */}
      <div className="rounded-xl border bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Date Navigator */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateDate(-1)}
                className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={tanggal}
                onChange={e => handleFilterDate(e.target.value)}
                className="h-8 w-[140px] text-xs bg-transparent border-0 focus-visible:ring-0 text-slate-800 dark:text-slate-200 font-medium"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateDate(1)}
                className="h-8 w-8 p-0 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFilterDate(todayWIB())}
              className="h-9 px-3 text-xs border-slate-200 dark:border-slate-700"
            >
              Hari Ini
            </Button>
          </div>

          {/* Search & Accordion Toggle */}
          <div className="flex items-center gap-2 flex-1 sm:max-w-md justify-end">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari guru pengirim / penerima..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 pl-9 text-xs"
              />
            </div>
            {filteredData.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAll}
                className="h-9 text-xs px-2.5 shrink-0 whitespace-nowrap"
              >
                <ChevronsUpDown className="h-3.5 w-3.5 mr-1 text-slate-500" />
                {isAllExpanded ? 'Tutup Semua' : 'Buka Semua'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Accordion Table View */}
      {filteredData.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-12 text-center">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Tidak ada pendelegasian tugas pada tanggal ini.</p>
          <p className="text-xs text-slate-400 mt-1">Gunakan pemilih tanggal di atas untuk memantau hari lain.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredData.map(dt => {
            const isExpanded = expandedIds.has(dt.delegasi_id)
            const itemsCount = dt.items.length
            const completedCount = dt.items.filter(i => i.absen_selesai).length
            const isFullyCompleted = dt.status === 'SELESAI' || (itemsCount > 0 && completedCount === itemsCount)
            const initials = getAvatarInitials(dt.dari_nama)

            return (
              <div
                key={dt.delegasi_id}
                className={`rounded-xl border bg-white dark:bg-slate-900 shadow-sm transition-all overflow-hidden ${
                  isFullyCompleted
                    ? 'border-emerald-200 dark:border-emerald-950 hover:border-emerald-300'
                    : 'border-slate-200 dark:border-slate-800 hover:border-violet-300'
                }`}
              >
                {/* Accordion Row Header */}
                <div
                  onClick={() => toggleExpand(dt.delegasi_id)}
                  className={`p-3.5 sm:p-4 cursor-pointer select-none transition-colors ${
                    isExpanded
                      ? 'bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800'
                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left: Avatar + Guru Pengirim + Alasan */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
                        dt.alasan_ketidakhadiran === 'SAKIT'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300'
                      }`}>
                        {initials}
                      </div>

                      <div className="min-w-0 space-y-0.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {dt.dari_nama}
                          </h3>
                          <AlasanBadge alasan={dt.alasan_ketidakhadiran} />
                        </div>
                        {dt.deskripsi_ketidakhadiran && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                            &quot;{dt.deskripsi_ketidakhadiran}&quot;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Center & Right Info Badge & Controls */}
                    <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      {/* Kepada / Penerima Tugas */}
                      <div className="text-left md:text-right min-w-[140px]">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Penerima Tugas</span>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                          <Users className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                          <span className="truncate max-w-[160px]">{dt.kepada_nama}</span>
                        </div>
                      </div>

                      {/* Progress Badge */}
                      <div className="text-left md:text-right min-w-[110px]">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Progres Kelas</span>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md ${
                          isFullyCompleted
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                        }`}>
                          {completedCount}/{itemsCount} Kelas Selesai
                        </span>
                      </div>

                      {/* Overall Status Badge & Chevron */}
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold tracking-wide uppercase ${
                          isFullyCompleted
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                        }`}>
                          {isFullyCompleted ? 'SELESAI' : dt.status || 'BELUM'}
                        </span>

                        <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Accordion Expanded Body */}
                {isExpanded && (
                  <div className="bg-slate-50/50 dark:bg-slate-950/40 p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in-50 duration-200">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                        Rincian Tugas Per Kelas ({itemsCount})
                      </h4>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                            <th className="py-2.5 px-3 w-36">Kelas & Mapel</th>
                            <th className="py-2.5 px-3">Deskripsi / Rincian Tugas</th>
                            <th className="py-2.5 px-3 w-44">Pelaksana</th>
                            <th className="py-2.5 px-3 w-28 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {dt.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                              <td className="py-3 px-3 align-top">
                                <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] mb-1">
                                  {item.kelas_label}
                                </span>
                                <p className="text-slate-600 dark:text-slate-400 font-medium">{item.mapel_nama}</p>
                              </td>
                              <td className="py-3 px-3 align-top">
                                <div className="p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 leading-relaxed font-sans">
                                  <span className="font-semibold text-amber-800 dark:text-amber-300 mr-1">Tugas:</span>
                                  {item.tugas}
                                </div>
                              </td>
                              <td className="py-3 px-3 align-top text-slate-700 dark:text-slate-300">
                                {item.pelaksana_nama ? (
                                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                                    <UserCheck className="h-3.5 w-3.5 shrink-0" />
                                    <span>{item.pelaksana_nama}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">Guru Piket Hari Ini</span>
                                )}
                              </td>
                              <td className="py-3 px-3 align-top text-center">
                                {item.absen_selesai ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Selesai
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium">
                                    <Clock className="h-3 w-3" />
                                    Belum
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card List View */}
                    <div className="block md:hidden space-y-2.5">
                      {dt.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                                {item.kelas_label}
                              </span>
                              <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{item.mapel_nama}</span>
                            </div>
                            {item.absen_selesai ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 font-semibold">
                                <CheckCircle2 className="h-3 w-3" />
                                Selesai
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 font-medium">
                                <Clock className="h-3 w-3" />
                                Belum
                              </span>
                            )}
                          </div>

                          <div className="p-2.5 rounded-md bg-amber-50/80 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                            <span className="font-semibold text-amber-800 dark:text-amber-300 mr-1">Tugas:</span>
                            {item.tugas}
                          </div>

                          {item.pelaksana_nama && (
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium pt-0.5">
                              <UserCheck className="h-3.5 w-3.5 shrink-0" />
                              <span>Dilaksanakan oleh: {item.pelaksana_nama}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
