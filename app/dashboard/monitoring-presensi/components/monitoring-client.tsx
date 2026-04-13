'use client'

import { useState, useRef, useTransition, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CalendarDays, Search, Printer, Loader2, CheckCircle2, XCircle, Clock,
  AlertTriangle, Stethoscope, FileText, MapPin, Settings, DollarSign,
  BarChart3, User, Building2, Save, PlusCircle, Trash2, TrendingUp,
  Camera, Eye
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import {
  getPresensiByTanggal, getPresensiByRange, getPresensiPerOrang,
  simpanPengaturanPresensi, simpanPengaturanTunjangan, hitungTunjanganBulanan,
} from '../actions'
import { getDefaultJamTiers, type JamMasukTier } from '@/lib/tunjangan'
import { cn } from '@/lib/utils'
import { nowWIB } from '@/lib/time'

type Pegawai = { id: string; nama_lengkap: string; domisili_pegawai: string | null; jabatan_nama: string }
type PresensiRow = {
  id: string; user_id: string; tanggal: string; jam_masuk: string | null;
  jam_pulang: string | null; status: string; is_telat: number;
  is_pulang_cepat: number; catatan: string | null;
  nama_lengkap: string; domisili_pegawai: string | null; jabatan_nama: string
}
type PengaturanPresensi = {
  jam_masuk: string; jam_pulang: string;
  batas_telat_menit: number; batas_pulang_cepat_menit: number;
  hari_kerja: string
}
type PengaturanTunjangan = {
  nominal_dalam: number; nominal_luar: number;
  tanggal_bayar: number; aturan_tiers: any[]
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  hadir: { label: 'Hadir', color: 'text-emerald-600' },
  sakit: { label: 'Sakit', color: 'text-amber-600' },
  izin: { label: 'Izin', color: 'text-blue-600' },
  alfa: { label: 'Alfa', color: 'text-rose-600' },
  dinas_luar: { label: 'Dinas Luar', color: 'text-violet-600' },
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

export function MonitoringClient({
  pegawai, presensiHariIni, pengaturanPresensi, pengaturanTunjangan, tanggalHariIni
}: {
  pegawai: Pegawai[]; presensiHariIni: PresensiRow[];
  pengaturanPresensi: PengaturanPresensi; pengaturanTunjangan: PengaturanTunjangan;
  tanggalHariIni: string
}) {

  const [isPending, startTransition] = useTransition()
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })
  const [viewPhoto, setViewPhoto] = useState<{ url: string; title: string } | null>(null)


  // ---- TAB: HARIAN ----
  const [harianTgl, setHarianTgl] = useState(tanggalHariIni)
  const [harianData, setHarianData] = useState<PresensiRow[]>(presensiHariIni)
  const [harianLoaded, setHarianLoaded] = useState(tanggalHariIni)

  const loadHarian = useCallback((tgl: string) => {
    startTransition(async () => {
      const data = await getPresensiByTanggal(tgl)
      setHarianData(data)
      setHarianLoaded(tgl)
    })
  }, [])

  // ---- TAB: REKAP ----
  const [rekapMode, setRekapMode] = useState<'range' | 'person'>('range')
  const [rekapDari, setRekapDari] = useState(tanggalHariIni)
  const [rekapSampai, setRekapSampai] = useState(tanggalHariIni)
  const [rekapUserId, setRekapUserId] = useState(pegawai[0]?.id || '')
  const [rekapData, setRekapData] = useState<PresensiRow[]>([])
  const [rekapLoaded, setRekapLoaded] = useState(false)

  const loadRekap = useCallback(() => {
    startTransition(async () => {
      if (rekapMode === 'range') {
        const data = await getPresensiByRange(rekapDari, rekapSampai)
        setRekapData(data)
      } else {
        const data = await getPresensiPerOrang(rekapUserId, rekapDari, rekapSampai)
        setRekapData(data)
      }
      setRekapLoaded(true)
    })
  }, [rekapMode, rekapDari, rekapSampai, rekapUserId])

  // ---- TAB: TUNJANGAN ----
  const _wib = nowWIB()
  const [tunjBulan, setTunjBulan] = useState(_wib.getUTCMonth() + 1)
  const [tunjTahun, setTunjTahun] = useState(_wib.getUTCFullYear())
  const [tunjData, setTunjData] = useState<any>(null)

  const loadTunjangan = useCallback(() => {
    startTransition(async () => {
      const data = await hitungTunjanganBulanan(tunjBulan, tunjTahun)
      setTunjData(data)
    })
  }, [tunjBulan, tunjTahun])

  // ---- TAB: SETTINGS ----
  const [sJamMasuk, setSJamMasuk] = useState(pengaturanPresensi.jam_masuk)
  const [sJamPulang, setSJamPulang] = useState(pengaturanPresensi.jam_pulang)
  const [sBatasTelat, setSBatasTelat] = useState(pengaturanPresensi.batas_telat_menit)
  const [sBatasCepat, setSBatasCepat] = useState(pengaturanPresensi.batas_pulang_cepat_menit)
  const [sHariKerja, setSHariKerja] = useState<number[]>(() => {
    try { return JSON.parse(pengaturanPresensi.hari_kerja) } catch { return [1,2,3,4,5,6] }
  })
  const [tNominalDalam, setTNominalDalam] = useState(pengaturanTunjangan.nominal_dalam)
  const [tNominalLuar, setTNominalLuar] = useState(pengaturanTunjangan.nominal_luar)
  const [tTglBayar, setTTglBayar] = useState(pengaturanTunjangan.tanggal_bayar)
  // Tiers jam masuk — coba parse dari DB, fallback ke default
  const [tTiers, setTTiers] = useState<JamMasukTier[]>(() => {
    try {
      const raw = pengaturanTunjangan.aturan_tiers
      if (Array.isArray(raw) && raw.length > 0 && 'sampai_jam' in raw[0]) {
        return raw as JamMasukTier[]
      }
    } catch {}
    return getDefaultJamTiers()
  })

  const savePresensiSettings = () => {
    startTransition(async () => {
      const res = await simpanPengaturanPresensi({
        jam_masuk: sJamMasuk, jam_pulang: sJamPulang,
        batas_telat_menit: sBatasTelat, batas_pulang_cepat_menit: sBatasCepat,
        hari_kerja: sHariKerja,
      })
      alert(res.success || res.error)
    })
  }

  const saveTunjanganSettings = () => {
    startTransition(async () => {
      const res = await simpanPengaturanTunjangan({
        nominal_dalam: tNominalDalam, nominal_luar: tNominalLuar,
        tanggal_bayar: tTglBayar,
        aturan_tiers: tTiers,
      })
      alert(res.success || res.error)
    })
  }

  // ---- HELPERS ----
  const HARI = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  const BULAN_LABELS = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

  const summarize = (rows: PresensiRow[]) => {
    const hadir = rows.filter(r => r.status === 'hadir').length
    const telat = rows.filter(r => r.is_telat).length
    const pulangCepat = rows.filter(r => r.is_pulang_cepat).length
    const sakit = rows.filter(r => r.status === 'sakit').length
    const izin = rows.filter(r => r.status === 'izin').length
    const alfa = rows.filter(r => r.status === 'alfa').length
    return { hadir, telat, pulangCepat, sakit, izin, alfa }
  }

  const harianSummary = summarize(harianData)
  const belumAbsen = pegawai.filter(p => !harianData.find(d => d.user_id === p.id))

  // ---- PRINT TITLE ----
  const [printTitle, setPrintTitle] = useState('')

  return (
    <div className="space-y-3">
      {/* MODAL VIEW FOTO */}
      <Dialog open={!!viewPhoto} onOpenChange={o => !o && setViewPhoto(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-none bg-slate-900">
          <DialogHeader className="p-4 border-b border-white/10 bg-black/20 backdrop-blur-md">
            <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Camera className="h-4 w-4 text-teal-400" />
              {viewPhoto?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="aspect-[4/3] relative bg-black flex items-center justify-center">
            {viewPhoto && (
              <img 
                src={viewPhoto.url} 
                alt="Foto Presensi" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/800x600/0f172a/64748b?text=Foto+Tidak+Ditemukan'
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="harian">

        <TabsList className="bg-surface border border-surface flex-wrap">
          <TabsTrigger value="harian" className="text-xs gap-1 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            <CalendarDays className="h-3.5 w-3.5" /> Harian
          </TabsTrigger>
          <TabsTrigger value="rekap" className="text-xs gap-1 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
            <BarChart3 className="h-3.5 w-3.5" /> Rekap
          </TabsTrigger>
          <TabsTrigger value="tunjangan" className="text-xs gap-1 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700">
            <DollarSign className="h-3.5 w-3.5" /> Tunjangan
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs gap-1 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-700">
            <Settings className="h-3.5 w-3.5" /> Pengaturan
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB HARIAN ================= */}
        <TabsContent value="harian" className="mt-3 space-y-3">
          <div className="bg-surface border border-surface rounded-lg p-3 flex flex-wrap gap-2 items-center">
            <Input type="date" value={harianTgl} onChange={e => setHarianTgl(e.target.value)} className="h-8 w-44 text-xs rounded-md" />
            <Button size="sm" onClick={() => loadHarian(harianTgl)} disabled={isPending} className="h-8 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white gap-1">
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />} Tampilkan
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setPrintTitle(`Presensi Harian — ${harianLoaded}`); setTimeout(() => handlePrint(), 100) }} className="h-8 text-xs rounded-md gap-1 ml-auto">
              <Printer className="h-3 w-3" /> Cetak
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { l: 'Hadir', v: harianSummary.hadir, c: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
              { l: 'Telat', v: harianSummary.telat, c: 'text-amber-600 bg-amber-50 border-amber-200' },
              { l: 'P. Cepat', v: harianSummary.pulangCepat, c: 'text-orange-600 bg-orange-50 border-orange-200' },
              { l: 'Sakit', v: harianSummary.sakit, c: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
              { l: 'Izin', v: harianSummary.izin, c: 'text-blue-600 bg-blue-50 border-blue-200' },
              { l: 'Alfa', v: harianSummary.alfa, c: 'text-rose-600 bg-rose-50 border-rose-200' },
            ].map(s => (
              <div key={s.l} className={cn("rounded-lg border px-2.5 py-1.5", s.c)}>
                <p className="text-base font-bold">{s.v}</p>
                <p className="text-[10px] font-medium">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-surface rounded-lg border border-surface overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-2 hover:bg-surface-2">
                  <TableHead className="h-8 px-3 text-[11px] font-semibold text-slate-500 w-8">#</TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-slate-500">Nama</TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-24">Jabatan</TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-16">Status</TableHead>
                   <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-16 text-center">Masuk</TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-16 text-center">Pulang</TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-16 text-center">Foto</TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-16">Ket</TableHead>

                </TableRow>
              </TableHeader>
              <TableBody>
                {harianData.length === 0 && belumAbsen.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-20 text-center text-sm text-slate-400">Tidak ada data.</TableCell></TableRow>
                ) : (
                  <>
                    {harianData.map((r, i) => (
                      <TableRow key={r.id} className="border-surface-2 hover:bg-blue-50/30">
                        <TableCell className="px-3 text-[11px] text-slate-400">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-800 dark:text-slate-100">{r.nama_lengkap}</TableCell>
                        <TableCell className="text-[10px] text-violet-600 font-medium">{r.jabatan_nama}</TableCell>
                        <TableCell>
                          <span className={cn("text-[10px] font-bold", STATUS_LABEL[r.status]?.color || 'text-slate-500')}>
                            {STATUS_LABEL[r.status]?.label || r.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn("text-xs font-mono", r.is_telat ? 'text-amber-600 font-bold' : 'text-slate-600')}>
                            {r.jam_masuk || '—'}
                          </span>
                          {r.is_telat ? <span className="block text-[8px] text-amber-500 font-bold">TELAT</span> : null}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn("text-xs font-mono", r.is_pulang_cepat ? 'text-orange-600 font-bold' : 'text-slate-600')}>
                            {r.jam_pulang || '—'}
                          </span>
                          {r.is_pulang_cepat ? <span className="block text-[8px] text-orange-500 font-bold">CEPAT</span> : null}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.status === 'hadir' ? (
                            <div className="flex items-center justify-center gap-1">
                              {r.jam_masuk && (
                                <button onClick={() => setViewPhoto({ url: `/api/media/presensi/${r.tanggal}/${r.user_id}_masuk.jpg`, title: `Foto Masuk - ${r.nama_lengkap}` })} className="p-1 rounded text-emerald-600 hover:bg-emerald-100" title="Foto Masuk">
                                  <Camera className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {r.jam_pulang && (
                                <button onClick={() => setViewPhoto({ url: `/api/media/presensi/${r.tanggal}/${r.user_id}_pulang.jpg`, title: `Foto Pulang - ${r.nama_lengkap}` })} className="p-1 rounded text-rose-500 hover:bg-rose-100" title="Foto Pulang">
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[10px] text-slate-400 truncate max-w-[100px]">{r.catatan || ''}</TableCell>

                      </TableRow>
                    ))}
                    {belumAbsen.map((p, i) => (
                      <TableRow key={p.id} className="border-surface-2 bg-slate-50/50">
                        <TableCell className="px-3 text-[11px] text-slate-300">{harianData.length + i + 1}</TableCell>
                        <TableCell className="text-xs text-slate-400">{p.nama_lengkap}</TableCell>
                        <TableCell className="text-[10px] text-slate-400">{p.jabatan_nama}</TableCell>
                        <TableCell className="text-[10px] text-slate-300 font-medium">Belum Absen</TableCell>
                        <TableCell className="text-center text-xs text-slate-300">—</TableCell>
                        <TableCell className="text-center text-xs text-slate-300">—</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ================= TAB REKAP ================= */}
        <TabsContent value="rekap" className="mt-3 space-y-3">
          <div className="bg-surface border border-surface rounded-lg p-3 flex flex-wrap gap-2 items-center">
            <Select value={rekapMode} onValueChange={(v: any) => { setRekapMode(v); setRekapLoaded(false) }}>
              <SelectTrigger className="h-8 w-36 text-xs rounded-md"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="range" className="text-xs">Per Rentang Waktu</SelectItem>
                <SelectItem value="person" className="text-xs">Per Orang</SelectItem>
              </SelectContent>
            </Select>
            {rekapMode === 'person' && (
              <Select value={rekapUserId} onValueChange={setRekapUserId}>
                <SelectTrigger className="h-8 w-48 text-xs rounded-md"><SelectValue placeholder="Pilih pegawai" /></SelectTrigger>
                <SelectContent>{pegawai.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.nama_lengkap}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Input type="date" value={rekapDari} onChange={e => setRekapDari(e.target.value)} className="h-8 w-36 text-xs rounded-md" />
            <span className="text-xs text-slate-400">s/d</span>
            <Input type="date" value={rekapSampai} onChange={e => setRekapSampai(e.target.value)} className="h-8 w-36 text-xs rounded-md" />
            <Button size="sm" onClick={loadRekap} disabled={isPending} className="h-8 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />} Cari
            </Button>
            {rekapLoaded && (
              <Button size="sm" variant="outline" onClick={() => { setPrintTitle(`Rekap Presensi ${rekapDari} s/d ${rekapSampai}`); setTimeout(() => handlePrint(), 100) }} className="h-8 text-xs rounded-md gap-1 ml-auto">
                <Printer className="h-3 w-3" /> Cetak
              </Button>
            )}
          </div>

          {rekapLoaded && (
            <>
              {rekapMode === 'person' && rekapData.length > 0 && (
                <div className="bg-surface border border-surface rounded-lg p-3">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">{rekapData[0]?.nama_lengkap} — {rekapData[0]?.jabatan_nama}</p>
                  {(() => { const s = summarize(rekapData); return (
                    <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">Hadir: {s.hadir}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">Telat: {s.telat}</span>
                      <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700">Pulang Cepat: {s.pulangCepat}</span>
                      <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">Sakit: {s.sakit}</span>
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">Izin: {s.izin}</span>
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700">Alfa: {s.alfa}</span>
                    </div>
                  )})()}
                </div>
              )}
              <div className="bg-surface rounded-lg border border-surface overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-surface-2 hover:bg-surface-2">
                      <TableHead className="h-8 px-3 text-[11px] font-semibold text-slate-500 w-8">#</TableHead>
                      <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-24">Tanggal</TableHead>
                      {rekapMode === 'range' && <TableHead className="h-8 text-[11px] font-semibold text-slate-500">Nama</TableHead>}
                      <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-16">Status</TableHead>
                      <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-16 text-center">Masuk</TableHead>
                      <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-16 text-center">Pulang</TableHead>
                      <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-16 text-center">Foto</TableHead>
                      <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-16">Ket</TableHead>

                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rekapData.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="h-20 text-center text-sm text-slate-400">Tidak ada data dalam rentang ini.</TableCell></TableRow>
                    ) : rekapData.map((r, i) => (
                      <TableRow key={r.id} className="border-surface-2 hover:bg-emerald-50/30">
                        <TableCell className="px-3 text-[11px] text-slate-400">{i + 1}</TableCell>
                        <TableCell className="text-xs text-slate-600">{r.tanggal}</TableCell>
                        {rekapMode === 'range' && <TableCell className="text-xs font-medium text-slate-800 dark:text-slate-100">{r.nama_lengkap}</TableCell>}
                        <TableCell>
                          <span className={cn("text-[10px] font-bold", STATUS_LABEL[r.status]?.color)}>
                            {STATUS_LABEL[r.status]?.label || r.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn("text-xs font-mono", r.is_telat ? 'text-amber-600 font-bold' : 'text-slate-600')}>{r.jam_masuk || '—'}</span>
                          {r.is_telat ? <span className="block text-[8px] text-amber-500 font-bold">TELAT</span> : null}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn("text-xs font-mono", r.is_pulang_cepat ? 'text-orange-600 font-bold' : 'text-slate-600')}>{r.jam_pulang || '—'}</span>
                          {r.is_pulang_cepat ? <span className="block text-[8px] text-orange-500 font-bold">CEPAT</span> : null}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.status === 'hadir' ? (
                            <div className="flex items-center justify-center gap-1">
                              {r.jam_masuk && (
                                <button onClick={() => setViewPhoto({ url: `/api/media/presensi/${r.tanggal}/${r.user_id}_masuk.jpg`, title: `Foto Masuk - ${r.nama_lengkap} (${r.tanggal})` })} className="p-1 rounded text-emerald-600 hover:bg-emerald-100" title="Foto Masuk">
                                  <Camera className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {r.jam_pulang && (
                                <button onClick={() => setViewPhoto({ url: `/api/media/presensi/${r.tanggal}/${r.user_id}_pulang.jpg`, title: `Foto Pulang - ${r.nama_lengkap} (${r.tanggal})` })} className="p-1 rounded text-rose-500 hover:bg-rose-100" title="Foto Pulang">
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[10px] text-slate-400 truncate max-w-[100px]">{r.catatan || ''}</TableCell>

                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        {/* ================= TAB TUNJANGAN ================= */}
        <TabsContent value="tunjangan" className="mt-3 space-y-3">
          <div className="bg-surface border border-surface rounded-lg p-3 flex flex-wrap gap-2 items-center">
            <Select value={String(tunjBulan)} onValueChange={v => setTunjBulan(Number(v))}>
              <SelectTrigger className="h-8 w-36 text-xs rounded-md"><SelectValue /></SelectTrigger>
              <SelectContent>{BULAN_LABELS.slice(1).map((b, i) => <SelectItem key={i+1} value={String(i+1)} className="text-xs">{b}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" value={tunjTahun} onChange={e => setTunjTahun(Number(e.target.value))} className="h-8 w-24 text-xs rounded-md" />
            <Button size="sm" onClick={loadTunjangan} disabled={isPending} className="h-8 text-xs rounded-md bg-amber-600 hover:bg-amber-700 text-white gap-1">
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />} Hitung
            </Button>
            {tunjData && (
              <Button size="sm" variant="outline" onClick={() => { setPrintTitle(`Tunjangan ${BULAN_LABELS[tunjBulan]} ${tunjTahun}`); setTimeout(() => handlePrint(), 100) }} className="h-8 text-xs rounded-md gap-1 ml-auto">
                <Printer className="h-3 w-3" /> Cetak
              </Button>
            )}
          </div>

          {tunjData && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border bg-slate-50 border-slate-200 px-3 py-2">
                  <p className="text-xs text-slate-500">Hari Kerja</p>
                  <p className="text-lg font-bold text-slate-700">{tunjData.totalHariKerja} hari</p>
                </div>
                <div className="rounded-lg border bg-blue-50 border-blue-200 px-3 py-2">
                  <p className="text-xs text-blue-500">Nominal Dalam</p>
                  <p className="text-lg font-bold text-blue-700">{formatRupiah(tunjData.nominalDalam)}</p>
                </div>
                <div className="rounded-lg border bg-amber-50 border-amber-200 px-3 py-2">
                  <p className="text-xs text-amber-500">Nominal Luar</p>
                  <p className="text-lg font-bold text-amber-700">{formatRupiah(tunjData.nominalLuar)}</p>
                </div>
                <div className="rounded-lg border bg-emerald-50 border-emerald-200 px-3 py-2">
                  <p className="text-xs text-emerald-500">Total Pegawai</p>
                  <p className="text-lg font-bold text-emerald-700">{tunjData.data.length} orang</p>
                </div>
              </div>

              {/* Keterangan tabel tier — dinamis dari tunjData.tiers */}
              <div className="rounded-lg border bg-slate-50 border-slate-200 px-4 py-2.5">
                <p className="text-[10px] font-semibold text-slate-500 mb-1.5">Aturan Tunjangan Berdasarkan Jam Masuk</p>
                <div className="flex flex-wrap gap-2">
                  {(tunjData.tiers as JamMasukTier[]).map((tier, i) => {
                    const colors = ['bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-orange-100 text-orange-700', 'bg-rose-100 text-rose-700']
                    const c = colors[i] || 'bg-slate-100 text-slate-700'
                    return (
                      <span key={i} className={`text-[10px] px-2 py-0.5 rounded font-semibold ${c}`}>
                        {tier.persen}% → {tier.label}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className="bg-surface rounded-lg border border-surface overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-surface-2 hover:bg-surface-2">
                      <TableHead className="h-8 px-3 text-[11px] font-semibold text-slate-500 w-8">#</TableHead>
                      <TableHead className="h-8 text-[11px] font-semibold text-slate-500">Nama</TableHead>
                      <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-20">Jabatan</TableHead>
                      <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-14">Dom.</TableHead>
                      {(tunjData.tiers as JamMasukTier[]).map((tier, i) => {
                        const colors = ['text-emerald-600', 'text-amber-600', 'text-orange-600', 'text-rose-600']
                        return (
                          <TableHead key={i} className={`h-8 text-[11px] font-semibold w-12 text-center ${colors[i] || 'text-slate-500'}`}
                            title={`${tier.persen}% — ${tier.label}`}>
                            {tier.persen}%
                          </TableHead>
                        )
                      })}
                      <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-12 text-center">Rata²</TableHead>
                      <TableHead className="h-8 text-[11px] font-semibold text-slate-500 w-28 text-right">Tunjangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tunjData.data.map((r: any, i: number) => {
                      const tierColors = ['text-emerald-600', 'text-amber-600', 'text-orange-600', 'text-rose-600']
                      return (
                        <TableRow key={r.id} className="border-surface-2 hover:bg-amber-50/30">
                          <TableCell className="px-3 text-[11px] text-slate-400">{i + 1}</TableCell>
                          <TableCell className="text-xs font-medium text-slate-800 dark:text-slate-100">{r.nama_lengkap}</TableCell>
                          <TableCell className="text-[10px] text-violet-600">{r.jabatan_nama}</TableCell>
                          <TableCell className={cn("text-[10px] font-semibold", r.domisili === 'dalam' ? 'text-blue-600' : r.domisili === 'luar' ? 'text-amber-600' : 'text-slate-400')}>
                            {r.domisili === 'dalam' ? 'DLM' : r.domisili === 'luar' ? 'LR' : '-'}
                          </TableCell>
                          {(r.tierBreakdown as number[]).map((count: number, ti: number) => (
                            <TableCell key={ti} className={`text-center text-xs font-semibold ${tierColors[ti] || 'text-slate-600'}`}>
                              {count || '-'}
                            </TableCell>
                          ))}
                          <TableCell className={cn("text-center text-xs font-bold",
                            r.persenRataRata >= 90 ? 'text-emerald-600' : r.persenRataRata >= 70 ? 'text-amber-600' : 'text-rose-600'
                          )}>{r.persenRataRata}%</TableCell>
                          <TableCell className="text-right text-xs font-bold text-slate-800 dark:text-slate-100">{formatRupiah(r.tunjanganDiterima)}</TableCell>
                        </TableRow>
                      )
                    })}
                    {tunjData.data.length > 0 && (
                      <TableRow className="bg-surface-2 font-bold">
                        <TableCell colSpan={9} className="px-3 text-xs text-slate-600 text-right">TOTAL TUNJANGAN</TableCell>
                        <TableCell className="text-right text-xs text-emerald-700 font-bold">
                          {formatRupiah(tunjData.data.reduce((sum: number, r: any) => sum + r.tunjanganDiterima, 0))}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        {/* ================= TAB SETTINGS ================= */}
        <TabsContent value="settings" className="mt-3 space-y-4">
          {/* Pengaturan Presensi */}
          <div className="bg-surface border border-surface rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" /> Pengaturan Jam Kerja
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-slate-500">Jam Masuk</Label>
                <Input type="time" value={sJamMasuk} onChange={e => setSJamMasuk(e.target.value)} className="h-8 text-xs rounded-md" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-slate-500">Jam Pulang</Label>
                <Input type="time" value={sJamPulang} onChange={e => setSJamPulang(e.target.value)} className="h-8 text-xs rounded-md" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-slate-500">Toleransi Telat (menit)</Label>
                <Input type="number" value={sBatasTelat} onChange={e => setSBatasTelat(Number(e.target.value))} className="h-8 text-xs rounded-md" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-slate-500">Toleransi Pulang Cepat (menit)</Label>
                <Input type="number" value={sBatasCepat} onChange={e => setSBatasCepat(Number(e.target.value))} className="h-8 text-xs rounded-md" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-500">Hari Kerja</Label>
              <div className="flex flex-wrap gap-1.5">
                {HARI.slice(1).map((h, i) => {
                  const dayNum = i + 1
                  const active = sHariKerja.includes(dayNum)
                  return (
                    <button key={dayNum} onClick={() => setSHariKerja(prev => active ? prev.filter(d => d !== dayNum) : [...prev, dayNum])}
                      className={cn("px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors",
                        active ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-surface-2 text-slate-400 border-surface'
                      )}>{h}</button>
                  )
                })}
              </div>
            </div>
            <Button size="sm" onClick={savePresensiSettings} disabled={isPending} className="h-8 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white gap-1">
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Simpan Pengaturan Presensi
            </Button>
          </div>

          {/* Pengaturan Tunjangan */}
          <div className="bg-surface border border-surface rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-500" /> Pengaturan Tunjangan
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-slate-500">Nominal Dalam / Hari (Rp)</Label>
                <Input type="number" value={tNominalDalam} onChange={e => setTNominalDalam(Number(e.target.value))} className="h-8 text-xs rounded-md" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-slate-500">Nominal Luar / Hari (Rp)</Label>
                <Input type="number" value={tNominalLuar} onChange={e => setTNominalLuar(Number(e.target.value))} className="h-8 text-xs rounded-md" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-slate-500">Tanggal Bayar (tiap bulan)</Label>
                <Input type="number" min={1} max={31} value={tTglBayar} onChange={e => setTTglBayar(Number(e.target.value))} className="h-8 text-xs rounded-md" />
              </div>
            </div>

            {/* Aturan Tiers Jam Masuk — bisa diedit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-semibold text-slate-500">Aturan Tunjangan Berdasarkan Jam Masuk</Label>
                <button
                  onClick={() => setTTiers(prev => [...prev.slice(0, -1), { sampai_jam: '00:00:00', persen: 0, label: '' }, prev[prev.length - 1]])}
                  className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5 hover:underline"
                >
                  <PlusCircle className="h-3 w-3" /> Tambah Baris
                </button>
              </div>
              <p className="text-[10px] text-slate-400">Urutkan dari jam paling awal ke paling akhir. Baris terakhir (Sampai = kosong) adalah catch-all untuk jam di luar batas.</p>
              <div className="space-y-1.5">
                {tTiers.map((tier, idx) => {
                  const isLast = tier.sampai_jam === null
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-surface-2 border border-surface rounded-lg px-2.5 py-1.5">
                      <span className="text-[10px] text-slate-400 w-10 shrink-0">Sampai</span>
                      <Input
                        type="time"
                        step="1"
                        value={tier.sampai_jam ?? ''}
                        disabled={isLast}
                        placeholder="—"
                        onChange={e => {
                          const n = [...tTiers]
                          n[idx] = { ...n[idx], sampai_jam: e.target.value ? e.target.value + ':00'.slice(e.target.value.length > 5 ? 0 : undefined) : null }
                          setTTiers(n)
                        }}
                        className="h-7 w-28 text-xs rounded-md text-center"
                      />
                      <span className="text-[10px] text-slate-400">→</span>
                      <Input
                        type="number" min={0} max={100}
                        value={tier.persen}
                        onChange={e => {
                          const n = [...tTiers]; n[idx] = { ...n[idx], persen: Number(e.target.value) }; setTTiers(n)
                        }}
                        className="h-7 w-16 text-xs rounded-md text-center"
                      />
                      <span className="text-[10px] text-slate-500 font-semibold">%</span>
                      <Input
                        type="text"
                        value={tier.label}
                        placeholder="Label (contoh: s/d 07.15)"
                        onChange={e => {
                          const n = [...tTiers]; n[idx] = { ...n[idx], label: e.target.value }; setTTiers(n)
                        }}
                        className="h-7 flex-1 text-xs rounded-md"
                      />
                      {tTiers.length > 1 && (
                        <button
                          onClick={() => setTTiers(prev => {
                            const filtered = prev.filter((_, i) => i !== idx)
                            // Pastikan tier terakhir selalu punya sampai_jam = null
                            const last = filtered[filtered.length - 1]
                            if (last && last.sampai_jam !== null) {
                              filtered[filtered.length - 1] = { ...last, sampai_jam: null }
                            }
                            return filtered
                          })}
                          className="p-1 text-rose-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-slate-400">* Baris terakhir otomatis berlaku untuk semua jam di luar batas atas (catch-all).</p>
            </div>

            <Button size="sm" onClick={saveTunjanganSettings} disabled={isPending} className="h-8 text-xs rounded-md bg-amber-600 hover:bg-amber-700 text-white gap-1">
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Simpan Pengaturan Tunjangan
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ================= HIDDEN PRINT AREA ================= */}
      <div className="hidden">
        <style>{`
          @media print {
            @page { size: 215mm 330mm; margin: 20mm; }
            body { -webkit-print-color-adjust: exact; }
          }
        `}</style>
        <div ref={printRef} style={{ fontFamily: 'Times New Roman, serif', fontSize: '11px', color: '#000', background: '#fff' }}>
          {/* Kop Surat — full width mentok kiri kanan (negatif margin = @page margin) */}
          <img
            src="/kopsurat.png"
            alt="Kop Surat"
            style={{
              display: 'block',
              width: '100%',
              marginBottom: '10px'
            }}
          />

          {/* Judul Laporan */}
          <div style={{ textAlign: 'center', margin: '8px 0 10px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{printTitle}</h3>
          </div>

          {/* Cetak data sesuai konteks aktif */}
          {/* Harian / Rekap */}
          {(printTitle.includes('Harian') || printTitle.includes('Rekap')) && (
            <table className="w-full border-collapse border border-black" style={{ fontSize: '10px' }}>
              <thead>
                <tr>
                  <th className="border border-black px-1 py-0.5">No</th>
                  <th className="border border-black px-1 py-0.5">Tanggal</th>
                  <th className="border border-black px-1 py-0.5">Nama</th>
                  <th className="border border-black px-1 py-0.5">Jabatan</th>
                  <th className="border border-black px-1 py-0.5">Status</th>
                  <th className="border border-black px-1 py-0.5">Masuk</th>
                  <th className="border border-black px-1 py-0.5">Pulang</th>
                  <th className="border border-black px-1 py-0.5">Ket</th>
                </tr>
              </thead>
              <tbody>
                {(printTitle.includes('Harian') ? harianData : rekapData).map((r, i) => (
                  <tr key={r.id}>
                    <td className="border border-black px-1 py-0.5 text-center">{i + 1}</td>
                    <td className="border border-black px-1 py-0.5">{r.tanggal}</td>
                    <td className="border border-black px-1 py-0.5">{r.nama_lengkap}</td>
                    <td className="border border-black px-1 py-0.5">{r.jabatan_nama}</td>
                    <td className="border border-black px-1 py-0.5">
                      {STATUS_LABEL[r.status]?.label}{r.is_telat ? ' (Telat)' : ''}{r.is_pulang_cepat ? ' (P.Cepat)' : ''}
                    </td>
                    <td className="border border-black px-1 py-0.5 text-center">{r.jam_masuk || '-'}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{r.jam_pulang || '-'}</td>
                    <td className="border border-black px-1 py-0.5">{r.catatan || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Tunjangan */}
          {printTitle.includes('Tunjangan') && tunjData && (
            <>
              <p style={{ fontSize: '10px', marginBottom: '4px' }}>
                Hari Kerja: {tunjData.totalHariKerja} hari | Nominal Dalam: {formatRupiah(tunjData.nominalDalam)} | Nominal Luar: {formatRupiah(tunjData.nominalLuar)}
              </p>
              <table className="w-full border-collapse border border-black" style={{ fontSize: '10px' }}>
                <thead>
                  <tr>
                    <th className="border border-black px-1 py-0.5">No</th>
                    <th className="border border-black px-1 py-0.5">Nama</th>
                    <th className="border border-black px-1 py-0.5">Jabatan</th>
                    <th className="border border-black px-1 py-0.5">Dom.</th>
                    <th className="border border-black px-1 py-0.5">H</th>
                    <th className="border border-black px-1 py-0.5">S</th>
                    <th className="border border-black px-1 py-0.5">I</th>
                    <th className="border border-black px-1 py-0.5">A</th>
                    <th className="border border-black px-1 py-0.5">%</th>
                    <th className="border border-black px-1 py-0.5 text-right">Tunjangan</th>
                  </tr>
                </thead>
                <tbody>
                  {tunjData.data.map((r: any, i: number) => (
                    <tr key={r.id}>
                      <td className="border border-black px-1 py-0.5 text-center">{i + 1}</td>
                      <td className="border border-black px-1 py-0.5">{r.nama_lengkap}</td>
                      <td className="border border-black px-1 py-0.5">{r.jabatan_nama}</td>
                      <td className="border border-black px-1 py-0.5 text-center">{r.domisili === 'dalam' ? 'DLM' : r.domisili === 'luar' ? 'LR' : '-'}</td>
                      <td className="border border-black px-1 py-0.5 text-center">{r.hadir}</td>
                      <td className="border border-black px-1 py-0.5 text-center">{r.sakit}</td>
                      <td className="border border-black px-1 py-0.5 text-center">{r.izin}</td>
                      <td className="border border-black px-1 py-0.5 text-center">{r.alfa}</td>
                      <td className="border border-black px-1 py-0.5 text-center">{r.persenKehadiran}%</td>
                      <td className="border border-black px-1 py-0.5 text-right">{formatRupiah(r.tunjanganDiterima)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan={9} className="border border-black px-1 py-0.5 text-right">TOTAL</td>
                    <td className="border border-black px-1 py-0.5 text-right">{formatRupiah(tunjData.data.reduce((s: number, r: any) => s + r.tunjanganDiterima, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          <div className="mt-6 flex justify-end">
            <div className="text-center" style={{ fontSize: '10px' }}>
              <p>Tasikmalaya, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}</p>
              <p className="mt-1">Kepala Madrasah,</p>
              <div className="h-16"></div>
              <p className="border-b border-black pb-0.5">(_________________________)</p>
              <p>NIP. ___________________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
