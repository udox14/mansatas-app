/* eslint-disable @next/next/no-img-element -- Print copies the same raw images into an independent document. */
'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  Search, Loader2, Calendar, BarChart3, Printer, ShieldCheck, History,
  ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertTriangle, XCircle,
  PlusCircle, Edit3, FileText, Check, AlertCircle, Eye, EyeOff
} from 'lucide-react'
import { PbDetails } from '@/components/pramubakti/report-details'
import { summarizePb, PB_DAYS, type PbItem } from '@/lib/pramubakti'
import { teacherPerformance } from '@/lib/teacher-leave'
import { todayWIB } from '@/lib/time'
import { getPramubaktiMonitoring, setPramubaktiLeave, correctPramubaktiReport } from './actions'

type Data = Awaited<ReturnType<typeof getPramubaktiMonitoring>>

export function PramubaktiMonitoringClient({ initialData }: { initialData: Data }) {
  const [data, setData] = useState(initialData)
  const [start, setStart] = useState(todayWIB())
  const [end, setEnd] = useState(todayWIB())
  const [loaded, setLoaded] = useState({ start, end })
  const [period, setPeriod] = useState<'hari' | 'bulan' | 'semester' | 'tahun' | 'rentang'>('hari')
  const [month, setMonth] = useState(todayWIB().slice(0, 7))
  const [academicYear, setAcademicYear] = useState(
    data.years[0]?.nama || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`
  )
  const [semester, setSemester] = useState<'ganjil' | 'genap'>('ganjil')
  const [userId, setUserId] = useState('')
  const [status, setStatus] = useState('')
  const [slotId, setSlotId] = useState('')
  const [kind, setKind] = useState('')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Print controls
  const [excused, setExcused] = useState(false)
  const [sort, setSort] = useState<'nama' | 'performa' | 'alfa'>('nama')
  const [excluded, setExcluded] = useState<string[]>([])
  const [isPreviewLoaded, setIsPreviewLoaded] = useState(false)

  // Leave controls
  const [leave, setLeave] = useState({
    userId: '',
    start: todayWIB(),
    end: todayWIB(),
    status: 'SAKIT' as 'SAKIT' | 'IZIN' | 'BATAL',
    reasonId: '',
    note: '',
    overrideReport: false,
    slotIds: [] as string[],
  })

  // Report correction modal
  const [correction, setCorrection] = useState<PbItem | null>(null)
  const [edit, setEdit] = useState({
    jobs: '',
    tempat: '',
    status: 'TEPAT_WAKTU' as 'TEPAT_WAKTU' | 'TELAT' | 'TAMBAHAN',
    reason: '',
  })

  const printRef = useRef<HTMLDivElement>(null)
  const members = [...new Map(data.members.map(m => [m.user_id, m])).values()]
  const allSlots = data.versions.flatMap(v => v.slots.map(s => ({ ...s, effective_date: v.effective_date })))

  const filtered = data.items.filter(
    i => (!userId || userId === 'ALL_USERS' || i.user_id === userId) &&
         (!status || status === 'ALL_STATUS' || i.status === status) &&
         (!slotId || slotId === 'ALL_SLOTS' || i.slot?.id === slotId) &&
         (!kind || kind === 'ALL_KINDS' || (kind === 'tambahan' ? i.status === 'TAMBAHAN' : i.status !== 'TAMBAHAN')) &&
         (!attentionOnly || (i.status === 'BELUM' || i.status === 'TELAT' || i.status === 'ALFA'))
  )
  const printed = filtered.filter(i => !excluded.includes(i.user_id))
  const stale = start !== loaded.start || end !== loaded.end
  const summary = summarizePb(filtered)

  const printMembers = members
    .filter(m => printed.some(i => i.user_id === m.user_id))
    .sort((a, b) => {
      const sa = summarizePb(printed.filter(i => i.user_id === a.user_id))
      const sb = summarizePb(printed.filter(i => i.user_id === b.user_id))
      return sort === 'performa'
        ? teacherPerformance(sb, excused) - teacherPerformance(sa, excused)
        : sort === 'alfa'
        ? sb.alfa - sa.alfa
        : a.nama_lengkap.localeCompare(b.nama_lengkap, 'id')
    })

  const navigateDate = (offset: number) => {
    const d = new Date(start + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    const newDate = d.toISOString().split('T')[0]
    setStart(newDate)
    setEnd(newDate)
  }

  async function load() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await getPramubaktiMonitoring(start, end)
      setData(result)
      setLoaded({ start, end })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Gagal memuat data.' })
    } finally {
      setBusy(false)
    }
  }

  function handlePeriodChange(newPeriod: typeof period) {
    setPeriod(newPeriod)
    const year = Number(academicYear.match(/\d{4}/)?.[0]) || new Date().getFullYear()
    if (newPeriod === 'hari') {
      setEnd(start)
    } else if (newPeriod === 'bulan') {
      const [y, m] = month.split('-')
      const lastDay = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate()
      setStart(`${month}-01`)
      setEnd(`${month}-${String(lastDay).padStart(2, '0')}`)
    } else if (newPeriod === 'semester') {
      setStart(semester === 'ganjil' ? `${year}-07-01` : `${year + 1}-01-01`)
      setEnd(semester === 'ganjil' ? `${year}-12-31` : `${year + 1}-06-30`)
    } else if (newPeriod === 'tahun') {
      setStart(`${year}-07-01`)
      setEnd(`${year + 1}-06-30`)
    }
  }

  function applyMonth(m: string) {
    setMonth(m)
    const [y, mm] = m.split('-')
    const lastDay = new Date(Date.UTC(Number(y), Number(mm), 0)).getUTCDate()
    setStart(`${m}-01`)
    setEnd(`${m}-${String(lastDay).padStart(2, '0')}`)
  }

  function applyAcademicYear(ay: string, sem: typeof semester) {
    setAcademicYear(ay)
    const year = Number(ay.match(/\d{4}/)?.[0]) || new Date().getFullYear()
    if (period === 'semester') {
      setStart(sem === 'ganjil' ? `${year}-07-01` : `${year + 1}-01-01`)
      setEnd(sem === 'ganjil' ? `${year}-12-31` : `${year + 1}-06-30`)
    } else if (period === 'tahun') {
      setStart(`${year}-07-01`)
      setEnd(`${year + 1}-06-30`)
    }
  }

  async function changeLeave() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await setPramubaktiLeave({
        ...leave,
        reasonId: leave.reasonId || null,
      })
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: result.success || 'Perubahan izin/sakit berhasil disimpan.' })
        setData(await getPramubaktiMonitoring(loaded.start, loaded.end))
      }
    } catch {
      setMessage({ type: 'error', text: 'Perubahan izin/sakit gagal.' })
    } finally {
      setBusy(false)
    }
  }

  async function print() {
    if (!isPreviewLoaded) {
      setIsPreviewLoaded(true)
      await new Promise(r => setTimeout(r, 250))
    }
    const el = printRef.current
    if (!el) return
    const win = window.open('', '_blank')
    if (!win) {
      setMessage({ type: 'error', text: 'Izinkan pop-up / jendela cetak pada browser.' })
      return
    }
    win.document.write(
      `<!doctype html><html><head><title>Laporan Kehadiran Pramubakti - MAN 1 Tasikmalaya</title><base href="${window.location.origin}/"><style>@page{size:215mm 330mm;margin:8mm 8mm 10mm}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}*{box-sizing:border-box}.print-page{width:100%!important;min-height:310mm!important;margin:0!important;padding:0!important;box-shadow:none!important;border:none!important;page-break-after:always;break-after:page;box-sizing:border-box}.print-page:last-child{page-break-after:auto;break-after:auto}.cover-page{display:flex;flex-direction:column;justify-content:space-between;align-items:center;text-align:center}.screen-page-indicator{display:none!important}table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid #666;padding:5px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere;font-size:8.5pt}th{background:#f1f5f9;font-weight:bold}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}.kop{width:100%;margin-bottom:8px;display:block}.muted{font-size:8pt;color:#555}.footer{margin-top:15px;font-size:8pt;color:#666}</style></head><body>${el.innerHTML}</body></html>`
    )
    win.document.close()
    const images = Array.from(win.document.images)
    await Promise.all(
      images.map(img =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>(resolve => {
              img.onload = () => resolve()
              img.onerror = () => resolve()
              window.setTimeout(resolve, 8000)
            })
      )
    )
    win.focus()
    win.print()
  }

  function beginCorrection(item: PbItem) {
    if (!item.report) return
    setCorrection(item)
    setEdit({
      jobs: item.report.jobs.join('\n'),
      tempat: item.report.tempat,
      status: item.report.status,
      reason: '',
    })
  }

  return (
    <div className="space-y-4">
      {/* FILTER SECTION (Identik dengan Monitoring Agenda Guru) */}
      <div className="rounded-lg border bg-white dark:bg-slate-900 p-3 sm:p-4 space-y-3 shadow-sm">
        {/* Date navigation bar */}
        {period === 'hari' ? (
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate(-1)}
              className="h-9 w-9 p-0"
              title="Hari sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={start}
              onChange={e => {
                setStart(e.target.value)
                setEnd(e.target.value)
              }}
              className="h-9 min-w-0 text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate(1)}
              className="h-9 w-9 p-0"
              title="Hari berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStart(todayWIB())
                setEnd(todayWIB())
              }}
              className="h-9 px-2.5 text-xs sm:px-3 font-medium"
            >
              Hari Ini
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {period === 'bulan' && (
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs text-slate-500 dark:text-slate-400">Pilih Bulan</Label>
                <Input
                  type="month"
                  value={month}
                  onChange={e => applyMonth(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            )}

            {['semester', 'tahun'].includes(period) && (
              <div className="flex-1 min-w-[160px]">
                <Label className="text-xs text-slate-500 dark:text-slate-400">Tahun Ajaran</Label>
                <Select
                  value={academicYear}
                  onValueChange={v => applyAcademicYear(v, semester)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {data.years.map(y => (
                      <SelectItem key={y.id} value={y.nama}>
                        {y.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {period === 'semester' && (
              <div className="w-36">
                <Label className="text-xs text-slate-500 dark:text-slate-400">Semester</Label>
                <Select
                  value={semester}
                  onValueChange={v => {
                    const nextSem = v as typeof semester
                    setSemester(nextSem)
                    applyAcademicYear(academicYear, nextSem)
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ganjil">Ganjil</SelectItem>
                    <SelectItem value="genap">Genap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {period === 'rentang' && (
              <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Dari Tanggal</Label>
                  <Input
                    type="date"
                    value={start}
                    onChange={e => setStart(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">Sampai Tanggal</Label>
                  <Input
                    type="date"
                    value={end}
                    onChange={e => setEnd(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filter Controls Row */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2.5">
          <div className="min-w-0 sm:w-36">
            <Label className="text-xs text-slate-500 dark:text-slate-400">Periode</Label>
            <Select
              value={period}
              onValueChange={v => handlePeriodChange(v as typeof period)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hari">Per Hari</SelectItem>
                <SelectItem value="bulan">Per Bulan</SelectItem>
                <SelectItem value="semester">Per Semester</SelectItem>
                <SelectItem value="tahun">Per Tahun Ajaran</SelectItem>
                <SelectItem value="rentang">Rentang Tanggal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 sm:flex-1 sm:min-w-[170px]">
            <Label className="text-xs text-slate-500 dark:text-slate-400">Pramubakti</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Semua Pramubakti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_USERS">Semua Pramubakti</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.nama_lengkap}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 sm:w-36">
            <Label className="text-xs text-slate-500 dark:text-slate-400">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_STATUS">Semua Status</SelectItem>
                <SelectItem value="TEPAT_WAKTU">Tepat Waktu</SelectItem>
                <SelectItem value="TELAT">Telat</SelectItem>
                <SelectItem value="SAKIT">Sakit</SelectItem>
                <SelectItem value="IZIN">Izin</SelectItem>
                <SelectItem value="ALFA">Alfa</SelectItem>
                <SelectItem value="BELUM">Belum Selesai</SelectItem>
                <SelectItem value="TAMBAHAN">Tambahan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 sm:w-36">
            <Label className="text-xs text-slate-500 dark:text-slate-400">Jenis Laporan</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Wajib & Tambahan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_KINDS">Wajib & Tambahan</SelectItem>
                <SelectItem value="wajib">Hanya Wajib</SelectItem>
                <SelectItem value="tambahan">Hanya Tambahan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {allSlots.length > 0 && (
            <div className="min-w-0 sm:w-56">
              <Label className="text-xs text-slate-500 dark:text-slate-400">Slot Jam</Label>
              <Select value={slotId} onValueChange={setSlotId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Semua Slot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_SLOTS">Semua Slot</SelectItem>
                  {allSlots.map(s => (
                    <SelectItem key={`${s.id}-${s.effective_date}`} value={s.id}>
                      {PB_DAYS[s.weekday] || `Hari ${s.weekday}`}: {s.start}–{s.end}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={load}
            disabled={busy}
            size="sm"
            className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors"
          >
            {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
            Tampilkan
          </Button>

          <Button
            type="button"
            variant={attentionOnly ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => setAttentionOnly(prev => !prev)}
            className={`h-9 px-3 text-xs font-medium transition-all ${
              attentionOnly
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                : 'text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            {attentionOnly ? 'Perlu Perhatian (Aktif)' : 'Perlu Perhatian'}
          </Button>
        </div>

        {stale && (
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5 pt-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Rentang tanggal diubah ({start} s/d {end}). Klik tombol <strong>Tampilkan</strong> untuk memperbarui data.
          </p>
        )}
      </div>

      {/* Alert Messages */}
      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2.5 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* RINGKASAN STATISTIK & KPI (ACCORDION SHADCN) */}
      <Accordion type="single" collapsible defaultValue="kpi-cards" className="w-full">
        <AccordionItem value="kpi-cards" className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <AccordionTrigger className="py-3 px-4 hover:no-underline hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
            <div className="flex flex-wrap items-center justify-between w-full pr-2 gap-2 text-left">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                      Ringkasan Statistik & KPI Monitoring
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      ({summary.total} slot dinilai)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Buka untuk melihat rincian performa, kehadiran, dan filter cepat
                  </p>
                </div>
              </div>

              {/* Quick glance pill badges on header */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                  Performa: {summary.performance === null ? '—' : `${summary.performance}%`}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 text-[11px]">
                  <CheckCircle2 className="h-3 w-3" /> {summary.hadir}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 text-[11px]">
                  <Clock className="h-3 w-3" /> {summary.telat}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60 text-[11px]">
                  <AlertTriangle className="h-3 w-3" /> {summary.izin + summary.sakit}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60 text-[11px]">
                  <XCircle className="h-3 w-3" /> {summary.alfa}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60 text-[11px]">
                  <PlusCircle className="h-3 w-3" /> {summary.tambahan}
                </span>
              </div>
            </div>
          </AccordionTrigger>

          <AccordionContent className="p-3.5 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
              {/* Card 1: Performa */}
              <div
                onClick={() => { setStatus(''); setKind('') }}
                className={`rounded-lg border bg-white dark:bg-slate-900 p-3.5 shadow-sm transition-all cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md ${
                  !status && !kind ? 'ring-2 ring-indigo-500/40' : ''
                }`}
                title="Klik untuk melihat semua data"
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tingkat Performa</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                  {summary.performance === null ? '—' : `${summary.performance}%`}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{summary.total} slot wajib dinilai</p>
              </div>

              {/* Card 2: Hadir */}
              <div
                onClick={() => { setStatus(status === 'TEPAT_WAKTU' ? '' : 'TEPAT_WAKTU'); setKind('') }}
                className={`rounded-lg border bg-white dark:bg-slate-900 p-3.5 shadow-sm border-l-4 border-l-emerald-500 transition-all cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md ${
                  status === 'TEPAT_WAKTU' ? 'ring-2 ring-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/20' : ''
                }`}
                title="Klik untuk memfilter status Hadir / Tepat Waktu"
              >
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Hadir
                </p>
                <p className="text-xl sm:text-2xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                  {summary.hadir}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Tepat waktu & telat</p>
              </div>

              {/* Card 3: Telat */}
              <div
                onClick={() => { setStatus(status === 'TELAT' ? '' : 'TELAT'); setKind('') }}
                className={`rounded-lg border bg-white dark:bg-slate-900 p-3.5 shadow-sm border-l-4 border-l-amber-500 transition-all cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md ${
                  status === 'TELAT' ? 'ring-2 ring-amber-500/50 bg-amber-50/20 dark:bg-amber-950/20' : ''
                }`}
                title="Klik untuk memfilter status Telat"
              >
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Telat
                </p>
                <p className="text-xl sm:text-2xl font-bold text-amber-800 dark:text-amber-200 mt-1">
                  {summary.telat}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Melewati batas waktu</p>
              </div>

              {/* Card 4: Izin / Sakit */}
              <div
                onClick={() => { setStatus(status === 'IZIN' ? '' : 'IZIN'); setKind('') }}
                className={`rounded-lg border bg-white dark:bg-slate-900 p-3.5 shadow-sm border-l-4 border-l-sky-500 transition-all cursor-pointer hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md ${
                  status === 'IZIN' || status === 'SAKIT' ? 'ring-2 ring-sky-500/50 bg-sky-50/20 dark:bg-sky-950/20' : ''
                }`}
                title="Klik untuk memfilter status Izin / Sakit"
              >
                <p className="text-xs font-medium text-sky-700 dark:text-sky-400 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Izin / Sakit
                </p>
                <p className="text-xl sm:text-2xl font-bold text-sky-800 dark:text-sky-200 mt-1">
                  {summary.izin + summary.sakit}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {summary.sakit} sakit, {summary.izin} izin
                </p>
              </div>

              {/* Card 5: Alfa */}
              <div
                onClick={() => { setStatus(status === 'ALFA' ? '' : 'ALFA'); setKind('') }}
                className={`rounded-lg border bg-white dark:bg-slate-900 p-3.5 shadow-sm border-l-4 border-l-rose-500 transition-all cursor-pointer hover:border-rose-300 dark:hover:border-rose-700 hover:shadow-md ${
                  status === 'ALFA' ? 'ring-2 ring-rose-500/50 bg-rose-50/20 dark:bg-rose-950/20' : ''
                }`}
                title="Klik untuk memfilter status Alfa"
              >
                <p className="text-xs font-medium text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5" /> Alfa
                </p>
                <p className="text-xl sm:text-2xl font-bold text-rose-800 dark:text-rose-200 mt-1">
                  {summary.alfa}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Tanpa keterangan</p>
              </div>

              {/* Card 6: Tambahan */}
              <div
                onClick={() => { setKind(kind === 'tambahan' ? '' : 'tambahan'); setStatus('') }}
                className={`rounded-lg border bg-white dark:bg-slate-900 p-3.5 shadow-sm border-l-4 border-l-purple-500 transition-all cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md ${
                  kind === 'tambahan' ? 'ring-2 ring-purple-500/50 bg-purple-50/20 dark:bg-purple-950/20' : ''
                }`}
                title="Klik untuk memfilter laporan Tambahan"
              >
                <p className="text-xs font-medium text-purple-700 dark:text-purple-400 flex items-center gap-1">
                  <PlusCircle className="h-3.5 w-3.5" /> Tambahan
                </p>
                <p className="text-xl sm:text-2xl font-bold text-purple-800 dark:text-purple-200 mt-1">
                  {summary.tambahan}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Laporan ekstra</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* TABS UTAMA */}
      <Tabs defaultValue="harian" className="space-y-3">
        <TabsList className={`grid w-full ${data.canManage ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-3 sm:grid-cols-4'} max-w-3xl h-auto p-1`}>
          <TabsTrigger value="harian" className="text-xs sm:text-sm py-2">
            <Calendar className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Harian
          </TabsTrigger>
          <TabsTrigger value="rekap" className="text-xs sm:text-sm py-2">
            <BarChart3 className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Rekap
          </TabsTrigger>
          <TabsTrigger value="cetak" className="text-xs sm:text-sm py-2">
            <Printer className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Cetak
          </TabsTrigger>
          {data.canManage && (
            <TabsTrigger value="izin" className="text-xs sm:text-sm py-2">
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
              Kelola Izin
            </TabsTrigger>
          )}
          <TabsTrigger value="audit" className="text-xs sm:text-sm py-2">
            <History className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: HARIAN */}
        <TabsContent value="harian" className="space-y-3 mt-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
              Menampilkan {filtered.length} blok laporan untuk periode <strong>{loaded.start}</strong> s/d <strong>{loaded.end}</strong>
            </p>
          </div>
          <PbDetails items={filtered} onCorrect={data.canManage ? beginCorrection : undefined} />
        </TabsContent>

        {/* TAB 2: REKAP */}
        <TabsContent value="rekap" className="space-y-3 mt-3">
          <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Rekapitulasi Kehadiran & Pekerjaan</h3>
                <p className="text-xs text-slate-500">Periode data: {loaded.start} s/d {loaded.end}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Nama Pegawai</TableHead>
                    <TableHead className="font-semibold text-center">Wajib Dinilai</TableHead>
                    <TableHead className="font-semibold text-center">Hadir</TableHead>
                    <TableHead className="font-semibold text-center">Telat</TableHead>
                    <TableHead className="font-semibold text-center">Sakit</TableHead>
                    <TableHead className="font-semibold text-center">Izin Biasa</TableHead>
                    <TableHead className="font-semibold text-center">Izin Sekolah</TableHead>
                    <TableHead className="font-semibold text-center">Alfa</TableHead>
                    <TableHead className="font-semibold text-center">Tambahan</TableHead>
                    <TableHead className="font-semibold text-center">Performa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members
                    .filter(m => !userId || userId === 'ALL_USERS' || m.user_id === userId)
                    .map(m => {
                      const s = summarizePb(filtered.filter(i => i.user_id === m.user_id))
                      const perf = s.performance
                      const perfBadgeClass =
                        perf === null
                          ? 'bg-slate-100 text-slate-600'
                          : perf >= 90
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : perf >= 75
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'

                      return (
                        <TableRow key={m.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                            {m.nama_lengkap}
                          </TableCell>
                          <TableCell className="text-center">{s.total}</TableCell>
                          <TableCell className="text-center text-emerald-600 dark:text-emerald-400 font-medium">
                            {s.hadir}
                          </TableCell>
                          <TableCell className="text-center text-amber-600 dark:text-amber-400">
                            {s.telat}
                          </TableCell>
                          <TableCell className="text-center text-blue-600 dark:text-blue-400">
                            {s.sakit}
                          </TableCell>
                          <TableCell className="text-center text-sky-600 dark:text-sky-400">
                            {s.izin - s.izinSekolah}
                          </TableCell>
                          <TableCell className="text-center text-emerald-600 dark:text-emerald-400">
                            {s.izinSekolah}
                          </TableCell>
                          <TableCell className="text-center text-rose-600 dark:text-rose-400 font-medium">
                            {s.alfa}
                          </TableCell>
                          <TableCell className="text-center text-purple-600 dark:text-purple-400">
                            {s.tambahan}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${perfBadgeClass}`}>
                              {perf === null ? '—' : `${perf}%`}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: CETAK */}
        <TabsContent value="cetak" className="space-y-4 mt-3">
          <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[240px]">
                <Label className="text-xs text-slate-500 dark:text-slate-400">Kebijakan Performa Cetak</Label>
                <Select
                  value={excused ? 'full' : 'default'}
                  onValueChange={v => setExcused(v === 'full')}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Sakit dan izin biasa mengurangi performa</SelectItem>
                    <SelectItem value="full">Sakit dan izin biasa tidak mengurangi performa (kredit penuh)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-48">
                <Label className="text-xs text-slate-500 dark:text-slate-400">Urutan Data Cetak</Label>
                <Select value={sort} onValueChange={v => setSort(v as typeof sort)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nama">Nama A–Z</SelectItem>
                    <SelectItem value="performa">Performa Tertinggi</SelectItem>
                    <SelectItem value="alfa">Alfa Terbanyak</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                onClick={() => setIsPreviewLoaded(prev => !prev)}
                className="h-9 font-medium shadow-sm transition-colors text-xs"
              >
                {isPreviewLoaded ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-1.5 text-slate-500" />
                    Sembunyikan Pratinjau
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-1.5 text-indigo-600" />
                    Muat Pratinjau
                  </>
                )}
              </Button>

              <Button
                disabled={busy || stale || !printed.length}
                onClick={print}
                className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors text-xs"
              >
                <Printer className="h-4 w-4 mr-1.5" />
                Cetak / Simpan PDF
              </Button>
            </div>

            {/* Pengecualian Pegawai */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Pengecualian Pegawai dari Cetakan (centang untuk mengecualikan):
              </p>
              <div className="flex flex-wrap gap-2">
                {members.map(m => {
                  const isEx = excluded.includes(m.user_id)
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() =>
                        setExcluded(old =>
                          isEx ? old.filter(id => id !== m.user_id) : [...old, m.user_id]
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        isEx
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 line-through'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {m.nama_lengkap}
                    </button>
                  )
                })}
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              * Cetakan mengikuti seluruh filter aktif. Rincian tanggal yang sama digabung otomatis. Laporan tambahan tidak dihitung dalam penyebut persentase.
            </p>
          </div>

          {/* PRATINJAU DOKUMEN CETAK (LAZY LOAD & COVER TERPISAH) */}
          {!isPreviewLoaded ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-8 sm:p-12 text-center shadow-sm">
              <div className="mx-auto w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 ring-8 ring-indigo-50/50 dark:ring-indigo-950/30">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Pratinjau Dokumen Belum Dimuat
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1.5 mb-6 leading-relaxed">
                Dokumen cetak menggunakan <strong>Lazy Load</strong> agar performa halaman tetap ringan dan cepat. Klik tombol di bawah untuk melihat pratinjau lengkap dengan Halaman Sampul (Cover) terpisah.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  onClick={() => setIsPreviewLoaded(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 font-medium shadow-sm transition-colors"
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  Muat Pratinjau Dokumen
                </Button>
                <Button
                  variant="outline"
                  onClick={print}
                  disabled={busy || stale || !printed.length}
                  className="text-xs h-9 font-medium"
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  Langsung Cetak / Simpan PDF
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950 p-4 sm:p-6">
              <div ref={printRef} className="flex flex-col items-center gap-8 py-2">
                {/* HALAMAN 1: COVER / SAMPUL (Halaman Terpisah) */}
                <div className="w-full max-w-[215mm] mx-auto">
                  <div className="screen-page-indicator flex items-center justify-between text-xs font-semibold text-slate-500 mb-2 px-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                      Halaman 1: Sampul / Cover Laporan
                    </span>
                    <span className="text-[11px] bg-slate-200 dark:bg-slate-800 px-2.5 py-0.5 rounded-full text-slate-600 dark:text-slate-300 font-medium">
                      Halaman Terpisah
                    </span>
                  </div>

                  <section
                    className="print-page cover-page bg-white text-black shadow-xl rounded-xl border border-slate-200 overflow-hidden w-full"
                    style={{ minHeight: '305mm', boxSizing: 'border-box' }}
                  >
                    <div
                      className="cover-frame w-full h-full p-8 sm:p-12 flex flex-col items-center justify-between text-center"
                      style={{
                        minHeight: '305mm',
                        border: '1.7pt solid #b38b2e',
                        outline: '0.7pt solid #166534',
                        outlineOffset: '-6pt',
                        background: 'linear-gradient(180deg, #f8faf7 0%, #ffffff 50%, #f7f2e5 100%)',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ width: '100%', height: '7pt', background: '#166534', borderBottom: '2pt solid #d4af37' }} />

                      <div className="my-auto py-8">
                        <img
                          src="/logokemenag.png"
                          alt="Logo Kementerian Agama"
                          style={{ width: '42mm', height: '42mm', objectFit: 'contain', display: 'block', margin: '0 auto 20px' }}
                        />
                        <div style={{ color: '#166534', fontSize: '11pt', fontWeight: 700, letterSpacing: '2.5pt', marginBottom: '8px' }}>
                          DOKUMEN RESMI MADRASAH
                        </div>
                        <div style={{ width: '48mm', borderTop: '1.5pt solid #d4af37', margin: '0 auto 22px' }} />
                        <h1 style={{ margin: '0 0 14px 0', fontSize: '20pt', lineHeight: 1.4, fontWeight: 800, color: '#163b2d', textTransform: 'uppercase' }}>
                          Laporan Kehadiran & Pekerjaan Pramubakti
                        </h1>
                        <h2 style={{ margin: '0 0 12px 0', fontSize: '14pt', fontWeight: 700, color: '#166534' }}>
                          {data.school.nama_madrasah || data.school.school_name || 'MAN 1 TASIKMALAYA'}
                        </h2>
                        <div style={{ display: 'inline-block', padding: '6px 18px', background: '#eef6f0', border: '1px solid #c7e2cd', borderRadius: '6px', fontSize: '11pt', fontWeight: 600, color: '#1b4d3e', marginTop: '12px' }}>
                          Periode: {loaded.start} s/d {loaded.end}
                        </div>
                      </div>

                      <div style={{ width: '100%' }}>
                        <div style={{ fontSize: '13pt', fontWeight: 700, color: '#163b2d' }}>
                          MADRASAH ALIYAH NEGERI 1 TASIKMALAYA
                        </div>
                        <div style={{ marginTop: '4pt', fontSize: '9.5pt', color: '#475569' }}>
                          Kementerian Agama Republik Indonesia
                        </div>
                        <div style={{ width: '100%', height: '7pt', marginTop: '14mm', background: '#166534', borderTop: '2pt solid #d4af37' }} />
                      </div>
                    </div>
                  </section>
                </div>

                {/* HALAMAN 2: REKAPITULASI UMUM (Halaman Terpisah) */}
                <div className="w-full max-w-[215mm] mx-auto">
                  <div className="screen-page-indicator flex items-center justify-between text-xs font-semibold text-slate-500 mb-2 px-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                      Halaman 2: Rekapitulasi Kinerja Pramubakti
                    </span>
                    <span className="text-[11px] bg-slate-200 dark:bg-slate-800 px-2.5 py-0.5 rounded-full text-slate-600 dark:text-slate-300 font-medium">
                      Halaman Terpisah
                    </span>
                  </div>

                  <section
                    className="print-page bg-white text-black shadow-xl rounded-xl border border-slate-200 p-8 sm:p-10 w-full"
                    style={{ minHeight: '305mm', boxSizing: 'border-box' }}
                  >
                    <img src="/kopsurat.png" alt="Kop Surat" className="kop w-full mb-4" />
                    <h2 className="text-center font-bold text-base mb-1 uppercase tracking-wide text-black">
                      Rekapitulasi Kinerja Pramubakti
                    </h2>
                    <p className="text-center text-xs font-semibold text-slate-700 mb-1">
                      Periode: {loaded.start} s/d {loaded.end}
                    </p>
                    <p className="muted text-[10px] text-slate-500 mb-4 text-center leading-relaxed">
                      Kebijakan: {excused ? 'Sakit & izin biasa memperoleh kredit penuh' : 'Sakit & izin biasa mengurangi performa'}; Izin kepentingan dinas madrasah memperoleh kredit penuh. Telat dihitung hadir.
                    </p>

                    <table className="w-full text-xs border border-collapse border-slate-400">
                      <thead>
                        <tr className="bg-slate-100">
                          {['No', 'Nama Pegawai', 'Wajib Dinilai', 'Hadir', 'Telat', 'Sakit', 'Izin Biasa', 'Izin Dinas', 'Alfa', 'Ekstra', 'Performa'].map(h => (
                            <th key={h} className="border border-slate-400 p-2 text-center font-semibold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {printMembers.map((m, idx) => {
                          const s = summarizePb(printed.filter(i => i.user_id === m.user_id))
                          return (
                            <tr key={m.user_id}>
                              <td className="border border-slate-400 p-2 text-center">{idx + 1}</td>
                              <td className="border border-slate-400 p-2 font-medium text-left">{m.nama_lengkap}</td>
                              <td className="border border-slate-400 p-2 text-center">{s.total}</td>
                              <td className="border border-slate-400 p-2 text-center">{s.hadir}</td>
                              <td className="border border-slate-400 p-2 text-center">{s.telat}</td>
                              <td className="border border-slate-400 p-2 text-center">{s.sakit}</td>
                              <td className="border border-slate-400 p-2 text-center">{s.izin - s.izinSekolah}</td>
                              <td className="border border-slate-400 p-2 text-center">{s.izinSekolah}</td>
                              <td className="border border-slate-400 p-2 text-center">{s.alfa}</td>
                              <td className="border border-slate-400 p-2 text-center">{s.tambahan}</td>
                              <td className="border border-slate-400 p-2 text-center font-bold">
                                {s.total ? `${teacherPerformance(s, excused)}%` : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {/* Titi Mangsa / Tanda Tangan */}
                    <div className="mt-8 flex justify-end">
                      <div className="text-center text-xs w-64 space-y-1">
                        <p>Tasikmalaya, {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())}</p>
                        <p className="font-semibold">Kepala Urusan Tata Usaha / Koordinator,</p>
                        <div className="h-16" />
                        <p className="font-bold underline">___________________________</p>
                        <p className="text-[10px] text-slate-500">NIP. ........................................</p>
                      </div>
                    </div>

                    <p className="footer text-right text-[10px] text-slate-500 mt-6 pt-2 border-t border-slate-200">
                      Dicetak pada {todayWIB()} &middot; Sistem Informasi Madrasah MANSATAS
                    </p>
                  </section>
                </div>

                {/* HALAMAN 3+: RINCIAN TIAP PEGAWAI (Lampiran Terpisah) */}
                {printMembers.map((m, mIdx) => {
                  const rows = printed.filter(i => i.user_id === m.user_id)
                  return (
                    <div key={m.user_id} className="w-full max-w-[215mm] mx-auto">
                      <div className="screen-page-indicator flex items-center justify-between text-xs font-semibold text-slate-500 mb-2 px-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                          Halaman {mIdx + 3}: Lampiran Rincian Pegawai &mdash; {m.nama_lengkap}
                        </span>
                        <span className="text-[11px] bg-slate-200 dark:bg-slate-800 px-2.5 py-0.5 rounded-full text-slate-600 dark:text-slate-300 font-medium">
                          Halaman Terpisah
                        </span>
                      </div>

                      <section
                        className="print-page bg-white text-black shadow-xl rounded-xl border border-slate-200 p-8 sm:p-10 w-full"
                        style={{ minHeight: '305mm', boxSizing: 'border-box' }}
                      >
                        <img className="kop w-full mb-4" src="/kopsurat.png" alt="Kop Surat" />
                        <h3 className="text-center font-bold text-sm uppercase mb-0.5 tracking-wide text-black">
                          Rincian Pekerjaan & Kehadiran Pramubakti
                        </h3>
                        <p className="text-xs text-center font-semibold text-slate-700 mb-0.5">
                          Nama: {m.nama_lengkap}
                        </p>
                        <p className="text-[11px] text-center text-slate-500 mb-3">
                          Periode: {loaded.start} s/d {loaded.end}
                        </p>
                        <table className="w-full text-xs border border-collapse border-slate-400">
                          <thead>
                            <tr className="bg-slate-100">
                              {['Tanggal', 'Slot Jam', 'Status', 'Pekerjaan', 'Lokasi / Keterangan', 'Waktu Input'].map(h => (
                                <th key={h} className="border border-slate-400 p-1.5 font-semibold text-left">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((item, index) => (
                              <tr key={item.key}>
                                {(index === 0 || rows[index - 1].tanggal !== item.tanggal) && (
                                  <td
                                    className="border border-slate-400 p-1.5 font-medium align-top"
                                    rowSpan={rows.filter(i => i.tanggal === item.tanggal).length}
                                  >
                                    {item.tanggal}
                                  </td>
                                )}
                                <td className="border border-slate-400 p-1.5 align-top">
                                  {item.slot ? `${item.slot.start}–${item.slot.end}` : 'Tambahan'}
                                </td>
                                <td className="border border-slate-400 p-1.5 align-top">
                                  {item.status}
                                  {item.leave?.kepentingan_sekolah && ' (Dinas Madrasah)'}
                                </td>
                                <td className="border border-slate-400 p-1.5 align-top">
                                  {item.report?.jobs.join(', ') || '—'}
                                </td>
                                <td className="border border-slate-400 p-1.5 align-top">
                                  {item.report?.tempat}
                                  {item.leave && ` · ${item.leave.reason_name || 'Sakit'}: ${item.leave.note}`}
                                </td>
                                <td className="border border-slate-400 p-1.5 align-top">
                                  {item.report?.waktu_input || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="footer text-right text-[10px] text-slate-500 mt-4 pt-2 border-t border-slate-200">
                          Dicetak pada {todayWIB()} &middot; Sistem Informasi Madrasah MANSATAS
                        </p>
                      </section>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 4: KELOLA IZIN & SAKIT (Khusus role wewenang) */}
        {data.canManage && (
          <TabsContent value="izin" className="space-y-4 mt-3">
            <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm space-y-5">
              <div>
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-600" />
                  Pengaturan Izin & Sakit Pramubakti
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tetapkan dispensasi sakit, izin kedinasan, izin pribadi, atau batalkan status izin bagi pegawai pramubakti.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Pegawai Pramubakti *</Label>
                  <Select
                    value={leave.userId}
                    onValueChange={v => setLeave(old => ({ ...old, userId: v }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Pilih Pramubakti..." />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map(m => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.nama_lengkap}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Status Dispensasi *</Label>
                  <Select
                    value={leave.status}
                    onValueChange={v => setLeave(old => ({ ...old, status: v as typeof old.status }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAKIT">Sakit</SelectItem>
                      <SelectItem value="IZIN">Izin</SelectItem>
                      <SelectItem value="BATAL">Batalkan Izin / Sakit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Dari Tanggal *</Label>
                  <Input
                    type="date"
                    value={leave.start}
                    onChange={e => setLeave(old => ({ ...old, start: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Sampai Tanggal *</Label>
                  <Input
                    type="date"
                    value={leave.end}
                    onChange={e => setLeave(old => ({ ...old, end: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {leave.status === 'IZIN' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Alasan Izin *</Label>
                  <Select
                    value={leave.reasonId}
                    onValueChange={v => setLeave(old => ({ ...old, reasonId: v }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Pilih alasan izin..." />
                    </SelectTrigger>
                    <SelectContent>
                      {data.reasons
                        .filter(r => r.aktif)
                        .map(r => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.nama} {r.kepentingan_sekolah ? '— (Dinas Sekolah)' : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Slot Target */}
              <div className="space-y-2 p-3.5 rounded-lg border bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Pilih Slot Jam Tertentu
                  </Label>
                  <span className="text-[11px] text-slate-500">
                    {leave.slotIds.length === 0 ? 'Seluruh slot dalam rentang tanggal terpilih' : `${leave.slotIds.length} slot dipilih`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {allSlots.map(s => {
                    const checked = leave.slotIds.includes(s.id)
                    return (
                      <button
                        type="button"
                        key={`${s.id}-${s.effective_date}`}
                        onClick={() =>
                          setLeave(old => ({
                            ...old,
                            slotIds: checked
                              ? old.slotIds.filter(id => id !== s.id)
                              : [...old.slotIds, s.id],
                          }))
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                          checked
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                        {PB_DAYS[s.weekday] || `Hari ${s.weekday}`}, {s.start}–{s.end}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Catatan / Keterangan */}
              <div className="space-y-1.5">
                <Label className="text-xs">Catatan & Alasan Perubahan (Wajib) *</Label>
                <Input
                  maxLength={1000}
                  placeholder="Masukkan keterangan detail dispensasi..."
                  value={leave.note}
                  onChange={e => setLeave(old => ({ ...old, note: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>

              {/* Konfirmasi Override */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="override-leave"
                  checked={leave.overrideReport}
                  onCheckedChange={v => setLeave(old => ({ ...old, overrideReport: Boolean(v) }))}
                />
                <label
                  htmlFor="override-leave"
                  className="text-xs text-slate-600 dark:text-slate-400 font-medium cursor-pointer"
                >
                  Konfirmasi: Jika sebelumnya sudah ada laporan hadir, ganti status ke izin/sakit (bukti laporan tetap tersimpan).
                </label>
              </div>

              <div className="pt-2">
                <Button
                  disabled={busy || !leave.userId || !leave.note.trim()}
                  onClick={changeLeave}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors"
                >
                  {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1.5" />}
                  Simpan Status Izin
                </Button>
              </div>
            </div>
          </TabsContent>
        )}

        {/* TAB 5: AUDIT LOG */}
        <TabsContent value="audit" className="space-y-3 mt-3">
          <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-slate-50/70 dark:bg-slate-800/50">
              <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                Jejak Perubahan Data (Audit Trail)
              </h3>
              <p className="text-xs text-slate-500">
                Mencatat 100 aktivitas perubahan status, izin, dan koreksi pada rentang tanggal yang dimuat.
              </p>
            </div>
            {data.audit.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">Tidak ada riwayat audit pada periode ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Waktu WIB</TableHead>
                      <TableHead className="font-semibold">Aktor / Pengubah</TableHead>
                      <TableHead className="font-semibold">Aksi</TableHead>
                      <TableHead className="font-semibold">Alasan / Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.audit.map(a => (
                      <TableRow key={a.id} className="text-xs">
                        <TableCell className="text-slate-500 whitespace-nowrap">{a.created_at}</TableCell>
                        <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                          {a.actor_name || 'Sistem'}
                        </TableCell>
                        <TableCell>
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                            {a.action}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">{a.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOG MODAL: KOREKSI LAPORAN */}
      <Dialog open={!!correction} onOpenChange={open => !open && setCorrection(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Koreksi Laporan Pramubakti</DialogTitle>
            <DialogDescription className="text-xs">
              Ubah rincian pekerjaan atau status laporan. Tindakan ini akan dicatat dalam audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Pekerjaan (satu per baris) *</Label>
              <Textarea
                rows={3}
                value={edit.jobs}
                onChange={e => setEdit(old => ({ ...old, jobs: e.target.value }))}
                className="text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tempat / Lokasi *</Label>
              <Input
                maxLength={300}
                value={edit.tempat}
                onChange={e => setEdit(old => ({ ...old, tempat: e.target.value }))}
                className="text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Status Laporan *</Label>
              <Select
                value={edit.status}
                onValueChange={v => setEdit(old => ({ ...old, status: v as typeof old.status }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {correction?.report?.slot_id ? (
                    <>
                      <SelectItem value="TEPAT_WAKTU">Tepat Waktu</SelectItem>
                      <SelectItem value="TELAT">Telat</SelectItem>
                    </>
                  ) : (
                    <SelectItem value="TAMBAHAN">Tambahan</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Alasan Koreksi (Wajib) *</Label>
              <Input
                placeholder="Alasan koreksi laporan..."
                maxLength={500}
                value={edit.reason}
                onChange={e => setEdit(old => ({ ...old, reason: e.target.value }))}
                className="text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setCorrection(null)}>
              Batal
            </Button>
            <Button
              size="sm"
              disabled={busy || !edit.reason.trim() || !edit.jobs.trim() || !edit.tempat.trim()}
              onClick={async () => {
                if (!correction?.report) return
                setBusy(true)
                try {
                  const result = await correctPramubaktiReport({
                    id: correction.report.id,
                    revision: correction.report.revision,
                    jobs: edit.jobs.split('\n').filter(j => j.trim()),
                    tempat: edit.tempat,
                    status: edit.status,
                    reason: edit.reason,
                  })
                  if (result.error) {
                    setMessage({ type: 'error', text: result.error })
                  } else {
                    setMessage({ type: 'success', text: result.success || 'Koreksi berhasil disimpan.' })
                    setCorrection(null)
                    setData(await getPramubaktiMonitoring(loaded.start, loaded.end))
                  }
                } catch {
                  setMessage({ type: 'error', text: 'Koreksi laporan gagal.' })
                } finally {
                  setBusy(false)
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Edit3 className="h-4 w-4 mr-1.5" />}
              Simpan Koreksi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
