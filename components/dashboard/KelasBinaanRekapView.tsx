'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Thermometer,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
import { AvatarSiswa } from '@/components/ui/avatar-siswa'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  attendanceStatusLabel,
  attendanceSourceLabel,
  type FinalAttendanceStatus,
  type FinalAttendanceSource,
} from '@/lib/attendance-status'

export type RekapDetailGuru = {
  status: string
  nama_mapel: string
  guru_nama: string | null
  sumber: 'guru' | 'perizinan_siswa'
  jam_ke_mulai: number
  jam_ke_selesai: number
  catatan: string
}

export type RekapStudentDay = {
  tanggal: string
  is_daily_final: boolean
  status_akhir: FinalAttendanceStatus
  sumber_status: FinalAttendanceSource
  status_reason: string
  keterangan_wali_kelas: string | null
  total_blok: number
  submitted_blok: number
  pending_blok: number
  detail_guru: RekapDetailGuru[]
}

export type RekapSiswa = {
  id: string
  nama_lengkap: string
  nisn: string
  foto_url: string | null
}

type Props = {
  kelasId: string
  namaKelas: string
  today: string
  semesterStartDate: string
  siswa: RekapSiswa[]
  dates: string[]
  statusesByStudent: Record<string, RekapStudentDay[]>
}

type RekapMode = 'harian' | 'bulanan' | 'rentang'

function badgeClass(status: string) {
  if (status === 'HADIR') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
  if (status === 'SAKIT') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
  if (status === 'IZIN') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
  if (status === 'ALFA') return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
  if (status === 'PARSIAL' || status === 'BOLOS') return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
  if (status === 'PERLU_KONFIRMASI_WALI') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
}

function formatTanggalLengkap(tanggal: string) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(`${tanggal}T00:00:00+07:00`))
  } catch {
    return tanggal
  }
}

function formatTanggalPendek(tanggal: string) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(`${tanggal}T00:00:00+07:00`))
  } catch {
    return tanggal
  }
}

function formatBulanTahun(yearMonth: string) {
  try {
    const [y, m] = yearMonth.split('-')
    const date = new Date(Number(y), Number(m) - 1, 1)
    return new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(date)
  } catch {
    return yearMonth
  }
}

export function KelasBinaanRekapView({
  kelasId,
  namaKelas,
  today,
  semesterStartDate,
  siswa,
  dates,
  statusesByStudent,
}: Props) {
  const [mode, setMode] = useState<RekapMode>('harian')
  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => today.slice(0, 7))
  const [rangeStart, setRangeStart] = useState<string>(() => {
    // Default 7 hari ke belakang dari today
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - 6)
    const s = d.toISOString().split('T')[0]
    return s < semesterStartDate ? semesterStartDate : s
  })
  const [rangeEnd, setRangeEnd] = useState<string>(today)
  const [searchQuery, setSearchQuery] = useState('')
  const [harianStatusFilter, setHarianStatusFilter] = useState<'all' | 'absen' | 'alfa' | 'hadir'>('all')
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({})

  // Daftar bulan yang tersedia di rentang tanggal
  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    for (const d of dates) {
      set.add(d.slice(0, 7))
    }
    // Pastikan bulan berjalan ada
    set.add(today.slice(0, 7))
    return Array.from(set).sort().reverse()
  }, [dates, today])

  const toggleStudentExpanded = (id: string) => {
    setExpandedStudents(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // ===================== DATA REKAP HARIAN =====================
  const harianRows = useMemo(() => {
    return siswa.map(s => {
      const studentStatuses = statusesByStudent[s.id] || []
      const dayStatus = studentStatuses.find(item => item.tanggal === selectedDate) || null
      return {
        ...s,
        dayStatus,
        statusAkhir: dayStatus?.status_akhir || 'BELUM_ADA_DATA',
        detailGuru: dayStatus?.detail_guru || [],
      }
    })
  }, [siswa, statusesByStudent, selectedDate])

  const harianSummary = useMemo(() => {
    let hadir = 0
    let sakit = 0
    let izin = 0
    let alfa = 0
    let belumInput = 0

    for (const r of harianRows) {
      const st = r.statusAkhir
      if (st === 'HADIR') hadir++
      else if (st === 'SAKIT') sakit++
      else if (st === 'IZIN') izin++
      else if (st === 'ALFA') alfa++
      else belumInput++
    }
    return { hadir, sakit, izin, alfa, belumInput, total: harianRows.length }
  }, [harianRows])

  const filteredHarianRows = useMemo(() => {
    return harianRows.filter(r => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!r.nama_lengkap.toLowerCase().includes(q) && !r.nisn.includes(q)) return false
      }
      if (harianStatusFilter === 'absen') {
        return ['SAKIT', 'IZIN', 'ALFA', 'PARSIAL'].includes(r.statusAkhir)
      }
      if (harianStatusFilter === 'alfa') {
        return r.statusAkhir === 'ALFA'
      }
      if (harianStatusFilter === 'hadir') {
        return r.statusAkhir === 'HADIR'
      }
      return true
    })
  }, [harianRows, searchQuery, harianStatusFilter])

  // ===================== DATA REKAP BULANAN & RENTANG =====================
  const periodDates = useMemo(() => {
    if (mode === 'bulanan') {
      return dates.filter(d => d.startsWith(selectedMonth))
    }
    return dates.filter(d => d >= rangeStart && d <= rangeEnd)
  }, [dates, mode, selectedMonth, rangeStart, rangeEnd])

  const periodStudentRecap = useMemo(() => {
    return siswa.map(s => {
      const studentStatuses = statusesByStudent[s.id] || []
      const filteredDays = studentStatuses.filter(d => periodDates.includes(d.tanggal))
      
      let hadir = 0
      let sakit = 0
      let izin = 0
      let alfa = 0
      const absentDays: RekapStudentDay[] = []

      for (const day of filteredDays) {
        if (!day.is_daily_final) continue
        const st = day.status_akhir
        if (st === 'HADIR') hadir++
        else if (st === 'SAKIT') {
          sakit++
          absentDays.push(day)
        } else if (st === 'IZIN') {
          izin++
          absentDays.push(day)
        } else if (st === 'ALFA') {
          alfa++
          absentDays.push(day)
        }
      }

      const totalEfektif = periodDates.length
      const totalHadirCount = hadir
      const persentaseHadir = totalEfektif > 0 ? Math.round((totalHadirCount / totalEfektif) * 100) : 0

      return {
        ...s,
        totalEfektif,
        hadir,
        sakit,
        izin,
        alfa,
        totalTidakHadir: sakit + izin + alfa,
        persentaseHadir,
        absentDays,
      }
    }).sort((a, b) => (
      b.totalTidakHadir - a.totalTidakHadir ||
      b.alfa - a.alfa ||
      a.nama_lengkap.localeCompare(b.nama_lengkap)
    ))
  }, [siswa, statusesByStudent, periodDates])

  const periodSummary = useMemo(() => {
    let totalHadir = 0
    let totalSakit = 0
    let totalIzin = 0
    let totalAlfa = 0

    for (const s of periodStudentRecap) {
      totalHadir += s.hadir
      totalSakit += s.sakit
      totalIzin += s.izin
      totalAlfa += s.alfa
    }

    const totalExpected = periodStudentRecap.length * periodDates.length
    const avgPersen = totalExpected > 0 ? Math.round((totalHadir / totalExpected) * 100) : 0

    return {
      totalHadir,
      totalSakit,
      totalIzin,
      totalAlfa,
      totalHari: periodDates.length,
      avgPersen,
    }
  }, [periodStudentRecap, periodDates])

  const filteredPeriodRows = useMemo(() => {
    if (!searchQuery.trim()) return periodStudentRecap
    const q = searchQuery.toLowerCase()
    return periodStudentRecap.filter(s => s.nama_lengkap.toLowerCase().includes(q) || s.nisn.includes(q))
  }, [periodStudentRecap, searchQuery])

  return (
    <div className="space-y-4">
      {/* Tab Switcher Mode Rekap */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-surface bg-surface p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-2 dark:bg-blue-950/40 dark:border-blue-800">
            <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Rekap Absensi Siswa</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Kelas {namaKelas} · Terintegrasi langsung & mobile-first
            </p>
          </div>
        </div>

        {/* Segmented Control Mode */}
        <div className="flex rounded-lg border border-slate-200 bg-slate-100/70 p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setMode('harian')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              mode === 'harian'
                ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-800 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Harian (Per Blok)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('bulanan')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              mode === 'bulanan'
                ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-800 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Bulanan</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('rentang')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              mode === 'rentang'
                ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-800 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Rentang Tanggal</span>
          </button>
        </div>
      </div>

      {/* ============================== MODE HARIAN ============================== */}
      {mode === 'harian' && (
        <div className="space-y-3">
          {/* Header Kontrol Tanggal & Filter */}
          <div className="rounded-xl border border-surface bg-surface p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="rekap-harian-date" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Pilih Tanggal:</label>
                <input
                  id="rekap-harian-date"
                  type="date"
                  value={selectedDate}
                  min={semesterStartDate}
                  max={today}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(today)}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    selectedDate === today
                      ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  Hari Ini
                </button>
              </div>

              {/* Search box */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari siswa atau NISN..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
            </div>

            {/* Summary Stat Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-surface-2 text-xs">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500">Hadir</p>
                  <p className="text-sm font-bold text-emerald-700">{harianSummary.hadir} siswa</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/60 p-2 dark:border-amber-900/40 dark:bg-amber-950/20">
                <Thermometer className="h-4 w-4 text-amber-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500">Sakit</p>
                  <p className="text-sm font-bold text-amber-700">{harianSummary.sakit} siswa</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-2 dark:border-blue-900/40 dark:bg-blue-950/20">
                <ShieldAlert className="h-4 w-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500">Izin</p>
                  <p className="text-sm font-bold text-blue-700">{harianSummary.izin} siswa</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50/60 p-2 dark:border-rose-900/40 dark:bg-rose-950/20">
                <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500">Alfa</p>
                  <p className="text-sm font-bold text-rose-700">{harianSummary.alfa} siswa</p>
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/60">
                <Clock className="h-4 w-4 text-slate-500 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500">Belum Lengkap</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{harianSummary.belumInput} siswa</p>
                </div>
              </div>
            </div>

            {/* Quick Status Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 font-medium">Filter:</span>
              {[
                { key: 'all', label: `Semua (${harianRows.length})` },
                { key: 'absen', label: `Tidak Hadir (${harianSummary.sakit + harianSummary.izin + harianSummary.alfa})` },
                { key: 'alfa', label: `Fokus Alfa (${harianSummary.alfa})` },
                { key: 'hadir', label: `Hadir (${harianSummary.hadir})` },
              ].map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setHarianStatusFilter(f.key as any)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    harianStatusFilter === f.key
                      ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* List Kartu Siswa Harian (Mobile First) */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
              Menampilkan {filteredHarianRows.length} siswa untuk {formatTanggalLengkap(selectedDate)}:
            </p>

            {filteredHarianRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 dark:border-slate-800">
                Tidak ada data siswa yang cocok dengan filter.
              </div>
            ) : (
              filteredHarianRows.map((siswaRow, idx) => {
                const day = siswaRow.dayStatus
                const hasNonHadirBlock = siswaRow.detailGuru.some(d => ['ALFA', 'SAKIT', 'IZIN', 'PARSIAL'].includes(d.status))
                const isNonHadirDaily = ['SAKIT', 'IZIN', 'ALFA'].includes(siswaRow.statusAkhir)

                return (
                  <Card
                    key={siswaRow.id}
                    className={`overflow-hidden border transition-all ${
                      isNonHadirDaily
                        ? 'border-rose-200 bg-rose-50/20 dark:border-rose-900/40 dark:bg-rose-950/10'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
                    }`}
                  >
                    <div className="p-3.5 sm:p-4">
                      {/* Baris Siswa Utama */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <AvatarSiswa fotoUrl={siswaRow.foto_url} nama={siswaRow.nama_lengkap} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                {siswaRow.nama_lengkap}
                              </p>
                              <Badge variant="outline" className={`px-2 py-0.5 text-[10px] font-bold ${badgeClass(siswaRow.statusAkhir)}`}>
                                {attendanceStatusLabel(siswaRow.statusAkhir)}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              NISN: {siswaRow.nisn} · {day ? `${day.submitted_blok}/${day.total_blok} blok terisi` : 'Belum ada data'}
                            </p>
                            {day?.keterangan_wali_kelas && (
                              <p className="mt-1 text-[11px] font-medium text-purple-700 dark:text-purple-300">
                                Catatan Wali Kelas: {day.keterangan_wali_kelas}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Rincian Blok Pembelajaran / Mapel (Inti Kebutuhan Pengguna) */}
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                            Rincian Kehadiran Per Mata Pelajaran / Blok
                          </p>
                          {hasNonHadirBlock && (
                            <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              Ada Ketidakhadiran di Jam Pelajaran
                            </span>
                          )}
                        </div>

                        {siswaRow.detailGuru.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">
                            {day?.is_daily_final
                              ? 'Siswa tercatat hadir penuh di seluruh blok pembelajaran.'
                              : 'Belum ada catatan detail per mapel yang masuk dari guru pengajar.'}
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {siswaRow.detailGuru.map((block, bIdx) => {
                              const isBlockAbsen = ['ALFA', 'SAKIT', 'IZIN', 'PARSIAL'].includes(block.status)
                              return (
                                <div
                                  key={`${siswaRow.id}-block-${bIdx}`}
                                  className={`rounded-lg border p-2.5 text-xs transition-colors ${
                                    isBlockAbsen
                                      ? 'border-rose-200 bg-rose-50/80 dark:border-rose-900/60 dark:bg-rose-950/30'
                                      : 'border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-1.5">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                          {block.nama_mapel}
                                        </span>
                                        <span className="text-[10px] font-medium text-slate-500">
                                          (Jam {block.jam_ke_mulai === block.jam_ke_selesai ? block.jam_ke_mulai : `${block.jam_ke_mulai}-${block.jam_ke_selesai}`})
                                        </span>
                                      </div>
                                      {block.guru_nama && (
                                        <p className="mt-0.5 text-[10px] text-slate-500 truncate">
                                          Guru: <span className="font-medium text-slate-700 dark:text-slate-300">{block.guru_nama}</span>
                                        </p>
                                      )}
                                      {block.catatan && (
                                        <p className="mt-1 text-[11px] font-medium text-rose-700 dark:text-rose-300">
                                          Catatan: &ldquo;{block.catatan}&rdquo;
                                        </p>
                                      )}
                                    </div>
                                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeClass(block.status)}`}>
                                      {attendanceStatusLabel(block.status)}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ============================== MODE BULANAN & RENTANG ============================== */}
      {(mode === 'bulanan' || mode === 'rentang') && (
        <div className="space-y-3">
          {/* Header Kontrol Filter Bulan/Rentang */}
          <div className="rounded-xl border border-surface bg-surface p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {mode === 'bulanan' ? (
                <div className="flex items-center gap-2">
                  <label htmlFor="rekap-select-month" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Pilih Bulan:</label>
                  <select
                    id="rekap-select-month"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {availableMonths.map(ym => (
                      <option key={ym} value={ym}>
                        {formatBulanTahun(ym)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="rekap-range-start" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Rentang:</label>
                  <input
                    id="rekap-range-start"
                    type="date"
                    value={rangeStart}
                    min={semesterStartDate}
                    max={rangeEnd}
                    onChange={e => setRangeStart(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                  <span className="text-xs text-slate-400">s/d</span>
                  <input
                    id="rekap-range-end"
                    type="date"
                    value={rangeEnd}
                    min={rangeStart}
                    max={today}
                    onChange={e => setRangeEnd(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
              )}

              {/* Search box */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama siswa..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
            </div>

            {/* Statistik Periode */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-surface-2 text-xs">
              <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-2.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                <div className="rounded-md bg-blue-500 p-1 text-white">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Rerata Hadir</p>
                  <p className="text-base font-bold text-blue-700 dark:text-blue-300">{periodSummary.avgPersen}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500">Total Hadir</p>
                  <p className="text-sm font-bold text-emerald-700">{periodSummary.totalHadir} catatan</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/60 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                <Thermometer className="h-4 w-4 text-amber-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500">Total Sakit</p>
                  <p className="text-sm font-bold text-amber-700">{periodSummary.totalSakit} catatan</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-2.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                <ShieldAlert className="h-4 w-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500">Total Izin</p>
                  <p className="text-sm font-bold text-blue-700">{periodSummary.totalIzin} catatan</p>
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50/60 p-2.5 dark:border-rose-900/40 dark:bg-rose-950/20">
                <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500">Total Alfa</p>
                  <p className="text-sm font-bold text-rose-700">{periodSummary.totalAlfa} catatan</p>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Total hari efektif KBM pada periode ini: <span className="font-semibold text-slate-700 dark:text-slate-300">{periodDates.length} hari</span>.
            </p>
          </div>

          {/* List Siswa Rekap Bulanan / Rentang */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
              Urutan siswa berdasarkan jumlah ketidakhadiran ({filteredPeriodRows.length} siswa):
            </p>

            {filteredPeriodRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 dark:border-slate-800">
                Tidak ada data pada periode ini.
              </div>
            ) : (
              filteredPeriodRows.map((sRow) => {
                const isExpanded = expandedStudents[sRow.id]
                const hasAbsences = sRow.absentDays.length > 0

                return (
                  <Card key={sRow.id} className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="p-3.5 sm:p-4">
                      {/* Header Kartu Siswa */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <AvatarSiswa fotoUrl={sRow.foto_url} nama={sRow.nama_lengkap} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                              {sRow.nama_lengkap}
                            </p>
                            <p className="text-[11px] text-slate-400">NISN: {sRow.nisn}</p>
                          </div>
                        </div>

                        {/* Nilai Kehadiran & Counters */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Badge variant="outline" className={`font-semibold ${
                              sRow.persentaseHadir >= 90
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : sRow.persentaseHadir >= 80
                                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                                  : 'border-rose-200 bg-rose-50 text-rose-700'
                            }`}>
                              {sRow.persentaseHadir}% Hadir
                            </Badge>
                            <Badge variant="secondary" className="gap-1 font-normal text-[11px]">
                              Sakit: <span className="font-bold">{sRow.sakit}</span>
                            </Badge>
                            <Badge variant="secondary" className="gap-1 font-normal text-[11px]">
                              Izin: <span className="font-bold">{sRow.izin}</span>
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`gap-1 text-[11px] ${sRow.alfa > 0 ? 'border-rose-200 bg-rose-50 text-rose-700 font-bold' : 'font-normal'}`}
                            >
                              Alfa: <span>{sRow.alfa}</span>
                            </Badge>
                          </div>

                          {/* Tombol Expand Detail Ketidakhadiran */}
                          {hasAbsences && (
                            <button
                              type="button"
                              onClick={() => toggleStudentExpanded(sRow.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors"
                            >
                              <span>{isExpanded ? 'Tutup Rincian' : `Rincian (${sRow.absentDays.length} Hari)`}</span>
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Accordion Rincian Ketidakhadiran per Mapel & Blok */}
                      {isExpanded && (
                        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Histori Hari Tidak Masuk & Rincian Mapel / Blok:
                          </p>

                          <div className="space-y-2">
                            {sRow.absentDays.map((aDay, aIdx) => (
                              <div
                                key={`${sRow.id}-absent-${aIdx}`}
                                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/50"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      {formatTanggalLengkap(aDay.tanggal)}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className={`px-2 py-0.5 text-[10px] font-bold ${badgeClass(aDay.status_akhir)}`}>
                                    Status Harian: {attendanceStatusLabel(aDay.status_akhir)}
                                  </Badge>
                                </div>

                                {/* Detail Guru / Mapel */}
                                <div className="mt-2 space-y-1.5">
                                  {aDay.detail_guru.length === 0 ? (
                                    <p className="text-[11px] text-slate-500 italic">
                                      {aDay.keterangan_wali_kelas
                                        ? `Catatan wali kelas: ${aDay.keterangan_wali_kelas}`
                                        : 'Ketidakhadiran seharian penuh berdasarkan perizinan/status harian.'}
                                    </p>
                                  ) : (
                                    aDay.detail_guru.map((blk, blkIdx) => (
                                      <div
                                        key={`blk-${blkIdx}`}
                                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-md border border-slate-200/70 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                                      >
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                                            {blk.nama_mapel}
                                          </span>
                                          <span className="text-[10px] text-slate-400">
                                            (Jam {blk.jam_ke_mulai === blk.jam_ke_selesai ? blk.jam_ke_mulai : `${blk.jam_ke_mulai}-${blk.jam_ke_selesai}`})
                                          </span>
                                          {blk.guru_nama && (
                                            <span className="text-[10px] text-slate-500">· Guru: {blk.guru_nama}</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 sm:mt-0">
                                          {blk.catatan && (
                                            <span className="text-[10px] text-slate-500 italic">
                                              &ldquo;{blk.catatan}&rdquo;
                                            </span>
                                          )}
                                          <span className={`rounded-full border px-2 py-0.2 text-[10px] font-bold ${badgeClass(blk.status)}`}>
                                            {attendanceStatusLabel(blk.status)}
                                          </span>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
