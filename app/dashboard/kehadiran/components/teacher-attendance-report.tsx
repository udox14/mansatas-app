'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarRange,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Loader2,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openPdfFromUrl } from '@/lib/pdf/download'
import {
  getTeacherAttendanceReport,
  type TeacherAttendanceReport,
  type TeacherAttendanceStatus,
} from '../report-actions'

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultRange() {
  const end = new Date()
  const start = new Date(end.getFullYear(), end.getMonth(), 1)
  return { startDate: localDate(start), endDate: localDate(end) }
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function statusClass(status: TeacherAttendanceStatus) {
  if (status === 'HADIR') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'SAKIT') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === 'IZIN') return 'border-blue-200 bg-blue-50 text-blue-700'
  return 'border-rose-200 bg-rose-50 text-rose-700'
}

function safeFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'rekap'
}

export function TeacherAttendanceReportPanel() {
  const defaults = useMemo(defaultRange, [])
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)
  const [penugasanId, setPenugasanId] = useState('')
  const [report, setReport] = useState<TeacherAttendanceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const reportMatchesFilters = !!report
    && report.start_date === startDate
    && report.end_date === endDate
    && report.selected_penugasan_id === (penugasanId || null)

  const load = async (overridePenugasanId?: string) => {
    setLoading(true)
    const selected = overridePenugasanId ?? penugasanId
    const result = await getTeacherAttendanceReport({
      startDate,
      endDate,
      penugasanId: selected || null,
    })
    setReport(result)
    setLoading(false)
  }

  useEffect(() => {
    void load('')
    // Rentang awal hanya dimuat sekali saat tab pertama kali dibuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exportPdf = async () => {
    if (!report || !reportMatchesFilters) return
    setExporting('pdf')
    try {
      const params = new URLSearchParams({ startDate: report.start_date, endDate: report.end_date })
      if (report.selected_penugasan_id) params.set('penugasanId', report.selected_penugasan_id)
      const scope = report.assignments.find(item => item.id === report.selected_penugasan_id)
      const filename = `Rekap_Absensi_${safeFilenamePart(scope ? `${scope.mapel_nama}_${scope.kelas_label}` : report.guru?.nama_lengkap || 'Guru')}_${report.start_date}_${report.end_date}.pdf`
      await openPdfFromUrl(`/api/pdf/absensi-guru?${params.toString()}`, filename)
    } catch (error: any) {
      alert(error?.message || 'Gagal membuat PDF.')
    } finally {
      setExporting(null)
    }
  }

  const exportXlsx = async () => {
    if (!report || report.error || !reportMatchesFilters) return
    setExporting('xlsx')
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.utils.book_new()
      const scope = report.assignments.find(item => item.id === report.selected_penugasan_id)
      const summaryData: Array<Array<string | number>> = [
        ['REKAP ABSENSI SISWA - SESI MENGAJAR GURU'],
        ['Guru', report.guru?.nama_lengkap || '-'],
        ['Periode', `${formatDate(report.start_date)} s.d. ${formatDate(report.end_date)}`],
        ['Lingkup', scope ? `${scope.mapel_nama} - ${scope.kelas_label}` : 'Semua sesi mengajar'],
        [],
        ['No', 'Mata Pelajaran', 'Kelas', 'Nama Siswa', 'NISN', 'Total Sesi', 'Hadir', 'Sakit', 'Izin', 'Alfa', 'Kehadiran (%)'],
        ...report.rows.map((row, index) => [
          index + 1, row.mapel_nama, row.kelas_label, row.nama_lengkap, row.nisn,
          row.total_sesi, row.hadir, row.sakit, row.izin, row.alfa, row.kehadiran_persen,
        ]),
      ]
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
      summarySheet['!cols'] = [
        { wch: 6 }, { wch: 24 }, { wch: 14 }, { wch: 34 }, { wch: 18 },
        { wch: 12 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 16 },
      ]
      summarySheet['!autofilter'] = { ref: `A6:K${Math.max(6, summaryData.length)}` }
      for (let rowNumber = 7; rowNumber <= summaryData.length; rowNumber++) {
        const cell = summarySheet[`E${rowNumber}`]
        if (cell) { cell.t = 's'; cell.z = '@' }
      }
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Rekap Siswa')

      const detailRows: Array<Array<string | number>> = [[
        'Tanggal', 'Mata Pelajaran', 'Kelas', 'Jam Ke', 'Nama Siswa', 'NISN', 'Status', 'Catatan', 'Disubmit Oleh', 'Waktu Submit',
      ]]
      const sessionMap = new Map(report.sessions.map(session => [session.key, session]))
      for (const row of report.rows) {
        for (const item of row.sessions) {
          const session = sessionMap.get(item.session_key)
          detailRows.push([
            item.tanggal,
            row.mapel_nama,
            row.kelas_label,
            session?.jam_ke_mulai == null ? '-' : session.jam_ke_mulai === session.jam_ke_selesai ? String(session.jam_ke_mulai) : `${session.jam_ke_mulai}-${session.jam_ke_selesai}`,
            row.nama_lengkap,
            row.nisn,
            item.status,
            item.catatan,
            session?.submitted_by || '-',
            session?.submitted_at || '-',
          ])
        }
      }
      const detailSheet = XLSX.utils.aoa_to_sheet(detailRows)
      detailSheet['!cols'] = [
        { wch: 13 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 34 },
        { wch: 18 }, { wch: 10 }, { wch: 40 }, { wch: 28 }, { wch: 20 },
      ]
      detailSheet['!autofilter'] = { ref: `A1:J${Math.max(1, detailRows.length)}` }
      for (let rowNumber = 2; rowNumber <= detailRows.length; rowNumber++) {
        const cell = detailSheet[`F${rowNumber}`]
        if (cell) { cell.t = 's'; cell.z = '@' }
      }
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detail per Sesi')

      const filename = `Rekap_Absensi_${safeFilenamePart(scope ? `${scope.mapel_nama}_${scope.kelas_label}` : report.guru?.nama_lengkap || 'Guru')}_${report.start_date}_${report.end_date}.xlsx`
      XLSX.writeFile(workbook, filename)
    } catch (error: any) {
      alert(error?.message || 'Gagal membuat file Excel.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-start gap-2">
          <CalendarRange className="mt-0.5 h-4 w-4 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Rekap sesi mengajar saya</p>
            <p className="text-xs text-slate-500">Bersumber langsung dari absensi yang disimpan pada setiap sesi guru, bukan dari keputusan harian wali kelas.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Tanggal mulai</label>
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Tanggal selesai</label>
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">Mata pelajaran / kelas</label>
            <select value={penugasanId} onChange={event => setPenugasanId(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Semua sesi mengajar</option>
              {(report?.assignments || []).map(item => (
                <option key={item.id} value={item.id}>{item.mapel_nama} - {item.kelas_label} ({item.tahun_ajaran} Smt {item.semester})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => load()} disabled={loading} size="sm" className="bg-blue-600 text-white hover:bg-blue-700">
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
            Tampilkan
          </Button>
          <Button onClick={exportPdf} disabled={loading || !report || !reportMatchesFilters || !!report.error || report.sessions.length === 0 || exporting !== null} size="sm" variant="outline">
            {exporting === 'pdf' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
            Download PDF
          </Button>
          <Button onClick={exportXlsx} disabled={loading || !report || !reportMatchesFilters || !!report.error || report.sessions.length === 0 || exporting !== null} size="sm" variant="outline">
            {exporting === 'xlsx' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />}
            Download Excel
          </Button>
        </div>
      </div>

      {report?.error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{report.error}</div>}

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 py-16 text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Memuat rekap sesi...</div>
      ) : report && !report.error && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {[
              ['Sesi', report.summary.total_sesi, 'text-slate-700'],
              ['Data siswa-sesi', report.summary.total_data, 'text-slate-700'],
              ['Hadir', report.summary.hadir, 'text-emerald-700'],
              ['Sakit', report.summary.sakit, 'text-amber-700'],
              ['Izin', report.summary.izin, 'text-blue-700'],
              ['Alfa', report.summary.alfa, 'text-rose-700'],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="text-[11px] text-slate-500">{label}</p>
                <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
              </div>
            ))}
          </div>

          {report.sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">Belum ada sesi absensi yang disimpan pada rentang ini.</div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Daftar sesi tersimpan</p>
                  <p className="text-[11px] text-slate-500">Satu sesi tercatat saat tombol Simpan Absensi digunakan, termasuk ketika semua siswa hadir.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-xs">
                    <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-950/60">
                      <tr>{['Tanggal', 'Mapel / Kelas', 'Jam', 'Hadir', 'Sakit', 'Izin', 'Alfa', 'Disubmit oleh'].map(label => <th key={label} className="px-3 py-2 font-semibold">{label}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {[...report.sessions].reverse().map(session => (
                        <tr key={session.key}>
                          <td className="whitespace-nowrap px-3 py-2.5 font-medium">{formatDate(session.tanggal)}</td>
                          <td className="px-3 py-2.5"><p className="font-medium">{session.mapel_nama}</p><p className="text-[10px] text-slate-400">{session.kelas_label}</p></td>
                          <td className="px-3 py-2.5">{session.jam_ke_mulai == null ? '-' : session.jam_ke_mulai === session.jam_ke_selesai ? session.jam_ke_mulai : `${session.jam_ke_mulai}-${session.jam_ke_selesai}`}</td>
                          <td className="px-3 py-2.5 text-emerald-700">{session.hadir}</td>
                          <td className="px-3 py-2.5 text-amber-700">{session.sakit}</td>
                          <td className="px-3 py-2.5 text-blue-700">{session.izin}</td>
                          <td className="px-3 py-2.5 text-rose-700">{session.alfa}</td>
                          <td className="px-3 py-2.5"><p>{session.submitted_by}</p><p className="text-[10px] text-slate-400">{session.submitted_at}</p></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Rekap per siswa</p>
                  <p className="text-[11px] text-slate-500">Klik siswa untuk melihat status asli pada setiap sesi mengajar.</p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {report.rows.map(row => {
                    const isExpanded = expandedRow === row.key
                    return (
                      <div key={row.key}>
                        <button type="button" onClick={() => setExpandedRow(isExpanded ? null : row.key)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-950/40">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{row.nama_lengkap}</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">{row.mapel_nama} - {row.kelas_label} - {row.nisn}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">H {row.hadir}</span>
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">S {row.sakit}</span>
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700">I {row.izin}</span>
                              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">A {row.alfa}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{row.kehadiran_persen}%</span>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {[...row.sessions].reverse().map(item => (
                                <div key={item.session_key} className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                                  <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium">{formatDate(item.tanggal)}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass(item.status)}`}>{item.status}</span></div>
                                  {item.catatan && <p className="mt-1 text-[10px] text-slate-500">{item.catatan}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
