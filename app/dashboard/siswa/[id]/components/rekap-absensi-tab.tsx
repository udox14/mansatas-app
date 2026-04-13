// Lokasi: app/dashboard/siswa/[id]/components/rekap-absensi-tab.tsx
'use client'

import { useState } from 'react'
import { getAbsensiPerSiswa, getWaliKelasForSiswa } from '@/app/dashboard/rekap-absensi/actions'
import { Button } from '@/components/ui/button'
import { nowWIB, todayWIB } from '@/lib/time'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { 
  CalendarSearch, RefreshCw, CheckCircle2, AlertTriangle, 
  Clock, XCircle, MinusCircle, ChevronDown, ChevronRight,
  Loader2, BarChart3, Printer, SlidersHorizontal
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
  siswa?: { nama: string; nisn: string; kelas: string }
  days?: AbsensiDay[]
  summary?: { hadir: number; parsial: number; sakit: number; izin: number; alfa: number }
  totalHari?: number
}

// ============================================================
// SUB-KOMPONEN: Badge Status
// ============================================================
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    'HADIR':         { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Hadir' },
    'HADIR PARSIAL': { cls: 'bg-amber-100 text-amber-700 border-amber-200',       icon: <Clock className="h-3 w-3" />,        label: 'Parsial' },
    'SAKIT':         { cls: 'bg-blue-100 text-blue-700 border-blue-200',           icon: <MinusCircle className="h-3 w-3" />,  label: 'Sakit' },
    'IZIN':          { cls: 'bg-indigo-100 text-indigo-700 border-indigo-200',     icon: <MinusCircle className="h-3 w-3" />,  label: 'Izin' },
    'ALFA':          { cls: 'bg-rose-100 text-rose-700 border-rose-200',           icon: <XCircle className="h-3 w-3" />,      label: 'Alfa' },
  }
  const cfg = map[status] ?? { cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: null, label: status }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

// ============================================================
// KOMPONEN UTAMA
// ============================================================
export function RekapAbsensiTab({ siswaId, siswa }: { siswaId: string; siswa?: { nama_lengkap: string; nisn?: string; nis_lokal?: string; kelas?: { tingkat: number; nomor_kelas: number; kelompok: string } } }) {
  // Default: 1 bulan ke belakang
  const [tglMulai, setTglMulai] = useState(() => { const d = nowWIB(); d.setUTCDate(1); return d.toISOString().split('T')[0] })
  const [tglSelesai, setTglSelesai] = useState(() => todayWIB())
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [result, setResult] = useState<RekapResult | null>(null)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [waliKelas, setWaliKelas] = useState<string | null>(null)

  // ── State dialog cetak ──
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  type StatusKey = 'HADIR' | 'HADIR PARSIAL' | 'SAKIT' | 'IZIN' | 'ALFA'
  const ALL_STATUS: StatusKey[] = ['HADIR', 'HADIR PARSIAL', 'SAKIT', 'IZIN', 'ALFA']
  const [printFilter, setPrintFilter] = useState<Set<StatusKey>>(new Set(ALL_STATUS))

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
  const handlePrint = (filterStatus: Set<StatusKey>) => {
    if (!result || result.error || !result.days) return
    const { days: allDays, summary, siswa: siswaMeta, totalHari } = result

    // Filter hari berdasarkan status yang dipilih
    const days = allDays.filter(d => filterStatus.has(d.statusHari as StatusKey))

    const fmtTgl = (t: string) => new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    const fmtTglShort = (t: string) => new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    const nowStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const tglTtd = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' })

    const statusLabel: Record<string, string> = {
      HADIR: 'Hadir', 'HADIR PARSIAL': 'Hadir Parsial', SAKIT: 'Sakit', IZIN: 'Izin', ALFA: 'Alfa'
    }

    const namaMeta  = siswa?.nama_lengkap || siswaMeta?.nama || '-'
    const nisnMeta  = siswa?.nisn         || siswaMeta?.nisn || '-'
    const nisMeta   = siswa?.nis_lokal    || '-'
    const kelasMeta = result.siswa?.kelas || '-'
    const wkNama    = waliKelas           || 'Belum Ditentukan'

    const TD = 'border:1px solid #555;padding:3px 5px;vertical-align:top;'

    // Baris tabel detail per hari
    const tableRows = days.map((day, i) => {
      const detailStr = day.detail.length > 0
        ? day.detail.map(d =>
            `${d.nama_mapel} (Jam ${d.jam_ke_mulai}${d.jam_ke_selesai > d.jam_ke_mulai ? '\u2013' + d.jam_ke_selesai : ''}):` +
            ` ${statusLabel[d.status] || d.status}` +
            `${d.catatan ? ' — ' + d.catatan : ''}`
          ).join('<br/>')
        : 'Hadir semua jam'

      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f5f5f5'}">
        <td style="${TD}text-align:center;width:24px">${i + 1}</td>
        <td style="${TD}width:24px;text-align:center">${new Date(day.tanggal + 'T00:00:00').getDate()}</td>
        <td style="${TD}width:44px">${day.hariNama}</td>
        <td style="${TD}width:70px">${fmtTglShort(day.tanggal)}</td>
        <td style="${TD}width:40px;text-align:center">${day.blokHadir}/${day.totalBlok}</td>
        <td style="${TD}width:70px">${statusLabel[day.statusHari] || day.statusHari}</td>
        <td style="${TD}font-size:8.5px;line-height:1.5">${detailStr}</td>
      </tr>`
    }).join('')

    // Dapatkan origin untuk URL absolut gambar kopsurat
    const origin = typeof window !== 'undefined' ? window.location.origin : ''

    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
<title>Rekap Absensi \u2014 ${namaMeta}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; background: #fff; }
  @page { size: 215mm 330mm; margin: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }

  .page { width: 215mm; min-height: 330mm; padding: 0 12mm 12mm 12mm; }

  /* KOP */
  .kop-img { width: 100%; display: block; margin-bottom: 8pt; }

  /* GARIS BAWAH KOP */
  .kop-line { border-top: 2pt solid #000; margin-bottom: 10pt; }

  /* JUDUL */
  .judul { text-align: center; margin-bottom: 10pt; }
  .judul h2 { font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 2pt; }
  .judul .periode { font-size: 11pt; font-weight: normal; }

  /* INFO SISWA */
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; font-size: 10pt; }
  .info-table td { padding: 1.5pt 0; vertical-align: top; }
  .info-table td:first-child { width: 110pt; }
  .info-table td:nth-child(2) { width: 10pt; text-align: center; }

  /* RINGKASAN */
  .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }
  .summary-table th, .summary-table td { border: 1px solid #555; padding: 4pt 6pt; text-align: center; font-size: 10pt; }
  .summary-table th { font-weight: bold; background: #eee; }

  /* TABEL HARIAN */
  table.main { width: 100%; border-collapse: collapse; font-size: 9pt; }
  table.main thead tr { background: #ddd; }
  table.main thead th { border: 1px solid #555; padding: 4pt 4pt; font-weight: bold; text-align: center; }
  table.main tbody td { border: 1px solid #888; padding: 2.5pt 4pt; vertical-align: top; }

  /* FOOTER */
  .footer { margin-top: 14pt; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10pt; }
  .footer .keterangan p { margin-bottom: 1.5pt; }
  .footer .ttd { text-align: center; }
  .footer .ttd-space { height: 44pt; }
  .footer .ttd-nama { font-weight: bold; border-top: 1pt solid #000; padding-top: 2pt; }

  /* Colofon */
  .colofon { font-size: 7.5pt; color: #777; text-align: center; margin-top: 10pt; }
</style>
</head>
<body>
<div class="page">

  <img class="kop-img" src="${origin}/kopsurat.png" alt="Kop Surat" />

  <div class="judul">
    <h2>Rekap Kehadiran Siswa</h2>
    <div class="periode">Periode: ${fmtTgl(tglMulai)} &ndash; ${fmtTgl(tglSelesai)}</div>
  </div>

  <table class="info-table">
    <tr><td>Nama Siswa</td><td>:</td><td><strong>${namaMeta}</strong></td></tr>
    <tr><td>NISN</td><td>:</td><td>${nisnMeta}</td></tr>
    <tr><td>NIS Lokal</td><td>:</td><td>${nisMeta}</td></tr>
    <tr><td>Kelas</td><td>:</td><td>${kelasMeta}</td></tr>
    <tr><td>Total Hari Efektif</td><td>:</td><td>${totalHari || days.length} hari</td></tr>
  </table>

  <table class="summary-table">
    <thead>
      <tr>
        <th>Hadir</th><th>Hadir Parsial</th><th>Sakit</th><th>Izin</th><th>Alfa</th><th>Total Hari</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${summary?.hadir ?? 0}</td>
        <td>${summary?.parsial ?? 0}</td>
        <td>${summary?.sakit ?? 0}</td>
        <td>${summary?.izin ?? 0}</td>
        <td>${summary?.alfa ?? 0}</td>
        <td>${days.length}</td>
      </tr>
    </tbody>
  </table>

  <table class="main">
    <thead>
      <tr>
        <th style="width:24px">No</th>
        <th style="width:24px">Tgl</th>
        <th style="width:44px">Hari</th>
        <th style="width:70px">Tanggal</th>
        <th style="width:40px">Blok</th>
        <th style="width:70px">Status</th>
        <th>Detail Ketidakhadiran</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="footer">
    <div class="keterangan">
      <p><strong>Keterangan:</strong></p>
      <p>Hadir: Hadir semua blok jam pelajaran</p>
      <p>Hadir Parsial: Hadir sebagian jam</p>
      <p>Sakit / Izin: Tidak hadir dengan keterangan</p>
      <p>Alfa: Tidak hadir tanpa keterangan</p>
    </div>
    <div class="ttd">
      <p>Tasikmalaya, ${tglTtd}</p>
      <p style="margin-top:2pt">Wali Kelas,</p>
      <div class="ttd-space"></div>
      <div class="ttd-nama">${wkNama}</div>
    </div>
  </div>

  <p class="colofon">Dicetak melalui Sistem Informasi Manajemen MAN 1 Tasikmalaya &bull; ${nowStr} WIB</p>
</div>
</body></html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
    setShowPrintDialog(false)
  }

  const summary = result?.summary
  const days = result?.days ?? []

  // ── Stat card ──
  const statCards = summary ? [
    { label: 'Hadir',   val: summary.hadir,   cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'Parsial', val: summary.parsial, cls: 'bg-amber-50 border-amber-200 text-amber-700' },
    { label: 'Sakit',   val: summary.sakit,   cls: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Izin',    val: summary.izin,    cls: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
    { label: 'Alfa',    val: summary.alfa,    cls: 'bg-rose-50 border-rose-200 text-rose-700' },
  ] : []

  return (
    <>
      <div className="space-y-4">
        {/* ─── FILTER & TOMBOL ─── */}
        <div className="bg-surface border border-surface rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CalendarSearch className="h-5 w-5 text-cyan-600" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Rekap Absensi Harian</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Tanggal Mulai
                </label>
                <input
                  type="date"
                  value={tglMulai}
                  max={tglSelesai}
                  onChange={e => setTglMulai(e.target.value)}
                  className="w-full border border-surface rounded-lg px-3 py-1.5 text-sm font-medium bg-surface-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Tanggal Selesai
                </label>
                <input
                  type="date"
                  value={tglSelesai}
                  min={tglMulai}
                  onChange={e => setTglSelesai(e.target.value)}
                  className="w-full border border-surface rounded-lg px-3 py-1.5 text-sm font-medium bg-surface-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400"
                />
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                onClick={handleLoad}
                disabled={loading}
                className="h-9 px-5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm gap-2 shadow-sm"
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Memuat...</>
                  : loaded
                  ? <><RefreshCw className="h-4 w-4" /> Muat Ulang</>
                  : <><BarChart3 className="h-4 w-4" /> Muat Data</>
                }
              </Button>
              {loaded && !result?.error && (result?.days?.length ?? 0) > 0 && (
                <Button
                  onClick={() => {
                    setPrintFilter(new Set(ALL_STATUS))
                    setShowPrintDialog(true)
                  }}
                  variant="outline"
                  className="h-9 px-4 text-sm font-bold gap-2 border-cyan-300 text-cyan-700 hover:bg-cyan-50"
                >
                  <Printer className="h-4 w-4" /> Cetak Laporan
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ─── PLACEHOLDER (SEBELUM LOAD) ─── */}
        {!loaded && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-surface border border-dashed border-surface rounded-xl">
            <BarChart3 className="h-12 w-12 mb-4 opacity-25" />
            <p className="font-semibold text-slate-500">Data belum dimuat</p>
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
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
                <p className="font-semibold text-slate-500">Tidak ada data absensi pada rentang ini.</p>
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
                            <p className="text-xs font-black text-slate-800 dark:text-slate-100 leading-none">
                              {new Date(day.tanggal + 'T00:00:00').getDate()}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">
                              {day.hariNama.slice(0, 3)}
                            </p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                              {new Date(day.tanggal + 'T00:00:00').toLocaleDateString('id-ID', {
                                day: 'numeric', month: 'long', year: 'numeric'
                              })}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {day.blokHadir}/{day.totalBlok} blok hadir
                            </p>
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
                          <div className="border-t border-surface bg-slate-50/70 divide-y divide-slate-100 animate-in slide-in-from-top-1 fade-in duration-200">
                            {day.detail.map((d, i) => (
                              <div key={i} className="flex items-start gap-3 px-4 py-2">
                                <span className={`mt-0.5 shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                  d.status === 'ALFA'  ? 'bg-rose-100 text-rose-700 border-rose-200' :
                                  d.status === 'SAKIT' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                  d.status === 'IZIN'  ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                                  'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {d.status}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{d.nama_mapel}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    Jam ke-{d.jam_ke_mulai}{d.jam_ke_selesai > d.jam_ke_mulai ? `–${d.jam_ke_selesai}` : ''}
                                    {d.guru_nama ? ` · ${d.guru_nama}` : ''}
                                  </p>
                                  {d.catatan && (
                                    <p className="text-[10px] italic text-slate-500 mt-0.5 bg-white border border-slate-100 rounded px-2 py-0.5">
                                      "{d.catatan}"
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
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-5 w-5 text-cyan-600" />
              Pilih Status yang Dicetak
            </DialogTitle>
          </DialogHeader>

          <div className="py-1 space-y-2">
            <p className="text-xs text-slate-500 pb-1">
              Centang status kehadiran yang ingin diikutkan dalam laporan cetak.
            </p>

            {([
              { key: 'HADIR'         as StatusKey, label: 'Hadir',         desc: 'Hadir semua jam pelajaran',   cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
              { key: 'HADIR PARSIAL' as StatusKey, label: 'Hadir Parsial', desc: 'Hadir sebagian jam',          cls: 'bg-amber-50 border-amber-200 text-amber-700' },
              { key: 'SAKIT'         as StatusKey, label: 'Sakit',         desc: 'Tidak hadir karena sakit',    cls: 'bg-blue-50 border-blue-200 text-blue-700' },
              { key: 'IZIN'          as StatusKey, label: 'Izin',          desc: 'Tidak hadir karena izin',     cls: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
              { key: 'ALFA'          as StatusKey, label: 'Alfa',          desc: 'Tidak hadir tanpa keterangan',cls: 'bg-rose-50 border-rose-200 text-rose-700' },
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

            <div className="pt-3 border-t border-surface-2 text-xs text-slate-500 flex justify-between items-center">
              <span>Total hari yang akan dicetak:</span>
              <strong className="text-sm text-slate-700 dark:text-slate-200">
                {result?.days?.filter(d => printFilter.has(d.statusHari as StatusKey)).length ?? 0} hari
              </strong>
            </div>
          </div>

          <DialogFooter className="gap-2 flex-row justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPrintDialog(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              disabled={printFilter.size === 0}
              onClick={() => handlePrint(printFilter)}
              className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2"
            >
              <Printer className="h-4 w-4" /> Cetak Sekarang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
