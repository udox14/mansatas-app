// Lokasi: app/dashboard/rekap-absensi/components/rekap-client.tsx
'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Search, Loader2, User, Users, Clock, Printer, FileSpreadsheet,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import {
  getAbsensiPerSiswa, getAbsensiPerKelas, getDetailKelasHarian,
  getAbsensiPerJam, getDataCetakAbsensi,
} from '../actions'
import { todayWIB, nowWIB } from '@/lib/time'
import { formatNamaKelas } from '@/lib/utils'

// ============================================================
// TYPES & CONSTS
// ============================================================
type FilterOpt = { kelas: any[]; siswa: any[] }
interface Props { filterOptions: FilterOpt }

const ST: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  HADIR:          { bg: 'bg-emerald-50 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-400', label: 'Hadir', dot: 'bg-emerald-500' },
  'HADIR PARSIAL':{ bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Hadir Parsial', dot: 'bg-yellow-500' },
  SAKIT:          { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Sakit', dot: 'bg-amber-500' },
  ALFA:           { bg: 'bg-red-50', text: 'text-red-700', label: 'Alfa', dot: 'bg-red-500' },
  IZIN:           { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Izin', dot: 'bg-blue-500' },
}

function today() { return todayWIB() }
function fmtTgl(t: string) { return new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }
function fmtTglFull(t: string) { return new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }

function StatusBadge({ status }: { status: string }) {
  const s = ST[status] || ST.ALFA
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.bg} ${s.text} font-medium border border-current/10`}>{s.label}</span>
}

// ============================================================
// MAIN EXPORT
// ============================================================
export function RekapAbsensiClient({ filterOptions }: Props) {
  return (
    <Tabs defaultValue="kelas" className="space-y-3">
      <TabsList className="grid w-full grid-cols-4 max-w-xl">
        <TabsTrigger value="kelas" className="text-xs sm:text-sm"><Users className="h-3.5 w-3.5 mr-1 hidden sm:inline" />Per Kelas</TabsTrigger>
        <TabsTrigger value="siswa" className="text-xs sm:text-sm"><User className="h-3.5 w-3.5 mr-1 hidden sm:inline" />Per Siswa</TabsTrigger>
        <TabsTrigger value="jam" className="text-xs sm:text-sm"><Clock className="h-3.5 w-3.5 mr-1 hidden sm:inline" />Per Jam</TabsTrigger>
        <TabsTrigger value="cetak" className="text-xs sm:text-sm"><Printer className="h-3.5 w-3.5 mr-1 hidden sm:inline" />Cetak</TabsTrigger>
      </TabsList>
      <TabsContent value="kelas"><TabKelas /></TabsContent>
      <TabsContent value="siswa"><TabSiswa filterOptions={filterOptions} /></TabsContent>
      <TabsContent value="jam"><TabJam /></TabsContent>
      <TabsContent value="cetak"><TabCetak filterOptions={filterOptions} /></TabsContent>
    </Tabs>
  )
}

// ============================================================
// TAB: PER KELAS
// ============================================================
function TabKelas() {
  const [tanggal, setTanggal] = useState(today())
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [detailKelas, setDetailKelas] = useState<{ label: string; data: any[] } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const search = async () => {
    setLoading(true)
    const r = await getAbsensiPerKelas(tanggal)
    setData(r.data || [])
    setLoading(false)
  }

  const openDetail = async (kelasId: string, label: string) => {
    setLoadingDetail(true)
    setDetailKelas({ label, data: [] })
    const d = await getDetailKelasHarian(kelasId, tanggal)
    setDetailKelas({ label, data: d })
    setLoadingDetail(false)
  }

  const nav = (off: number) => {
    const d = new Date(tanggal + 'T00:00:00'); d.setDate(d.getDate() + off)
    setTanggal(d.toISOString().split('T')[0])
  }

  // Group by tingkat
  const grouped = new Map<number, any[]>()
  for (const k of data) {
    if (!grouped.has(k.tingkat)) grouped.set(k.tingkat, [])
    grouped.get(k.tingkat)!.push(k)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white dark:bg-slate-900 dark:bg-slate-800 p-3 flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => nav(-1)} className="px-2"><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="w-[160px] h-9 text-sm" />
        <Button variant="outline" size="sm" onClick={() => nav(1)} className="px-2"><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => setTanggal(today())} className="text-xs">Hari Ini</Button>
        <Button onClick={search} disabled={loading} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white ml-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-1" />Tampilkan</>}
        </Button>
      </div>

      {data.length > 0 && <p className="text-xs text-slate-500 dark:text-slate-400 px-1">{fmtTglFull(tanggal)}</p>}

      {Array.from(grouped.entries()).map(([tingkat, items]) => (
        <div key={tingkat}>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1 mb-1.5">Kelas {tingkat}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {items.map((k: any) => {
              const pct = k.total > 0 ? Math.round((k.hadir / k.total) * 100) : 0
              const barColor = pct >= 90 ? 'bg-emerald-400' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'
              return (
                <button key={k.kelas_id} onClick={() => openDetail(k.kelas_id, k.label)}
                  className="rounded-lg border bg-white dark:bg-slate-900 dark:bg-slate-800 p-3 text-left hover:border-indigo-300 transition-colors active:scale-[0.98]">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">{k.label}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{pct}%</span>
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-[10px]">
                    <span className="text-emerald-600">H:{k.hadir}</span>
                    {k.sakit > 0 && <span className="text-amber-600">S:{k.sakit}</span>}
                    {k.alfa > 0 && <span className="text-red-600">A:{k.alfa}</span>}
                    {k.izin > 0 && <span className="text-blue-600">I:{k.izin}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Detail Modal */}
      <Dialog open={!!detailKelas} onOpenChange={() => setDetailKelas(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base">Kelas {detailKelas?.label} — {fmtTgl(tanggal)}</DialogTitle></DialogHeader>
          {loadingDetail ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : detailKelas?.data.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Semua siswa hadir!</p>
          ) : (
            <div className="space-y-2">
              {detailKelas?.data.map((r: any, i: number) => (
                <div key={`${r.siswa_id}-${r.jam_ke_mulai}-${i}`} className="flex items-center gap-2 p-2 rounded-lg border bg-slate-50 dark:bg-slate-800">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 dark:text-slate-100 truncate">{r.nama_lengkap}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{r.nama_mapel} — Jam {r.jam_ke_mulai === r.jam_ke_selesai ? r.jam_ke_mulai : `${r.jam_ke_mulai}-${r.jam_ke_selesai}`}</p>
                    {r.catatan && <p className="text-[10px] text-amber-600 mt-0.5">📝 {r.catatan}</p>}
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// TAB: PER SISWA
// ============================================================
function TabSiswa({ filterOptions }: { filterOptions: FilterOpt }) {
  const [siswaId, setSiswaId] = useState('')
  const [tglMulai, setTglMulai] = useState(() => { const d = nowWIB(); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().split('T')[0] })
  const [tglSelesai, setTglSelesai] = useState(today())
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  const filteredSiswa = searchQ.length >= 2
    ? filterOptions.siswa.filter((s: any) => s.nama.toLowerCase().includes(searchQ.toLowerCase()) || s.nisn.includes(searchQ)).slice(0, 20)
    : []

  const search = async () => {
    if (!siswaId) return
    setLoading(true)
    setResult(await getAbsensiPerSiswa(siswaId, tglMulai, tglSelesai))
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white dark:bg-slate-900 dark:bg-slate-800 p-4 space-y-3">
        {/* Siswa picker */}
        <div>
          <Label className="text-xs text-slate-500 dark:text-slate-400">Cari Siswa</Label>
          <Input placeholder="Ketik nama atau NISN..." value={searchQ} onChange={e => { setSearchQ(e.target.value); setSiswaId('') }}
            className="h-9 text-sm mt-1" />
          {filteredSiswa.length > 0 && !siswaId && (
            <div className="mt-1 max-h-40 overflow-y-auto rounded-md border bg-white dark:bg-slate-900 dark:bg-slate-800 shadow-sm">
              {filteredSiswa.map((s: any) => (
                <button key={s.id} onClick={() => { setSiswaId(s.id); setSearchQ(s.nama) }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:bg-slate-700 text-xs border-b last:border-0">
                  <span className="font-medium text-slate-800 dark:text-slate-200 dark:text-slate-100">{s.nama}</span>
                  <span className="text-slate-400 ml-2">{s.nisn} — {s.kelas_label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div><Label className="text-xs text-slate-500 dark:text-slate-400">Dari</Label><Input type="date" value={tglMulai} onChange={e => setTglMulai(e.target.value)} className="h-9 text-sm w-[150px]" /></div>
          <div><Label className="text-xs text-slate-500 dark:text-slate-400">Sampai</Label><Input type="date" value={tglSelesai} onChange={e => setTglSelesai(e.target.value)} className="h-9 text-sm w-[150px]" /></div>
          <Button onClick={search} disabled={loading || !siswaId} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-1" />Cari</>}
          </Button>
        </div>
      </div>

      {result?.siswa && (
        <div className="rounded-lg border bg-white dark:bg-slate-900 dark:bg-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">{result.siswa.nama}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{result.siswa.nisn} — Kelas {result.siswa.kelas}</p>
            </div>
          </div>
          {/* Summary */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-medium">{result.totalHari} hari</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 font-medium">Hadir: {result.summary.hadir}</span>
            {result.summary.parsial > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">Parsial: {result.summary.parsial}</span>}
            {result.summary.sakit > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Sakit: {result.summary.sakit}</span>}
            {result.summary.izin > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Izin: {result.summary.izin}</span>}
            {result.summary.alfa > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Alfa: {result.summary.alfa}</span>}
          </div>
          {/* Day list */}
          <div className="space-y-1.5">
            {result.days.map((day: any) => (
              <div key={day.tanggal} className="flex items-center gap-2 p-2 rounded-md border bg-slate-50 dark:bg-slate-800/50 dark:bg-slate-700/30">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 dark:text-slate-200">{day.hariNama}, {fmtTgl(day.tanggal)}</p>
                  {day.detail.length > 0 && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {day.detail.map((d: any, i: number) => (
                        <span key={i}>{i > 0 && ' · '}{d.nama_mapel} (Jam {d.jam_ke_mulai}-{d.jam_ke_selesai}): <span className={ST[d.status]?.text || ''}>{ST[d.status]?.label || d.status}</span></span>
                      ))}
                    </div>
                  )}
                </div>
                <StatusBadge status={day.statusHari} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// TAB: PER JAM
// ============================================================
function TabJam() {
  const [tanggal, setTanggal] = useState(today())
  const [data, setData] = useState<any[]>([])
  const [hariNama, setHariNama] = useState('')
  const [loading, setLoading] = useState(false)
  const [detailJam, setDetailJam] = useState<any>(null)

  const nav = (off: number) => {
    const d = new Date(tanggal + 'T00:00:00'); d.setDate(d.getDate() + off)
    setTanggal(d.toISOString().split('T')[0])
  }

  const search = async () => {
    setLoading(true)
    const r = await getAbsensiPerJam(tanggal)
    setData(r.data || []); setHariNama(r.hariNama || '')
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white dark:bg-slate-900 dark:bg-slate-800 p-3 flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => nav(-1)} className="px-2"><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="w-[160px] h-9 text-sm" />
        <Button variant="outline" size="sm" onClick={() => nav(1)} className="px-2"><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => setTanggal(today())} className="text-xs">Hari Ini</Button>
        <Button onClick={search} disabled={loading} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white ml-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-1" />Tampilkan</>}
        </Button>
      </div>

      {data.length > 0 && <p className="text-xs text-slate-500 dark:text-slate-400 px-1">{hariNama}, {fmtTglFull(tanggal)}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {data.map((jam: any) => (
          <button key={jam.jam_ke} onClick={() => jam.tidak_hadir > 0 && setDetailJam(jam)}
            className={`rounded-lg border p-3 text-left transition-colors active:scale-[0.98] ${jam.tidak_hadir > 0 ? 'bg-white dark:bg-slate-900 dark:bg-slate-800 hover:border-indigo-300 cursor-pointer' : 'bg-emerald-50 dark:bg-emerald-950/50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'}`}>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">{jam.nama}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{jam.mulai} — {jam.selesai}</p>
            {jam.tidak_hadir > 0 ? (
              <p className="text-xs mt-1.5 text-red-600 font-medium">{jam.tidak_hadir} tidak hadir</p>
            ) : (
              <p className="text-xs mt-1.5 text-emerald-600 font-medium">Semua hadir</p>
            )}
          </button>
        ))}
      </div>

      <Dialog open={!!detailJam} onOpenChange={() => setDetailJam(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base">{detailJam?.nama} ({detailJam?.mulai}—{detailJam?.selesai})</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {detailJam?.detail.map((r: any, i: number) => (
              <div key={`${r.siswa_id}-${i}`} className="flex items-center gap-2 p-2 rounded-lg border bg-slate-50 dark:bg-slate-800">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 dark:text-slate-100 truncate">{r.nama_lengkap}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok)} — {r.nama_mapel}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// TAB: CETAK
// ============================================================
function TabCetak({ filterOptions }: { filterOptions: FilterOpt }) {
  const [tglMulai, setTglMulai] = useState(() => { const d = nowWIB(); d.setUTCDate(1); return d.toISOString().split('T')[0] })
  const [tglSelesai, setTglSelesai] = useState(today())
  const [kelasId, setKelasId] = useState('')
  const [statusFilter, setStatusFilter] = useState('semua')
  const [siswaId, setSiswaId] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const filteredSiswa = searchQ.length >= 2
    ? filterOptions.siswa.filter((s: any) => s.nama.toLowerCase().includes(searchQ.toLowerCase()) || s.nisn.includes(searchQ)).slice(0, 20)
    : []

  const search = async () => {
    setLoading(true)
    setData(await getDataCetakAbsensi({
      tglMulai, tglSelesai,
      kelasId: kelasId && kelasId !== 'all' ? kelasId : undefined,
      siswaId: siswaId || undefined,
      statusFilter,
    }))
    setLoading(false)
  }

  const handlePrint = () => {
    if (!printRef.current) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Rekap Absensi</title>
      <style>body{font-family:'Segoe UI',sans-serif;font-size:11px;margin:20px;color:#333}
      h2{font-size:14px;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #ddd;padding:4px 6px;text-align:left;font-size:10px}
      th{background:#f5f5f5;font-weight:600}.s-sakit{color:#d97706}.s-alfa{color:#dc2626}.s-izin{color:#2563eb}
      @media print{body{margin:10mm}}</style></head><body>${printRef.current.innerHTML}</body></html>`)
    w.document.close(); w.print()
  }

  const handleExcel = () => {
    if (!printRef.current) return
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><style>td,th{border:1px solid #ccc;padding:4px;font-size:10px}th{background:#f0f0f0;font-weight:bold}</style></head>
      <body>${printRef.current.innerHTML}</body></html>`
    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `rekap_absensi_${tglMulai}_${tglSelesai}.xls`
    a.click(); URL.revokeObjectURL(url)
  }

  const kelasLabel = (id: string) => filterOptions.kelas.find((k: any) => k.id === id)?.label || ''

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white dark:bg-slate-900 dark:bg-slate-800 p-4 space-y-3">
        <div className="relative max-w-sm">
          <Label className="text-xs text-slate-500 dark:text-slate-400">Filter Siswa (Opsional)</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input placeholder="Ketik nama atau NISN..." value={searchQ} onChange={e => { setSearchQ(e.target.value); setSiswaId('') }}
              className="h-9 text-sm flex-1" />
            {siswaId && <Button size="sm" variant="outline" className="h-9" onClick={() => { setSiswaId(''); setSearchQ('') }}>Reset</Button>}
          </div>
          {filteredSiswa.length > 0 && !siswaId && (
            <div className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto rounded-md border bg-white dark:bg-slate-900 dark:bg-slate-800 shadow-lg">
              {filteredSiswa.map((s: any) => (
                <button key={s.id} onClick={() => { setSiswaId(s.id); setSearchQ(s.nama) }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:bg-slate-700 text-xs border-b border-slate-100 dark:border-slate-800 dark:border-slate-700 last:border-0 block">
                  <span className="font-medium text-slate-800 dark:text-slate-200 dark:text-slate-100">{s.nama}</span>
                  <span className="text-slate-400 ml-2">{s.nisn} — {s.kelas_label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3 relative z-0">
          <div><Label className="text-xs text-slate-500 dark:text-slate-400">Dari</Label><Input type="date" value={tglMulai} onChange={e => setTglMulai(e.target.value)} className="h-9 text-sm w-[150px]" /></div>
          <div><Label className="text-xs text-slate-500 dark:text-slate-400">Sampai</Label><Input type="date" value={tglSelesai} onChange={e => setTglSelesai(e.target.value)} className="h-9 text-sm w-[150px]" /></div>
          <div>
            <Label className="text-xs text-slate-500 dark:text-slate-400">Kelas</Label>
            <Select value={kelasId} onValueChange={setKelasId}>
              <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Semua" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {filterOptions.kelas.map((k: any) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-500 dark:text-slate-400">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua</SelectItem>
                <SelectItem value="SAKIT">Sakit</SelectItem>
                <SelectItem value="ALFA">Alfa</SelectItem>
                <SelectItem value="IZIN">Izin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={search} disabled={loading} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-1" />Muat Data</>}
          </Button>
          {data.length > 0 && (
            <>
              <Button onClick={handlePrint} size="sm" variant="outline"><Printer className="h-4 w-4 mr-1" />Cetak PDF</Button>
              <Button onClick={handleExcel} size="sm" variant="outline"><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
            </>
          )}
        </div>
      </div>

      {data.length > 0 && (
        <div className="rounded-lg border bg-white dark:bg-slate-900 dark:bg-slate-800 p-4 overflow-x-auto">
          <div ref={printRef}>
            <div className="print-only">
              <img src="/kopsurat.png" alt="Kop Surat" style={{ width: '100%', display: 'block', marginBottom: '15px' }} />
              <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Rekap Absensi Siswa</h2>
                <p style={{ fontSize: '12px', margin: '4px 0', color: '#666' }}>
                  Periode: {fmtTgl(tglMulai)} s/d {fmtTgl(tglSelesai)}
                  {kelasId && kelasId !== 'all' && !siswaId && ` — Kelas ${kelasLabel(kelasId)}`}
                  {siswaId && ` — Siswa: ${searchQ}`}
                  {statusFilter !== 'semua' && ` — Status: ${statusFilter}`}
                </p>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  {['No', 'Tanggal', 'Siswa', 'NISN', 'Kelas', 'Mapel', 'Jam', 'Status', 'Catatan'].map(h => (
                    <th key={h} style={{ border: '1px solid #000', padding: '6px 4px', fontWeight: 600, textAlign: 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((r: any, i: number) => (
                  <tr key={i}>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', whiteSpace: 'nowrap' }}>{r.tanggal}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{r.nama_lengkap}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{r.nisn}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{formatNamaKelas(r.tingkat, r.nomor_kelas, r.kelompok)}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{r.nama_mapel}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{r.jam_ke_mulai === r.jam_ke_selesai ? r.jam_ke_mulai : `${r.jam_ke_mulai}-${r.jam_ke_selesai}`}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }} className={`s-${r.status?.toLowerCase()}`}>{ST[r.status]?.label || r.status}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '9px' }}>{r.catatan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
              <p style={{ fontSize: 10, color: '#666' }}>Total: {data.length} record</p>
              <p style={{ fontSize: 10, color: '#666' }}>Dicetak pada: {new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
            </div>
          </div>
        </div>
      )}

      {data.length === 0 && !loading && (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-10 text-center">
          <Printer className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Pilih kriteria dan klik &quot;Muat Data&quot; untuk preview.</p>
        </div>
      )}
    </div>
  )
}
