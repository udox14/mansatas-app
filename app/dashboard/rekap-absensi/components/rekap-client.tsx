// Lokasi: app/dashboard/rekap-absensi/components/rekap-client.tsx
'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft, ChevronDown, ChevronRight, Clock,
  Loader2, Printer, Search, User, Users,
} from 'lucide-react'
import {
  getAbsensiHeatmap,
  getAbsensiPerKelas,
  getAbsensiPerKelasRentang,
  getAbsensiSiswaKelasHarian,
  getAbsensiSiswaKelasRentang,
  getCetakRekapKelas,
  getCetakRekapSiswa,
  getSiswaByKelas,
} from '../actions'
import { todayWIB, nowWIB, formatTimeWIB } from '@/lib/time'

type FilterOpt = {
  angkatan: number[]
  kelas: Array<{ id: string; tingkat: number; label: string; wali_kelas_nama?: string | null }>
  siswa: any[]
}

type Mode = 'hari' | 'rentang'
type TabValue = 'kelas' | 'siswa' | 'jam' | 'cetak'

interface Props {
  filterOptions: FilterOpt
}

const ST: Record<string, { label: string; cls: string; dot: string; short: string }> = {
  HADIR: { label: 'Hadir', short: 'H', dot: 'bg-emerald-500', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800' },
  SAKIT: { label: 'Sakit', short: 'S', dot: 'bg-amber-500', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  IZIN: { label: 'Izin', short: 'I', dot: 'bg-blue-500', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  ALFA: { label: 'Alfa', short: 'A', dot: 'bg-red-500', cls: 'bg-red-50 text-red-700 border-red-200' },
  BOLOS: { label: 'Bolos sebagian jam', short: 'B', dot: 'bg-yellow-500', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  PARSIAL: { label: 'Bolos sebagian jam', short: 'B', dot: 'bg-yellow-500', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  'PERLU KONFIRMASI WALI': { label: 'Perlu keputusan wali kelas', short: 'W', dot: 'bg-purple-500', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  PERLU_KONFIRMASI_WALI: { label: 'Perlu keputusan wali kelas', short: 'W', dot: 'bg-purple-500', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  BELUM_ADA_DATA: { label: 'Belum lengkap', short: 'BL', dot: 'bg-slate-400', cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  '-': { label: '-', short: '-', dot: 'bg-slate-300', cls: 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-800' },
}

function today() {
  return todayWIB()
}

function monthStart() {
  const d = nowWIB()
  d.setUTCDate(1)
  return d.toISOString().split('T')[0]
}

function fmtTgl(t: string) {
  if (!t) return '-'
  return new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTglFull(t: string) {
  if (!t) return '-'
  return new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function shiftDateISO(isoDate: string, offsetDays: number) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + offsetDays)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function statusStyle(status: string) {
  return ST[status] || ST.BELUM_ADA_DATA
}

function StatusBadge({ status }: { status: string }) {
  const s = statusStyle(status)
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>{s.label}</span>
}

function StatusDot({ status }: { status: string }) {
  const s = statusStyle(status)
  return (
    <span title={s.label} className={`inline-flex min-w-8 items-center justify-center rounded-md border px-1.5 py-1 text-[10px] font-bold ${s.cls}`}>
      {s.short}
    </span>
  )
}

function ModeSwitch({ mode, setMode }: { mode: Mode; setMode: (mode: Mode) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-white p-0.5 dark:bg-slate-900">
      {([
        ['hari', 'Per Hari'],
        ['rentang', 'Rentang Tanggal'],
      ] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setMode(value)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === value ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function AngkatanSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: number[] }) {
  return (
    <div>
      <Label className="text-xs text-slate-500">Angkatan</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 h-9 w-[150px] text-sm"><SelectValue placeholder="Pilih angkatan" /></SelectTrigger>
        <SelectContent>
          {options.map(tingkat => <SelectItem key={tingkat} value={String(tingkat)}>Kelas {tingkat}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function KelasSelect({ value, onChange, kelas }: { value: string; onChange: (v: string) => void; kelas: FilterOpt['kelas'] }) {
  return (
    <div>
      <Label className="text-xs text-slate-500">Kelas</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 h-9 min-w-[180px] text-sm"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
        <SelectContent>
          {kelas.map(k => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function SummaryChips({ item }: { item: any }) {
  const chips = [
    ['Hadir', item.hadir, 'text-emerald-700 bg-emerald-50 border-emerald-200'],
    ['Sakit', item.sakit, 'text-amber-700 bg-amber-50 border-amber-200'],
    ['Izin', item.izin, 'text-blue-700 bg-blue-50 border-blue-200'],
    ['Alfa', item.alfa, 'text-red-700 bg-red-50 border-red-200'],
    ['Bolos sebagian jam', item.bolos, 'text-yellow-700 bg-yellow-50 border-yellow-200'],
    ['Perlu keputusan wali kelas', item.perlu_konfirmasi_wali, 'text-purple-700 bg-purple-50 border-purple-200'],
    ['Belum lengkap', item.belum_ada_data, 'text-slate-600 bg-slate-100 border-slate-200'],
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(([label, value, cls]) => (
        Number(value) > 0 ? (
          <span key={label as string} className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
            {label}: {value}
          </span>
        ) : null
      ))}
    </div>
  )
}

export function RekapAbsensiClient({ filterOptions }: Props) {
  const initialTingkat = String(filterOptions.angkatan?.[0] || 10)
  const [activeTab, setActiveTab] = useState<TabValue>('kelas')
  const [jumpToSiswa, setJumpToSiswa] = useState<any>(null)

  const goToSiswaFromKelas = (payload: any) => {
    setJumpToSiswa(payload)
    setActiveTab('siswa')
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="space-y-3">
      <TabsList className="grid w-full grid-cols-4 max-w-xl">
        <TabsTrigger value="kelas" className="text-xs sm:text-sm"><Users className="mr-1 hidden h-3.5 w-3.5 sm:inline" />Per Kelas</TabsTrigger>
        <TabsTrigger value="siswa" className="text-xs sm:text-sm"><User className="mr-1 hidden h-3.5 w-3.5 sm:inline" />Per Siswa</TabsTrigger>
        <TabsTrigger value="jam" className="text-xs sm:text-sm"><Clock className="mr-1 hidden h-3.5 w-3.5 sm:inline" />Per Jam</TabsTrigger>
        <TabsTrigger value="cetak" className="text-xs sm:text-sm"><Printer className="mr-1 hidden h-3.5 w-3.5 sm:inline" />Cetak</TabsTrigger>
      </TabsList>

      <TabsContent value="kelas"><TabKelas filterOptions={filterOptions} initialTingkat={initialTingkat} onOpenKelas={goToSiswaFromKelas} /></TabsContent>
      <TabsContent value="siswa"><TabSiswa filterOptions={filterOptions} initialJump={jumpToSiswa} onBack={() => setActiveTab('kelas')} /></TabsContent>
      <TabsContent value="jam"><TabJam filterOptions={filterOptions} initialTingkat={initialTingkat} /></TabsContent>
      <TabsContent value="cetak"><TabCetak filterOptions={filterOptions} initialTingkat={initialTingkat} /></TabsContent>
    </Tabs>
  )
}

function TabKelas({ filterOptions, initialTingkat, onOpenKelas }: {
  filterOptions: FilterOpt
  initialTingkat: string
  onOpenKelas: (payload: any) => void
}) {
  const [mode, setMode] = useState<Mode>('hari')
  const [tingkat, setTingkat] = useState(initialTingkat)
  const [tanggal, setTanggal] = useState(today())
  const [tglMulai, setTglMulai] = useState(monthStart())
  const [tglSelesai, setTglSelesai] = useState(today())
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState('')

  const load = async () => {
    setLoading(true)
    setInfo('')
    const result = mode === 'hari'
      ? await getAbsensiPerKelas(tanggal, Number(tingkat))
      : await getAbsensiPerKelasRentang(Number(tingkat), tglMulai, tglSelesai)
    if (result.error) setInfo(result.error)
    else if ((result as any).calendarStatus && !(result as any).calendarStatus.isEffective) setInfo(`Tanggal ini tidak efektif pembelajaran: ${(result as any).calendarStatus.reason || 'tidak dihitung dalam rekap.'}`)
    setData(result.data || [])
    setLoading(false)
  }

  const followUpItems = data.filter(item =>
    Number(item.belum_ada_data || 0) > 0 || Number(item.perlu_konfirmasi_wali || 0) > 0
  )

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white p-4 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <ModeSwitch mode={mode} setMode={(m) => { setMode(m); setData([]); setInfo('') }} />
          <AngkatanSelect value={tingkat} onChange={(v) => { setTingkat(v); setData([]) }} options={filterOptions.angkatan} />
          {mode === 'hari' ? (
            <div className="flex items-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setTanggal(prev => shiftDateISO(prev, -1))} className="h-9 w-9 p-0"><ChevronRight className="h-4 w-4 rotate-180" /></Button>
              <div><Label className="text-xs text-slate-500">Tanggal</Label><Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="mt-1 h-9 w-[155px] text-sm" /></div>
              <Button variant="outline" size="sm" onClick={() => setTanggal(prev => shiftDateISO(prev, 1))} className="h-9 w-9 p-0"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          ) : (
            <>
              <div><Label className="text-xs text-slate-500">Dari</Label><Input type="date" value={tglMulai} onChange={e => setTglMulai(e.target.value)} className="mt-1 h-9 w-[155px] text-sm" /></div>
              <div><Label className="text-xs text-slate-500">Sampai</Label><Input type="date" value={tglSelesai} onChange={e => setTglSelesai(e.target.value)} className="mt-1 h-9 w-[155px] text-sm" /></div>
            </>
          )}
          <Button onClick={load} disabled={loading || !tingkat} size="sm" className="ml-auto bg-indigo-600 text-white hover:bg-indigo-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="mr-1 h-4 w-4" />Tampilkan</>}
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          {mode === 'hari' ? `Monitoring kelas pada ${fmtTglFull(tanggal)}.` : 'Rentang tanggal maksimal 31 hari, ditampilkan sebagai ringkasan per kelas.'}
        </p>
      </div>

      {info && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{info}</div>}

      {followUpItems.length > 0 && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-purple-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold">Tindak lanjut Belum Lengkap</p>
              <p className="mt-0.5 text-xs text-purple-700">
                Untuk wali kelas, staff tata usaha, dan admin. Cek kelas berikut lalu koordinasikan absensi guru/piket atau tetapkan keputusan wali kelas.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-purple-700">
              {followUpItems.length} kelas perlu dicek
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {followUpItems.map(item => (
              <button
                key={`follow-up-${item.kelas_id}`}
                type="button"
                onClick={() => onOpenKelas({
                  source: 'follow-up',
                  mode,
                  kelasId: item.kelas_id,
                  kelasLabel: item.label,
                  tanggal,
                  tglMulai,
                  tglSelesai,
                })}
                className="rounded-md border border-purple-200 bg-white px-3 py-2 text-left text-xs shadow-sm transition-colors hover:border-purple-400"
              >
                <p className="font-bold text-slate-900">{item.label}</p>
                <p className="mt-1 text-purple-700">
                  Belum lengkap: {item.belum_ada_data || 0}
                  {Number(item.perlu_konfirmasi_wali || 0) > 0 ? ` • Keputusan wali: ${item.perlu_konfirmasi_wali}` : ''}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((k) => {
            const total = mode === 'hari' ? k.total : k.total_status
            return (
              <button
                key={k.kelas_id}
                onClick={() => onOpenKelas({
                  source: 'kelas',
                  mode,
                  kelasId: k.kelas_id,
                  kelasLabel: k.label,
                  tanggal,
                  tglMulai,
                  tglSelesai,
                })}
                className="rounded-lg border bg-white p-4 text-left transition-colors hover:border-indigo-300 active:scale-[0.99] dark:bg-slate-900"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-slate-900 dark:text-slate-50">{k.label}</p>
                    <p className="text-xs text-slate-500">{mode === 'hari' ? `${k.total} siswa` : `${k.total_siswa} siswa, ${k.total_hari_efektif} hari efektif`}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900 dark:text-slate-50">{k.persentase_hadir}%</p>
                    <p className="text-[10px] text-slate-400">kehadiran</p>
                  </div>
                </div>
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${k.persentase_hadir}%` }} />
                </div>
                <SummaryChips item={k} />
                <p className="mt-3 text-[11px] text-slate-400">Klik untuk melihat detail per siswa.</p>
              </button>
            )
          })}
        </div>
      ) : !loading && (
        <div className="rounded-lg border border-dashed bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
          Pilih angkatan dan klik Tampilkan.
        </div>
      )}
    </div>
  )
}

function TabSiswa({ filterOptions, initialJump, onBack }: {
  filterOptions: FilterOpt
  initialJump: any
  onBack: () => void
}) {
  const [appliedJump, setAppliedJump] = useState<any>(null)
  const [mode, setMode] = useState<Mode>('hari')
  const [kelasId, setKelasId] = useState('')
  const [tanggal, setTanggal] = useState(today())
  const [tglMulai, setTglMulai] = useState(monthStart())
  const [tglSelesai, setTglSelesai] = useState(today())
  const [result, setResult] = useState<any>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!initialJump || initialJump === appliedJump) return
    setAppliedJump(initialJump)
    setMode(initialJump.mode)
    setKelasId(initialJump.kelasId)
    setTanggal(initialJump.tanggal)
    setTglMulai(initialJump.tglMulai)
    setTglSelesai(initialJump.tglSelesai)
    setResult(null)
    setExpanded(null)
    setLoading(true)
    void (async () => {
      const data = initialJump.mode === 'hari'
        ? await getAbsensiSiswaKelasHarian(initialJump.kelasId, initialJump.tanggal)
        : await getAbsensiSiswaKelasRentang(initialJump.kelasId, initialJump.tglMulai, initialJump.tglSelesai)
      setResult(data)
      setLoading(false)
    })()
  }, [initialJump, appliedJump])

  const kelasList = filterOptions.kelas
  const kelasLabel = kelasList.find(k => k.id === kelasId)?.label || initialJump?.kelasLabel || ''

  const load = async () => {
    if (!kelasId) return
    setLoading(true)
    setExpanded(null)
    const data = mode === 'hari'
      ? await getAbsensiSiswaKelasHarian(kelasId, tanggal)
      : await getAbsensiSiswaKelasRentang(kelasId, tglMulai, tglSelesai)
    setResult(data)
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      {initialJump && (
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Kembali ke daftar kelas
        </Button>
      )}

      <div className="rounded-lg border bg-white p-4 dark:bg-slate-900">
        <div className="flex flex-wrap items-end gap-3">
          <ModeSwitch mode={mode} setMode={(m) => { setMode(m); setResult(null) }} />
          <KelasSelect value={kelasId} onChange={(v) => { setKelasId(v); setResult(null) }} kelas={kelasList} />
          {mode === 'hari' ? (
            <div><Label className="text-xs text-slate-500">Tanggal</Label><Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="mt-1 h-9 w-[155px] text-sm" /></div>
          ) : (
            <>
              <div><Label className="text-xs text-slate-500">Dari</Label><Input type="date" value={tglMulai} onChange={e => setTglMulai(e.target.value)} className="mt-1 h-9 w-[155px] text-sm" /></div>
              <div><Label className="text-xs text-slate-500">Sampai</Label><Input type="date" value={tglSelesai} onChange={e => setTglSelesai(e.target.value)} className="mt-1 h-9 w-[155px] text-sm" /></div>
            </>
          )}
          <Button onClick={load} disabled={loading || !kelasId} size="sm" className="ml-auto bg-indigo-600 text-white hover:bg-indigo-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="mr-1 h-4 w-4" />Tampilkan</>}
          </Button>
        </div>
      </div>

      {result?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</div>}

      {result && !result.error && mode === 'hari' && (
        <div className="rounded-lg border bg-white dark:bg-slate-900">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-50">Kelas {kelasLabel}</p>
            <p className="text-xs text-slate-500">{fmtTglFull(tanggal)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="w-10 px-3 py-2">No</th>
                  <th className="min-w-[220px] px-3 py-2">Nama Siswa</th>
                  <th className="px-3 py-2">NISN</th>
                  {(result.slots || []).map((slot: any) => (
                    <th key={slot.id} className="min-w-[92px] px-2 py-2 text-center align-top">
                      <span className="block font-semibold">Jam {slot.id}</span>
                      <span className="mt-0.5 block text-[10px] font-normal leading-tight text-slate-500">
                        {slot.nama_mapel || '-'}
                      </span>
                    </th>
                  ))}
                  <th className="min-w-[150px] px-3 py-2">Status Harian</th>
                  <th className="min-w-[240px] px-3 py-2">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(result.rows || []).map((row: any, idx: number) => (
                  <tr key={row.siswa_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">{row.nama_lengkap}</td>
                    <td className="px-3 py-2 text-slate-500">{row.nisn || '-'}</td>
                    {row.cells.map((cell: any) => <td key={cell.jam_ke} className="px-2 py-2 text-center"><StatusDot status={cell.status} /></td>)}
                    <td className="px-3 py-2"><StatusBadge status={row.status_harian} /></td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && !result.error && mode === 'rentang' && (
        <div className="rounded-lg border bg-white dark:bg-slate-900">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-50">Kelas {kelasLabel}</p>
            <p className="text-xs text-slate-500">{fmtTgl(tglMulai)} s/d {fmtTgl(tglSelesai)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                <tr>
                  {['No', 'Nama Siswa', 'NISN', 'Hari Efektif', 'Hadir', 'Sakit', 'Izin', 'Alfa', 'Bolos sebagian jam', 'Perlu keputusan wali kelas', 'Belum lengkap', 'Kehadiran'].map(h => (
                    <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {(result.rows || []).map((row: any, idx: number) => (
                  <Fragment key={row.siswa_id}>
                    <tr key={row.siswa_id} onClick={() => setExpanded(expanded === row.siswa_id ? null : row.siswa_id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                      <td className="min-w-[220px] px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">
                        <span className="inline-flex items-center gap-1">{expanded === row.siswa_id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{row.nama_lengkap}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{row.nisn || '-'}</td>
                      <td className="px-3 py-2">{row.total_hari_efektif}</td>
                      <td className="px-3 py-2 text-emerald-700">{row.hadir}</td>
                      <td className="px-3 py-2 text-amber-700">{row.sakit}</td>
                      <td className="px-3 py-2 text-blue-700">{row.izin}</td>
                      <td className="px-3 py-2 text-red-700">{row.alfa}</td>
                      <td className="px-3 py-2 text-yellow-700">{row.bolos}</td>
                      <td className="px-3 py-2 text-purple-700">{row.perlu_konfirmasi_wali}</td>
                      <td className="px-3 py-2 text-slate-500">{row.belum_ada_data}</td>
                      <td className="px-3 py-2 font-bold">{row.persentase_hadir}%</td>
                    </tr>
                    {expanded === row.siswa_id && (
                      <tr key={`${row.siswa_id}-detail`}>
                        <td colSpan={12} className="bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {row.days.map((day: any) => (
                              <div key={day.tanggal} className="rounded-lg border bg-white p-3 dark:bg-slate-900">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-xs font-semibold">{day.hariNama}, {fmtTgl(day.tanggal)}</p>
                                    <p className="text-[10px] text-slate-500">{day.totalBlok} blok terjadwal</p>
                                  </div>
                                  <StatusBadge status={day.statusHari} />
                                </div>
                                {day.detail?.length > 0 && (
                                  <p className="text-[11px] text-slate-600">{day.detail.map((d: any) => `${d.nama_mapel} jam ${d.jam_ke_mulai}-${d.jam_ke_selesai}: ${statusStyle(d.status).label}`).join(' | ')}</p>
                                )}
                                {day.keterangan && <p className="mt-1 text-[11px] text-amber-700">{day.keterangan}</p>}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="rounded-lg border border-dashed bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
          Pilih kelas dan klik Tampilkan.
        </div>
      )}
    </div>
  )
}

function TabJam({ filterOptions, initialTingkat }: { filterOptions: FilterOpt; initialTingkat: string }) {
  const [tingkat, setTingkat] = useState(initialTingkat)
  const [tanggal, setTanggal] = useState(today())
  const [result, setResult] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setSelected(null)
    setResult(await getAbsensiHeatmap(Number(tingkat), tanggal))
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white p-4 dark:bg-slate-900">
        <div className="flex flex-wrap items-end gap-3">
          <AngkatanSelect value={tingkat} onChange={(v) => { setTingkat(v); setResult(null) }} options={filterOptions.angkatan} />
          <div><Label className="text-xs text-slate-500">Tanggal</Label><Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="mt-1 h-9 w-[155px] text-sm" /></div>
          <Button onClick={load} disabled={loading || !tingkat} size="sm" className="ml-auto bg-indigo-600 text-white hover:bg-indigo-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="mr-1 h-4 w-4" />Tampilkan Heatmap</>}
          </Button>
        </div>
      </div>

      {result?.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</div>}

      {result && !result.error && (
        <div className="rounded-lg border bg-white p-4 dark:bg-slate-900">
          <div className="mb-3">
            <p className="text-sm font-bold">Heatmap kelas-jam</p>
            <p className="text-xs text-slate-500">{result.hariNama}, {fmtTglFull(tanggal)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                  <th className="sticky left-0 z-10 min-w-[140px] bg-slate-50 px-3 py-2 text-left dark:bg-slate-800">Kelas</th>
                  {(result.slots || []).map((slot: any) => <th key={slot.id} className="min-w-[80px] px-2 py-2 text-center">Jam {slot.id}<br /><span className="font-normal">{slot.mulai}</span></th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {(result.data || []).map((kelas: any) => (
                  <tr key={kelas.kelas_id}>
                    <td className="sticky left-0 bg-white px-3 py-2 font-semibold dark:bg-slate-900">{kelas.label}</td>
                    {kelas.cells.map((cell: any) => {
                      const cls = cell.bermasalah > 4 ? 'bg-red-100 text-red-800 border-red-200' : cell.bermasalah > 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : cell.belum_ada_data > 0 ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      return (
                        <td key={cell.jam_ke} className="p-1.5 text-center">
                          <button onClick={() => setSelected({ kelas, cell })} className={`w-full rounded-md border px-2 py-2 text-xs font-bold ${cls}`}>
                            {cell.bermasalah > 0 ? `${cell.bermasalah} siswa` : cell.belum_ada_data > 0 ? 'Belum data' : 'Aman'}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <div className="rounded-lg border bg-white p-4 dark:bg-slate-900">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold">{selected.kelas.label} - Jam {selected.cell.jam_ke}</p>
              <p className="text-xs text-slate-500">{selected.cell.bermasalah} siswa bermasalah, {selected.cell.belum_ada_data} belum ada data</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSelected(null)}>Tutup</Button>
          </div>
          {selected.cell.detail.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {selected.cell.detail.map((d: any) => (
                <div key={`${d.siswa_id}-${d.jam_ke}`} className="rounded-lg border bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-xs font-semibold">{d.nama_lengkap}</p>
                  <p className="text-[11px] text-slate-500">{d.nisn || '-'} - {d.nama_mapel || '-'}</p>
                  <div className="mt-2 flex items-center gap-2"><StatusBadge status={d.status} />{d.catatan && <span className="text-[11px] text-amber-700">{d.catatan}</span>}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Tidak ada siswa bermasalah pada sel ini.</p>
          )}
        </div>
      )}
    </div>
  )
}

function TabCetak({ filterOptions, initialTingkat }: { filterOptions: FilterOpt; initialTingkat: string }) {
  const [printKind, setPrintKind] = useState<'kelas' | 'siswa'>('kelas')
  const [mode, setMode] = useState<Mode>('hari')
  const [tingkat, setTingkat] = useState(initialTingkat)
  const [kelasId, setKelasId] = useState('all')
  const [tanggal, setTanggal] = useState(today())
  const [tglMulai, setTglMulai] = useState(monthStart())
  const [tglSelesai, setTglSelesai] = useState(today())
  const [siswaKelasId, setSiswaKelasId] = useState('')
  const [siswaList, setSiswaList] = useState<any[]>([])
  const [siswaId, setSiswaId] = useState('')
  const [printData, setPrintData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)
  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent)

  const kelasByTingkat = useMemo(() => filterOptions.kelas.filter(k => k.tingkat === Number(tingkat)), [filterOptions.kelas, tingkat])

  const loadSiswa = async (id: string) => {
    setSiswaKelasId(id)
    setSiswaId('')
    setSiswaList([])
    if (!id) return
    const res = await getSiswaByKelas(id)
    setSiswaList(res.data || [])
  }

  const load = async () => {
    setLoading(true)
    setPrintData(null)
    if (printKind === 'kelas') {
      setPrintData(await getCetakRekapKelas({
        mode,
        tanggal,
        tglMulai,
        tglSelesai,
        tingkat: Number(tingkat),
        kelasId: kelasId !== 'all' ? kelasId : undefined,
      }))
    } else if (siswaId) {
      setPrintData(await getCetakRekapSiswa(siswaId, tglMulai, tglSelesai))
    }
    setLoading(false)
  }

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `rekap_absensi_${printKind}_${mode}_${tanggal || tglMulai}`,
    pageStyle: `
      @page { size: A4 portrait; margin: 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page-break { break-before: page; page-break-before: always; }
      }
    `,
  })

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white p-4 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-slate-500">Jenis Cetak</Label>
            <Select value={printKind} onValueChange={(v) => { setPrintKind(v as any); setPrintData(null) }}>
              <SelectTrigger className="mt-1 h-9 w-[160px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kelas">Per Kelas</SelectItem>
                <SelectItem value="siswa">Per Siswa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {printKind === 'kelas' && <ModeSwitch mode={mode} setMode={(m) => { setMode(m); setPrintData(null) }} />}
          {printKind === 'kelas' ? (
            <>
              <AngkatanSelect value={tingkat} onChange={(v) => { setTingkat(v); setKelasId('all'); setPrintData(null) }} options={filterOptions.angkatan} />
              <div>
                <Label className="text-xs text-slate-500">Kelas</Label>
                <Select value={kelasId} onValueChange={(v) => { setKelasId(v); setPrintData(null) }}>
                  <SelectTrigger className="mt-1 h-9 w-[170px] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kelas</SelectItem>
                    {kelasByTingkat.map(k => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <KelasSelect value={siswaKelasId} onChange={loadSiswa} kelas={filterOptions.kelas} />
              <div>
                <Label className="text-xs text-slate-500">Siswa</Label>
                <Select value={siswaId} onValueChange={(v) => { setSiswaId(v); setPrintData(null) }}>
                  <SelectTrigger className="mt-1 h-9 min-w-[220px] text-sm"><SelectValue placeholder="Pilih siswa" /></SelectTrigger>
                  <SelectContent>
                    {siswaList.map(s => <SelectItem key={s.id} value={s.id}>{s.nama_lengkap}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {printKind === 'kelas' && mode === 'hari' ? (
            <div><Label className="text-xs text-slate-500">Tanggal</Label><Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="mt-1 h-9 w-[155px] text-sm" /></div>
          ) : (
            <>
              <div><Label className="text-xs text-slate-500">Dari</Label><Input type="date" value={tglMulai} onChange={e => setTglMulai(e.target.value)} className="mt-1 h-9 w-[155px] text-sm" /></div>
              <div><Label className="text-xs text-slate-500">Sampai</Label><Input type="date" value={tglSelesai} onChange={e => setTglSelesai(e.target.value)} className="mt-1 h-9 w-[155px] text-sm" /></div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={load} disabled={loading || (printKind === 'siswa' && !siswaId)} size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="mr-1 h-4 w-4" />Muat Data</>}
          </Button>
          <Button onClick={() => handlePrint()} disabled={!printData || loading} size="sm" variant="outline">
            <Printer className="mr-1 h-4 w-4" />{isMobile ? 'Simpan PDF' : 'Cetak'}
          </Button>
        </div>
      </div>

      {!printData && (
        <div className="rounded-lg border border-dashed bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
          Pilih kriteria dan klik Muat Data.
        </div>
      )}

      {printData && (
        <div className="rounded-lg border bg-white p-4 dark:bg-slate-900">
          <div ref={printRef} className="space-y-6 text-black">
            {printKind === 'kelas' ? (
              <PrintKelas data={printData} mode={mode} tanggal={tanggal} tglMulai={tglMulai} tglSelesai={tglSelesai} />
            ) : (
              <PrintSiswa data={printData} tglMulai={tglMulai} tglSelesai={tglSelesai} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PrintHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <img src="/kopsurat.png" alt="Kop Surat" style={{ width: '100%', display: 'block', marginBottom: 12 }} />
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>{title}</h2>
        <p style={{ fontSize: 12, margin: '4px 0', color: '#444' }}>{subtitle}</p>
      </div>
    </div>
  )
}

function PrintKelas({ data, mode, tanggal, tglMulai, tglSelesai }: any) {
  const sections = data.sections || []
  return (
    <>
      {sections.map((section: any, idx: number) => (
        <div key={section.kelas?.id || idx} className={idx > 0 ? 'page-break' : ''}>
          <PrintHeader
            title="Rekap Absensi Siswa Per Kelas"
            subtitle={`Kelas ${section.kelas?.label || '-'} | ${mode === 'hari' ? fmtTglFull(tanggal) : `${fmtTgl(tglMulai)} s/d ${fmtTgl(tglSelesai)}`}`}
          />
          {mode === 'hari' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr>
                  {['No', 'Nama Siswa', 'NISN', ...(section.slots || []).map((s: any) => `Jam ${s.id}`), 'Status Harian', 'Keterangan'].map(h => (
                    <th key={h} style={{ border: '1px solid #000', padding: 4, background: '#eee' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(section.rows || []).map((row: any, i: number) => (
                  <tr key={row.siswa_id}>
                    <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ border: '1px solid #000', padding: 4 }}>{row.nama_lengkap}</td>
                    <td style={{ border: '1px solid #000', padding: 4 }}>{row.nisn || '-'}</td>
                    {row.cells.map((cell: any) => <td key={cell.jam_ke} style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{statusStyle(cell.status).label}</td>)}
                    <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{statusStyle(row.status_harian).label}</td>
                    <td style={{ border: '1px solid #000', padding: 4 }}>{row.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr>
                  {['No', 'Nama Siswa', 'NISN', 'Hari Efektif', 'Hadir', 'Sakit', 'Izin', 'Alfa', 'Bolos sebagian jam', 'Perlu keputusan wali kelas', 'Belum lengkap', 'Kehadiran'].map(h => (
                    <th key={h} style={{ border: '1px solid #000', padding: 4, background: '#eee' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(section.rows || []).map((row: any, i: number) => (
                  <tr key={row.siswa_id}>
                    <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ border: '1px solid #000', padding: 4 }}>{row.nama_lengkap}</td>
                    <td style={{ border: '1px solid #000', padding: 4 }}>{row.nisn || '-'}</td>
                    <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{row.total_hari_efektif}</td>
                    <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{row.hadir}</td>
                    <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{row.sakit}</td>
                    <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{row.izin}</td>
                    <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{row.alfa}</td>
                    <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{row.bolos}</td>
                    <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{row.perlu_konfirmasi_wali}</td>
                    <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{row.belum_ada_data}</td>
                    <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{row.persentase_hadir}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ marginTop: 12, textAlign: 'right', fontSize: 10 }}>Dicetak pada {formatTimeWIB(new Date().toISOString())}</p>
        </div>
      ))}
    </>
  )
}

function PrintSiswa({ data, tglMulai, tglSelesai }: any) {
  const rekap = data.rekap || {}
  const siswa = rekap.siswa || {}
  const summary = rekap.summary || {}
  return (
    <div>
      <PrintHeader title="Rekap Absensi Siswa" subtitle={`${siswa.nama || '-'} | Kelas ${siswa.kelas || '-'} | ${fmtTgl(tglMulai)} s/d ${fmtTgl(tglSelesai)}`} />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 11 }}>
        <tbody>
          <tr><td style={{ padding: 3, width: 120 }}>Nama</td><td style={{ padding: 3 }}>: {siswa.nama || '-'}</td></tr>
          <tr><td style={{ padding: 3 }}>NISN</td><td style={{ padding: 3 }}>: {siswa.nisn || '-'}</td></tr>
          <tr><td style={{ padding: 3 }}>Kelas</td><td style={{ padding: 3 }}>: {siswa.kelas || '-'}</td></tr>
          <tr><td style={{ padding: 3 }}>Wali Kelas</td><td style={{ padding: 3 }}>: {data.waliKelas || 'Belum ditentukan'}</td></tr>
        </tbody>
      </table>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 10 }}>
        <thead><tr>{['Hadir', 'Bolos', 'Sakit', 'Izin', 'Alfa', 'Perlu keputusan wali kelas', 'Belum lengkap'].map(h => <th key={h} style={{ border: '1px solid #000', padding: 4, background: '#eee' }}>{h}</th>)}</tr></thead>
        <tbody><tr>
          <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{summary.hadir || 0}</td>
          <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{summary.parsial || summary.bolos || 0}</td>
          <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{summary.sakit || 0}</td>
          <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{summary.izin || 0}</td>
          <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{summary.alfa || 0}</td>
          <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{summary.perlu_konfirmasi_wali || 0}</td>
          <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{summary.belum_ada_data || 0}</td>
        </tr></tbody>
      </table>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr>{['No', 'Tanggal', 'Hari', 'Status Harian', 'Blok Hadir', 'Detail dan Keterangan'].map(h => <th key={h} style={{ border: '1px solid #000', padding: 4, background: '#eee' }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {(rekap.days || []).map((day: any, i: number) => (
            <tr key={day.tanggal}>
              <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{i + 1}</td>
              <td style={{ border: '1px solid #000', padding: 4 }}>{fmtTgl(day.tanggal)}</td>
              <td style={{ border: '1px solid #000', padding: 4 }}>{day.hariNama}</td>
              <td style={{ border: '1px solid #000', padding: 4 }}>{statusStyle(day.statusHari).label}</td>
              <td style={{ border: '1px solid #000', padding: 4, textAlign: 'center' }}>{day.blokHadir}/{day.totalBlok}</td>
              <td style={{ border: '1px solid #000', padding: 4 }}>{day.keterangan || day.detail?.map((d: any) => `${d.nama_mapel} jam ${d.jam_ke_mulai}-${d.jam_ke_selesai}: ${statusStyle(d.status).label}`).join(' | ') || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 12, textAlign: 'right', fontSize: 10 }}>Dicetak pada {formatTimeWIB(new Date().toISOString())}</p>
    </div>
  )
}
