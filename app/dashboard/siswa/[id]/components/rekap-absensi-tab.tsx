// Lokasi: app/dashboard/siswa/[id]/components/rekap-absensi-tab.tsx
'use client'

import { useRef, useState } from 'react'
import { buildStudentAttendancePrintHtml, STUDENT_PRINT_STATUSES, type StudentPrintStatus as StatusKey } from '@/lib/student-attendance-print'
import { reserveAttendancePrintWindow, printAttendanceDocument } from '@/lib/attendance-print-client'
import { getAbsensiPerSiswa, getWaliKelasForSiswa } from '@/app/dashboard/rekap-absensi/actions'
import { Button } from '@/components/ui/button'
import { nowWIB, todayWIB } from '@/lib/time'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getKeputusanAbsensiHistory, type KeputusanAbsensiHistoryRow } from '@/app/dashboard/kelas-binaan/attendance-actions'
import { attendanceSourceLabel, attendanceStatusLabel } from '@/lib/attendance-status'
import { downloadAttendanceWorkbook } from '@/lib/attendance-xlsx'
import { 
  CalendarSearch, RefreshCw, CheckCircle2, AlertTriangle, 
  Clock, XCircle, MinusCircle, ChevronDown, ChevronRight,
  FileSpreadsheet, Loader2, BarChart3, History, Printer, SlidersHorizontal
} from 'lucide-react'

// ============================================================
// TIPE
// ============================================================
type AbsensiDay = {
  tanggal: string
  hariNama: string
  totalBlok: number
  blokHadir: number
  blokTidakHadir: number
  statusHari: string
  statusGuru?: string
  statusWaliKelas?: string | null
  sumberStatus?: string
  submittedBlok?: number
  pendingBlok?: number
  statusReason?: string
  keteranganWaliKelas?: string | null
  detail: {
    status: string
    nama_mapel: string
    jam_ke_mulai: number
    jam_ke_selesai: number
    catatan?: string
    guru_nama?: string
  }[]
}

type RekapResult = {
  error: string | null
  siswa?: { nama: string; nisn: string; nis_lokal?: string | null; kelas: string }
  days?: AbsensiDay[]
  summary?: { hadir: number; parsial: number; sakit: number; izin: number; alfa: number; perlu_konfirmasi_wali?: number; belum_ada_input?: number; belum_ada_data?: number }
  totalHari?: number
}

// ============================================================
// SUB-KOMPONEN: Badge Status
// ============================================================
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    'HADIR':         { cls: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Hadir' },
    'BOLOS':         { cls: 'bg-amber-100 text-amber-700 border-amber-200',       icon: <Clock className="h-3 w-3" />,        label: 'Bolos' },
    'PERLU KONFIRMASI WALI': { cls: 'bg-purple-100 text-purple-700 border-purple-200', icon: <AlertTriangle className="h-3 w-3" />, label: 'Perlu Keputusan Wali' },
    'SAKIT':         { cls: 'bg-blue-100 text-blue-700 border-blue-200',           icon: <MinusCircle className="h-3 w-3" />,  label: 'Sakit' },
    'IZIN':          { cls: 'bg-indigo-100 text-indigo-700 border-indigo-200',     icon: <MinusCircle className="h-3 w-3" />,  label: 'Izin' },
    'ALFA':          { cls: 'bg-rose-100 text-rose-700 border-rose-200',           icon: <XCircle className="h-3 w-3" />,      label: 'Alfa' },
    'BELUM ADA INPUT': { cls: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800', icon: <AlertTriangle className="h-3 w-3" />, label: 'Belum Ada Input' },
    'BELUM_ADA_INPUT': { cls: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800', icon: <AlertTriangle className="h-3 w-3" />, label: 'Belum Ada Input' },
    'BELUM_ADA_DATA': { cls: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800', icon: <AlertTriangle className="h-3 w-3" />, label: 'Belum Lengkap' },
  }
  const cfg = map[status] ?? { cls: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800', icon: null, label: attendanceStatusLabel(status) }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.cls}`}>
      {cfg.icon}{attendanceStatusLabel(status)}
    </span>
  )
}

// ============================================================
// KOMPONEN UTAMA
// ============================================================
export function RekapAbsensiTab({ siswaId, siswa }: { siswaId: string; siswa?: { nama_lengkap: string; nisn?: string; nis_lokal?: string; kelas?: { tingkat: number; nomor_kelas: number; kelompok: string } } }) {
  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent)
  // Default: 1 bulan ke belakang
  const [tglMulai, setTglMulai] = useState(() => { const d = nowWIB(); d.setUTCDate(1); return d.toISOString().split('T')[0] })
  const [tglSelesai, setTglSelesai] = useState(() => todayWIB())
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [result, setResult] = useState<RekapResult | null>(null)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [waliKelas, setWaliKelas] = useState<string | null>(null)
  const [history, setHistory] = useState<KeputusanAbsensiHistoryRow[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── State dialog cetak ──
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const ALL_STATUS = [...STUDENT_PRINT_STATUSES]
  const [printFilter, setPrintFilter] = useState<Set<StatusKey>>(new Set(ALL_STATUS))
  const [printPaper, setPrintPaper] = useState<'A4' | 'F4'>('F4')
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait')

  const loadHistory = async () => {
    setHistoryLoading(true)
    const response = await getKeputusanAbsensiHistory(siswaId)
    setHistory(response.history || [])
    setHistoryLoading(false)
  }

  const togglePrintFilter = (s: StatusKey) => setPrintFilter(prev => {
    const next = new Set(prev)
    next.has(s) ? next.delete(s) : next.add(s)
    return next
  })

  const toggleDay = (tgl: string) => setExpandedDays(prev => {
    const next = new Set(prev)
    next.has(tgl) ? next.delete(tgl) : next.add(tgl)
    return next
  })

  const handleLoad = async () => {
    setLoading(true)
    setLoaded(false)
    setResult(null)
    setExpandedDays(new Set())
    try {
      const [data, wkNama] = await Promise.all([
        getAbsensiPerSiswa(siswaId, tglMulai, tglSelesai),
        getWaliKelasForSiswa(siswaId),
      ])
      setResult(data as RekapResult)
      setWaliKelas(wkNama)
      setLoaded(true)
    } catch (e) {
      setResult({ error: 'Gagal memuat data. Coba lagi.' })
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  // ── CETAK LAPORAN ──
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const printBusy = useRef(false)
  const handlePrint = async (filterStatus: Set<StatusKey>) => {
    if (printBusy.current || !result || result.error || !result.days) return
    printBusy.current = true
    setPrinting(true)
    setPrintError(null)
    let printWindow: Window | null = null
    try {
      printWindow = reserveAttendancePrintWindow()
      const html = buildStudentAttendancePrintHtml({
        result: { ...result, siswa: result.siswa ? { ...result.siswa, nis_lokal: result.siswa.nis_lokal ?? siswa?.nis_lokal } : undefined },
        waliKelas, startDate: tglMulai, endDate: tglSelesai, statuses: filterStatus,
        paper: printPaper, orientation: printOrientation, origin: window.location.origin,
      })
      await printAttendanceDocument(html, printWindow)
      setShowPrintDialog(false)
    } catch (error) {
      printWindow?.close()
      setPrintError(error instanceof Error ? error.message : 'Gagal menyiapkan cetakan. Silakan coba lagi.')
    } finally {
      printBusy.current = false
      setPrinting(false)
    }
  }

  const summary = result?.summary
  const days = result?.days ?? []

  // ── Stat card ──
  const statCards = summary ? [
    { label: 'Hadir',   val: summary.hadir,   cls: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' },
    { label: 'Bolos', val: summary.parsial, cls: 'bg-amber-50 border-amber-200 text-amber-700' },
    { label: 'Sakit',   val: summary.sakit,   cls: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Izin',    val: summary.izin,    cls: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
    { label: 'Alfa',    val: summary.alfa,    cls: 'bg-rose-50 border-rose-200 text-rose-700' },
    { label: 'Keputusan Wali', val: summary.perlu_konfirmasi_wali ?? 0, cls: 'bg-purple-50 border-purple-200 text-purple-700' },
    { label: 'Belum Ada Input', val: summary.belum_ada_input ?? 0, cls: 'bg-slate-50 border-slate-200 text-slate-600' },
    { label: 'Belum Lengkap', val: summary.belum_ada_data ?? 0, cls: 'bg-slate-50 border-slate-200 text-slate-600' },
  ] : []

  return (
    <>
      <div className="space-y-4">
        {/* ─── FILTER & TOMBOL ─── */}
        <div className="bg-surface border border-surface rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CalendarSearch className="h-5 w-5 text-cyan-600" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100 text-sm">Rekap Absensi Harian</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr,1fr,auto] gap-3 items-end">
            <div className="w-full">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Tanggal Mulai
              </label>
              <input
                type="date"
                value={tglMulai}
                max={tglSelesai}
                onChange={e => setTglMulai(e.target.value)}
                className="w-full h-10 border border-surface rounded-lg px-3 text-sm font-medium bg-surface-2 text-slate-700 dark:text-slate-300 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400"
              />
            </div>
            <div className="w-full">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Tanggal Selesai
              </label>
              <input
                type="date"
                value={tglSelesai}
                min={tglMulai}
                onChange={e => setTglSelesai(e.target.value)}
                className="w-full h-10 border border-surface rounded-lg px-3 text-sm font-medium bg-surface-2 text-slate-700 dark:text-slate-300 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400"
              />
            </div>
            <div className="flex gap-2 w-full xl:w-auto">
              <Button
                onClick={handleLoad}
                disabled={loading}
                className="h-10 flex-1 xl:flex-none px-5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm gap-2 shadow-sm"
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Memuat...</>
                  : loaded
                  ? <><RefreshCw className="h-4 w-4" /> Muat Ulang</>
                  : <><BarChart3 className="h-4 w-4" /> Muat Data</>
                }
              </Button>
              {loaded && !result?.error && (result?.days?.length ?? 0) > 0 && (
                <>
                  <Button
                    onClick={() => {
                      setPrintError(null)
                      setPrintFilter(new Set(ALL_STATUS))
                      setShowPrintDialog(true)
                    }}
                    variant="outline"
                    className="h-10 flex-1 xl:flex-none px-4 text-sm font-bold gap-2 border-cyan-300 text-cyan-700 hover:bg-cyan-50"
                  >
                    <Printer className="h-4 w-4" /> Cetak Laporan
                  </Button>
                  <Button
                    onClick={() => downloadAttendanceWorkbook({
                      kind: 'siswa',
                      data: { rekap: result, waliKelas },
                      filename: `rekap-absensi-${result?.siswa?.nama || 'siswa'}-${tglMulai}-${tglSelesai}`,
                      periodLabel: `${tglMulai} s.d. ${tglSelesai}`,
                    })}
                    variant="outline"
                    className="h-10 flex-1 xl:flex-none px-4 text-sm font-bold gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Excel
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ─── PLACEHOLDER (SEBELUM LOAD) ─── */}
        {!loaded && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-surface border border-dashed border-surface rounded-xl">
            <BarChart3 className="h-12 w-12 mb-4 opacity-25" />
            <p className="font-semibold text-slate-500 dark:text-slate-400">Data belum dimuat</p>
            <p className="text-sm mt-1">Atur rentang tanggal lalu tekan <strong>Muat Data Absensi</strong></p>
          </div>
        )}

        {/* ─── LOADING SKELETON ─── */}
        {loading && (
          <div className="space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-surface rounded-xl border border-surface" />
            ))}
          </div>
        )}

        {/* ─── ERROR ─── */}
        {loaded && result?.error && (
          <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="font-semibold text-sm">{result.error}</p>
          </div>
        )}

        {/* ─── HASIL ─── */}
        {loaded && !result?.error && (
          <>
            <div className="rounded-xl border border-surface bg-surface p-3">
              <Button variant="outline" size="sm" onClick={loadHistory} disabled={historyLoading} className="gap-2">
                {historyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
                Riwayat Keputusan Wali
              </Button>
              {history && (
                <div className="mt-3 space-y-2 text-xs">
                  {history.length === 0 ? <p className="text-slate-500">Belum ada riwayat keputusan wali.</p> : history.map(item => (
                    <div key={item.id} className="rounded-lg border border-surface bg-slate-50 p-2 dark:bg-slate-800">
                      <p className="font-semibold">{item.tanggal || '-'} · {item.actor_name || 'Pengguna'} · {new Date(item.created_at).toLocaleString('id-ID')}</p>
                      <p className="text-slate-600 dark:text-slate-300">
                        {item.before.status ? attendanceStatusLabel(item.before.status) : 'Ikuti Guru'} → {item.after.status ? attendanceStatusLabel(item.after.status) : 'Ikuti Guru'}
                      </p>
                      {(item.before.keterangan || item.after.keterangan) && <p className="text-slate-500">Catatan: {item.before.keterangan || '-'} → {item.after.keterangan || '-'}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-2">
              {statCards.map(s => (
                <div key={s.label} className={`border rounded-xl p-3 text-center flex flex-col items-center ${s.cls}`}>
                  <p className="text-2xl font-black">{s.val}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Daftar Harian */}
            {days.length === 0 ? (
              <div className="text-center py-12 bg-surface border border-dashed border-surface rounded-xl text-slate-400">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-200" />
                <p className="font-semibold text-slate-500 dark:text-slate-400">Tidak ada data absensi pada rentang ini.</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[520px] pr-1">
                <div className="space-y-1.5">
                  {days.map(day => {
                    const isExpanded = expandedDays.has(day.tanggal)
                    const hasDetail = day.detail.length > 0
                    return (
                      <div
                        key={day.tanggal}
                        className="border border-surface rounded-xl overflow-hidden bg-surface shadow-sm"
                      >
                        <button
                          onClick={() => hasDetail && toggleDay(day.tanggal)}
                          disabled={!hasDetail}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                            hasDetail ? 'hover:bg-surface-2 cursor-pointer' : 'cursor-default'
                          } ${isExpanded ? 'bg-surface-2' : ''}`}
                        >
                          <div className="shrink-0 text-center w-10">
                            <p className="text-xs font-black text-slate-800 dark:text-slate-200 dark:text-slate-100 leading-none">
                              {new Date(day.tanggal + 'T00:00:00').getDate()}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">
                              {day.hariNama.slice(0, 3)}
                            </p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300 truncate">
                              {new Date(day.tanggal + 'T00:00:00').toLocaleDateString('id-ID', {
                                day: 'numeric', month: 'long', year: 'numeric'
                              })}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {day.submittedBlok || 0}/{day.totalBlok} blok disubmit · {day.blokHadir} blok hadir
                            </p>
                            {day.statusReason && <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{day.statusReason}</p>}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {day.sumberStatus && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  {day.sumberStatus === 'guru' ? 'Guru'
                                    : day.sumberStatus === 'wali_kelas' ? 'Wali Kelas'
                                    : day.sumberStatus === 'koreksi_wali_kelas' ? 'Koreksi Wali'
                                    : 'Belum lengkap'}
                                </span>
                              )}
                              {day.statusWaliKelas && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  Koreksi: {day.statusWaliKelas}
                                </span>
                              )}
                            </div>
                            {day.keteranganWaliKelas && (
                              <p className="text-[10px] text-emerald-600 mt-1 truncate">
                                Catatan wali kelas: {day.keteranganWaliKelas}
                              </p>
                            )}
                          </div>
                          <StatusBadge status={day.statusHari} />
                          {hasDetail && (
                            <span className="text-slate-400 shrink-0">
                              {isExpanded
                                ? <ChevronDown className="h-4 w-4" />
                                : <ChevronRight className="h-4 w-4" />}
                            </span>
                          )}
                        </button>

                        {isExpanded && hasDetail && (
                          <div className="border-t border-surface bg-slate-50 dark:bg-slate-800/70 divide-y divide-slate-100 animate-in slide-in-from-top-1 fade-in duration-200">
                            {day.detail.map((d, i) => (
                              <div key={i} className="flex items-start gap-3 px-4 py-2">
                                <span className={`mt-0.5 shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                  d.status === 'ALFA'  ? 'bg-rose-100 text-rose-700 border-rose-200' :
                                  d.status === 'SAKIT' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                  d.status === 'IZIN'  ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                                  'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                                }`}>
                                  {d.status}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 dark:text-slate-200 truncate">{d.nama_mapel}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    Jam ke-{d.jam_ke_mulai}{d.jam_ke_selesai > d.jam_ke_mulai ? `–${d.jam_ke_selesai}` : ''}
                                    {d.guru_nama ? ` · ${d.guru_nama}` : ''}
                                  </p>
                                  {d.catatan && (
                                    <p className="text-[10px] italic text-slate-500 dark:text-slate-400 mt-0.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded px-2 py-0.5">
                                      &quot;{d.catatan}&quot;
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </>
        )}
      </div>

      {/* ─── DIALOG KONFIRMASI CETAK ─── */}
      <Dialog open={showPrintDialog} onOpenChange={open => { if (!printing) setShowPrintDialog(open) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-5 w-5 text-cyan-600" />
              Pilih Status yang Dicetak
            </DialogTitle>
          </DialogHeader>

          <fieldset disabled={printing} className="py-1 space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 pb-1">
              Centang status kehadiran yang ingin diikutkan dalam laporan cetak.
            </p>

            <div className="grid grid-cols-2 gap-2 pb-2">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Kertas</p>
                <Select value={printPaper} onValueChange={value => setPrintPaper(value as 'A4' | 'F4')}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="A4">A4</SelectItem><SelectItem value="F4">F4</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Orientasi</p>
                <Select value={printOrientation} onValueChange={value => setPrintOrientation(value as 'portrait' | 'landscape')}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="portrait">Portrait</SelectItem><SelectItem value="landscape">Landscape</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            {([
              { key: 'HADIR'         as StatusKey, label: 'Hadir',         desc: 'Hadir semua jam pelajaran',   cls: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' },
              { key: 'BOLOS'         as StatusKey, label: 'Bolos',         desc: 'Hadir sebagian jam, alfa sebagian jam', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
              { key: 'SAKIT'         as StatusKey, label: 'Sakit',         desc: 'Tidak hadir karena sakit',    cls: 'bg-blue-50 border-blue-200 text-blue-700' },
              { key: 'IZIN'          as StatusKey, label: 'Izin',          desc: 'Tidak hadir karena izin',     cls: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
              { key: 'ALFA'          as StatusKey, label: 'Alfa',          desc: 'Tidak hadir tanpa keterangan',cls: 'bg-rose-50 border-rose-200 text-rose-700' },
              { key: 'PERLU KONFIRMASI WALI' as StatusKey, label: 'Keputusan Wali', desc: 'Campuran status, perlu ditentukan wali kelas', cls: 'bg-purple-50 border-purple-200 text-purple-700' },
              { key: 'BELUM ADA INPUT' as StatusKey, label: 'Belum Ada Input', desc: 'Belum ada satu pun blok jam yang disubmit', cls: 'bg-slate-50 border-slate-200 text-slate-600' },
              { key: 'BELUM_ADA_DATA' as StatusKey, label: 'Belum Lengkap', desc: 'Absensi harian belum selesai diinput', cls: 'bg-slate-50 border-slate-200 text-slate-600' },
            ]).map(item => {
              const count = result?.days?.filter(d => d.statusHari === item.key).length ?? 0
              const checked = printFilter.has(item.key)
              return (
                <label
                  key={item.key}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
                    checked
                      ? `${item.cls} shadow-sm`
                      : 'bg-surface border-surface text-slate-400 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePrintFilter(item.key)}
                    className="h-4 w-4 rounded shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-none">{item.label}</p>
                    <p className="text-[11px] mt-0.5 opacity-75">{item.desc}</p>
                  </div>
                  <span className="text-xl font-black shrink-0 w-8 text-right">{count}</span>
                </label>
              )
            })}

            <div className="pt-3 border-t border-surface-2 text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center">
              <span>Total hari yang akan dicetak:</span>
              <strong className="text-sm text-slate-700 dark:text-slate-300 dark:text-slate-200">
                {result?.days?.filter(d => printFilter.has(d.statusHari as StatusKey)).length ?? 0} hari
              </strong>
            </div>
          </fieldset>

          {printError && <p role="alert" className="text-sm text-red-600">{printError}</p>}
          <DialogFooter className="gap-2 flex-row justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={printing}
              onClick={() => setShowPrintDialog(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              disabled={printing || printFilter.size === 0}
              onClick={() => handlePrint(printFilter)}
              className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2"
            >
              <Printer className="h-4 w-4" /> {printing ? 'Menyiapkan...' : isMobile ? 'Simpan PDF' : 'Cetak Sekarang'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
