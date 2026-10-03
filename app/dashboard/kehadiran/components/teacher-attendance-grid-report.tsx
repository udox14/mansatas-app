'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarRange, FileSpreadsheet, FileText, Loader2, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { openPdfFromUrl } from '@/lib/pdf/download'
import { attendanceStatusCode, orderedAttendanceSessions, studentStatusBySession } from '@/lib/teacher-attendance-grid'
import { getTeacherAttendanceReport, type TeacherAttendanceReport, type TeacherAttendanceStatus } from '../report-actions'
import { koreksiAbsensiDariRekap } from '../actions'

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultRange() {
  const end = new Date()
  return { startDate: localDate(new Date(end.getFullYear(), end.getMonth(), 1)), endDate: localDate(end) }
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })
}

function statusClass(status: TeacherAttendanceStatus) {
  if (status === 'HADIR') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
  if (status === 'SAKIT') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
  if (status === 'IZIN') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300'
  return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300'
}

function safeFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'rekap'
}

type LoadOverrides = { startDate?: string; endDate?: string; penugasanId?: string; tahunAjaran?: string }

export function TeacherAttendanceReportPanel() {
  const defaults = useMemo(defaultRange, [])
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)
  const [penugasanId, setPenugasanId] = useState('')
  const [tahunAjaran, setTahunAjaran] = useState('')
  const [viewMode, setViewMode] = useState<'kelas' | 'siswa'>('kelas')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [report, setReport] = useState<TeacherAttendanceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null)
  const requestId = useRef(0)

  const load = async (overrides: LoadOverrides = {}) => {
    const nextStartDate = overrides.startDate ?? startDate
    const nextEndDate = overrides.endDate ?? endDate
    const nextPenugasanId = overrides.penugasanId ?? penugasanId
    const nextTahunAjaran = overrides.tahunAjaran ?? tahunAjaran
    if (!nextStartDate || !nextEndDate) return
    const currentRequest = ++requestId.current
    setLoading(true)
    setLoadError('')
    setSelectedStudentId('')
    try {
      const result = await getTeacherAttendanceReport({ startDate: nextStartDate, endDate: nextEndDate, penugasanId: nextPenugasanId || null, tahunAjaran: nextTahunAjaran || null })
      if (currentRequest !== requestId.current) return
      setReport(result)
      setPenugasanId(result.selected_penugasan_id || '')
      setTahunAjaran(result.selected_tahun_ajaran || '')
    } catch (error) {
      if (currentRequest !== requestId.current) return
      console.error('Gagal memuat rekap sesi guru:', error)
      setLoadError('Gagal memuat rekap sesi. Silakan coba lagi.')
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // Kelas yang sedang berlangsung hanya dicari saat panel pertama dibuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedAssignment = report?.assignments.find(item => item.id === penugasanId) || null
  const sessions = useMemo(() => orderedAttendanceSessions(report?.sessions || []), [report?.sessions])
  const selectedStudent = report?.rows.find(row => row.siswa_id === selectedStudentId) || null
  const reportMatchesFilters = !!report && report.start_date === startDate && report.end_date === endDate && report.selected_penugasan_id === (penugasanId || null) && report.selected_tahun_ajaran === (tahunAjaran || null)

  const exportPdf = async () => {
    if (!report || !selectedAssignment || !reportMatchesFilters) return
    setExporting('pdf')
    try {
      const params = new URLSearchParams({ startDate: report.start_date, endDate: report.end_date, penugasanId: selectedAssignment.id })
      const filename = `Rekap_Absensi_${safeFilenamePart(`${selectedAssignment.mapel_nama}_${selectedAssignment.kelas_label}`)}_${report.start_date}_${report.end_date}.pdf`
      await openPdfFromUrl(`/api/pdf/absensi-guru?${params.toString()}`, filename)
    } catch (error: any) {
      alert(error?.message || 'Gagal membuat PDF.')
    } finally { setExporting(null) }
  }

  const exportXlsx = async () => {
    if (!report || !selectedAssignment || report.error || !reportMatchesFilters) return
    setExporting('xlsx')
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.utils.book_new()
      const headers = ['No', 'Nama Siswa', ...sessions.map(session => formatDate(session.tanggal)), 'H', 'S', 'I', 'A']
      const rows = report.rows.map((row, index) => {
        const statuses = studentStatusBySession(row)
        return [index + 1, row.nama_lengkap, ...sessions.map(session => {
          const status = statuses.get(session.key)
          return status ? attendanceStatusCode(status) : '-'
        }), row.hadir, row.sakit, row.izin, row.alfa]
      })
      const sheetData: Array<Array<string | number>> = [
        ['REKAP ABSENSI SISWA - SESI MENGAJAR GURU'],
        ['Guru', report.guru?.nama_lengkap || '-'],
        ['Mapel / Kelas', `${selectedAssignment.mapel_nama} - ${selectedAssignment.kelas_label}`],
        ['Periode', `${formatDate(report.start_date)} s.d. ${formatDate(report.end_date)}`],
        ['Catatan', 'Berbasis input guru per sesi; bukan status final harian siswa.'],
        [], headers, ...rows,
      ]
      const sheet = XLSX.utils.aoa_to_sheet(sheetData)
      sheet['!cols'] = [{ wch: 6 }, { wch: 34 }, ...sessions.map(() => ({ wch: 13 })), { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }]
      sheet['!autofilter'] = { ref: `A7:${XLSX.utils.encode_col(headers.length - 1)}${Math.max(7, sheetData.length)}` }
      XLSX.utils.book_append_sheet(workbook, sheet, 'Rekap Per Kelas')
      XLSX.writeFile(workbook, `Rekap_Absensi_${safeFilenamePart(`${selectedAssignment.mapel_nama}_${selectedAssignment.kelas_label}`)}_${report.start_date}_${report.end_date}.xlsx`)
    } catch (error: any) {
      alert(error?.message || 'Gagal membuat file Excel.')
    } finally { setExporting(null) }
  }

  const canExport = !loading && !!report && !!selectedAssignment && reportMatchesFilters && !report.error && sessions.length > 0 && exporting === null

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-start gap-2">
          <CalendarRange className="mt-0.5 h-4 w-4 text-blue-600" />
          <div><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Rekap sesi mengajar saya</p><p className="text-[11px] text-slate-500">Data asli yang disimpan pada setiap sesi guru, bukan status final harian siswa.</p></div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Tanggal mulai</label>
            <input type="date" value={startDate} onChange={event => { const value = event.target.value; setStartDate(value); if (value) void load({ startDate: value }) }} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Tanggal selesai</label>
            <input type="date" value={endDate} onChange={event => { const value = event.target.value; setEndDate(value); if (value) void load({ endDate: value }) }} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </div>
          <div>
            <label htmlFor="rekap-tahun-ajaran" className="mb-1 block text-xs font-medium text-slate-500">Tahun ajaran</label>
            <select id="rekap-tahun-ajaran" value={tahunAjaran} disabled={!report} onChange={event => { const value = event.target.value; setTahunAjaran(value); setPenugasanId(''); void load({ tahunAjaran: value, penugasanId: '' }) }} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              {!report?.academic_years.length && <option value="">{loading ? 'Memuat tahun ajaran...' : 'Tahun ajaran belum tersedia'}</option>}
              {(report?.academic_years || []).map(item => <option key={item.nama} value={item.nama}>{item.nama}{item.is_active === 1 ? ' (Aktif)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Mapel / kelas</label>
            <select value={penugasanId} onChange={event => { const value = event.target.value; setPenugasanId(value); void load({ penugasanId: value }) }} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <option value="">Pilih kelas yang diajar...</option>
              {(report?.assignments || []).filter(item => item.tahun_ajaran === tahunAjaran).map(item => <option key={item.id} value={item.id}>{item.mapel_nama} - {item.kelas_label} (Smt {item.semester})</option>)}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => load()} disabled={loading} size="sm" className="bg-blue-600 text-white hover:bg-blue-700">{loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}Tampilkan</Button>
          <Button onClick={exportPdf} disabled={!canExport} size="sm" variant="outline">{exporting === 'pdf' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}Download PDF</Button>
          <Button onClick={exportXlsx} disabled={!canExport} size="sm" variant="outline">{exporting === 'xlsx' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />}Download Excel</Button>
        </div>
      </div>

      {(loadError || report?.error) && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError || report?.error}</div>}
      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 py-16 text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Memuat rekap sesi...</div>
      ) : report && !report.error && !selectedAssignment ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-14 text-center dark:border-slate-800 dark:bg-slate-900/50"><Users className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" /><p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Tidak ada kelas yang sedang berlangsung</p><p className="mt-1 text-xs text-slate-400">Pilih mapel dan kelas secara manual untuk melihat rekap.</p></div>
      ) : report && !report.error && selectedAssignment && (
        <>
          <SummaryCards report={report} />
          <div className="flex w-full rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-fit dark:border-slate-800 dark:bg-slate-950">
            <button type="button" onClick={() => setViewMode('kelas')} className={`flex-1 rounded-lg px-5 py-2 text-xs font-semibold transition-colors sm:flex-none ${viewMode === 'kelas' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300' : 'text-slate-500'}`}>Per Kelas</button>
            <button type="button" onClick={() => setViewMode('siswa')} className={`flex-1 rounded-lg px-5 py-2 text-xs font-semibold transition-colors sm:flex-none ${viewMode === 'siswa' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300' : 'text-slate-500'}`}>Per Siswa</button>
          </div>
          {sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">Belum ada sesi absensi yang disimpan untuk kelas ini pada rentang tanggal tersebut.</div>
          ) : viewMode === 'kelas' ? <ClassAttendanceGrid report={report} sessions={sessions} onSaved={() => load()} /> : (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Cari dan pilih siswa</label>
                <Combobox value={selectedStudentId} onValueChange={setSelectedStudentId} options={report.rows.map(row => ({ value: row.siswa_id, label: row.nama_lengkap, keywords: row.nisn }))} placeholder="Pilih siswa..." searchPlaceholder="Cari nama siswa..." emptyText="Siswa tidak ditemukan" className="max-w-xl" clearable />
              </div>
              {selectedStudent ? <StudentAttendanceDetail row={selectedStudent} /> : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-14 text-center dark:border-slate-800 dark:bg-slate-900/50"><Search className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" /><p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Pilih siswa untuk melihat detail sesi</p><p className="mt-1 text-xs text-slate-400">Gunakan pencarian di atas; siswa tidak dipilih secara otomatis.</p></div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCards({ report }: { report: TeacherAttendanceReport }) {
  return <div className="grid grid-cols-2 gap-2 md:grid-cols-6">{[
    ['Sesi', report.summary.total_sesi, 'text-slate-700 dark:text-slate-200'], ['Data siswa-sesi', report.summary.total_data, 'text-slate-700 dark:text-slate-200'], ['Hadir', report.summary.hadir, 'text-emerald-700 dark:text-emerald-300'], ['Sakit', report.summary.sakit, 'text-amber-700 dark:text-amber-300'], ['Izin', report.summary.izin, 'text-blue-700 dark:text-blue-300'], ['Alfa', report.summary.alfa, 'text-rose-700 dark:text-rose-300'],
  ].map(([label, value, tone]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-[11px] text-slate-500">{label}</p><p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p></div>)}</div>
}

const EDIT_STATUS_CYCLE: TeacherAttendanceStatus[] = ['HADIR', 'SAKIT', 'IZIN', 'ALFA']

function ClassAttendanceGrid({ report, sessions, onSaved }: {
  report: TeacherAttendanceReport
  sessions: TeacherAttendanceReport['sessions']
  onSaved: () => Promise<void>
}) {
  const [draft, setDraft] = useState<Record<string, TeacherAttendanceStatus>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const changeCount = Object.keys(draft).length

  const nextStatus = (current: TeacherAttendanceStatus) => EDIT_STATUS_CYCLE[(EDIT_STATUS_CYCLE.indexOf(current) + 1) % EDIT_STATUS_CYCLE.length]
  const toggleStatus = (sessionKey: string, siswaId: string, current: TeacherAttendanceStatus) => {
    const key = `${sessionKey}__${siswaId}`
    const next = nextStatus(draft[key] || current)
    setDraft(previous => ({ ...previous, [key]: next }))
  }
  const save = async () => {
    if (!changeCount) return
    setSaving(true); setError('')
    const grouped = new Map<string, { penugasanId: string; tanggal: string; changes: Array<{ siswa_id: string; status: TeacherAttendanceStatus }> }>()
    for (const [key, status] of Object.entries(draft)) {
      const [penugasanId, tanggal, siswaId] = key.split('__')
      const groupKey = `${penugasanId}__${tanggal}`
      const group = grouped.get(groupKey) || { penugasanId, tanggal, changes: [] }
      group.changes.push({ siswa_id: siswaId, status })
      grouped.set(groupKey, group)
    }
    try {
      for (const group of grouped.values()) {
        const result = await koreksiAbsensiDariRekap(group.penugasanId, group.tanggal, group.changes)
        if (result.error) throw new Error(result.error)
      }
      setDraft({})
      await onSaved()
    } catch (cause: any) { setError(cause?.message || 'Koreksi absensi gagal disimpan.') }
    finally { setSaving(false) }
  }

  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Rekap per kelas</p><p className="text-[11px] text-slate-500">Klik kode status untuk mengubahnya (Hadir → Sakit → Izin → Alfa). Nama penginput pertama tetap tersimpan.</p></div><Button size="sm" onClick={save} disabled={!changeCount || saving} className="bg-blue-600 text-white hover:bg-blue-700">{saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Simpan koreksi{changeCount ? ` (${changeCount})` : ''}</Button></div>{error && <p className="mt-2 text-xs text-rose-600">{error}</p>}</div>
    <div className="overflow-x-auto"><table className="w-max min-w-full border-separate border-spacing-0 text-xs">
      <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300"><tr>
        <th className="sticky left-0 z-30 w-[52px] min-w-[52px] border-b border-r border-slate-200 bg-slate-50 px-2 py-3 text-center font-semibold dark:border-slate-800 dark:bg-slate-950">No</th>
        <th className="min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-left font-semibold dark:border-slate-800 dark:bg-slate-950">Nama Siswa</th>
        {sessions.map(session => <th key={session.key} title={formatDate(session.tanggal)} className="min-w-[58px] border-b border-r border-slate-200 px-2 py-3 text-center font-semibold dark:border-slate-800">{formatShortDate(session.tanggal)}</th>)}
        {(['H', 'S', 'I', 'A'] as const).map(code => <th key={code} className="min-w-[52px] border-b border-r border-slate-200 px-2 py-3 text-center font-bold last:border-r-0 dark:border-slate-800">{code}</th>)}
      </tr></thead>
      <tbody>{report.rows.map((row, index) => { const statuses = studentStatusBySession(row); return <tr key={row.key} className="group">
        <td className="sticky left-0 z-20 w-[52px] min-w-[52px] border-b border-r border-slate-100 bg-white px-2 py-2.5 text-center text-slate-500 group-hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-slate-950">{index + 1}</td>
        <td className="min-w-[220px] border-b border-r border-slate-100 bg-white px-3 py-2.5 font-semibold text-slate-800 group-hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:group-hover:bg-slate-950">{row.nama_lengkap}</td>
        {sessions.map(session => { const status = statuses.get(session.key); const draftStatus = status ? draft[`${session.key}__${row.siswa_id}`] : undefined; const shownStatus = draftStatus || status; return <td key={session.key} className="border-b border-r border-slate-100 px-2 py-2 text-center dark:border-slate-800">{shownStatus ? <button type="button" onClick={() => toggleStatus(session.key, row.siswa_id, status!)} title={`Ubah status: ${shownStatus}`} className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-bold transition-transform hover:scale-110 ${statusClass(shownStatus)}`}>{attendanceStatusCode(shownStatus)}</button> : <span className="text-slate-300">-</span>}</td> })}
        <td className="border-b border-r border-slate-100 px-2 py-2 text-center font-bold text-emerald-700 dark:border-slate-800 dark:text-emerald-300">{row.hadir}</td><td className="border-b border-r border-slate-100 px-2 py-2 text-center font-bold text-amber-700 dark:border-slate-800 dark:text-amber-300">{row.sakit}</td><td className="border-b border-r border-slate-100 px-2 py-2 text-center font-bold text-blue-700 dark:border-slate-800 dark:text-blue-300">{row.izin}</td><td className="border-b border-slate-100 px-2 py-2 text-center font-bold text-rose-700 dark:border-slate-800 dark:text-rose-300">{row.alfa}</td>
      </tr> })}</tbody>
    </table></div>
  </div>
}

function StudentAttendanceDetail({ row }: { row: TeacherAttendanceReport['rows'][number] }) {
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="border-b border-slate-200 p-4 dark:border-slate-800"><p className="text-base font-bold text-slate-800 dark:text-slate-100">{row.nama_lengkap}</p><div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">H {row.hadir}</span><span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">S {row.sakit}</span><span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700">I {row.izin}</span><span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">A {row.alfa}</span></div></div>
    <div className="grid grid-cols-1 gap-2 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3 dark:bg-slate-950/40">{[...row.sessions].reverse().map(item => <div key={item.session_key} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">{formatDate(item.tanggal)}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass(item.status)}`}>{attendanceStatusCode(item.status)}</span></div>{item.catatan && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{item.catatan}</p>}</div>)}</div>
  </div>
}
