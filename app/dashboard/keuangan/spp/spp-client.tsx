'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Search, ChevronRight, CheckCircle2, XCircle, Zap, Settings2, Plus, AlertCircle } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { updateSppSetting, generateSppBulanan, getSppTagihanList, buatSppTagihanSiswa } from '../actions'
import { DataPagination, usePagination } from '@/components/ui/data-pagination'

interface SppSetting { id: string; tingkat: number; nominal: number; aktif: number }
interface SppRow {
  id: string | null
  siswa_id: string; nama_lengkap: string; nisn: string
  bulan: number; tahun: number; nominal: number
  total_dibayar: number; total_diskon: number; status: string
  tingkat: number; nomor_kelas: number; kelompok: string; tahun_masuk: number
}

const BULAN_LABEL = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const BULAN_SHORT = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des']

export function SppClient({ initialSettings, initialTagihan, defaultTahun, defaultBulan, angkatanList }: {
  initialSettings: SppSetting[]
  initialTagihan: SppRow[]
  defaultTahun: number
  defaultBulan: number
  angkatanList: number[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [settings, setSettings] = useState<SppSetting[]>(initialSettings)
  const [tagihan, setTagihan] = useState<SppRow[]>(initialTagihan)

  // Period selector
  const [bulan, setBulan] = useState(defaultBulan)
  const [tahun, setTahun] = useState(defaultTahun)

  // Filter & search
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [filterAngkatan, setFilterAngkatan] = useState('semua')
  const [filterKelas, setFilterKelas] = useState('semua')
  const [generateAngkatan, setGenerateAngkatan] = useState('semua')

  const [msg, setMsg] = useState('')
  const { page, pageSize, setPage, setPageSize, paginate, reset } = usePagination(10)

  // Modal buat tagihan individual
  const [buatModal, setBuatModal] = useState<SppRow | null>(null)
  const [buatNominal, setBuatNominal] = useState('')

  // ── Load data saat periode berubah ────────────────────────────────────────
  async function loadData(b: number, t: number) {
    startTransition(async () => {
      const res = await getSppTagihanList({ bulan: b, tahun: t })
      setTagihan(res.data as SppRow[])
      reset()
    })
  }

  function handleBulanChange(val: string) {
    const b = parseInt(val)
    setBulan(b)
    loadData(b, tahun)
  }

  function handleTahunChange(val: string) {
    const t = parseInt(val)
    setTahun(t)
    loadData(bulan, t)
  }

  // ── Filter lists ──────────────────────────────────────────────────────────
  const kelasList = useMemo(() => {
    const set = new Set<string>()
    tagihan.forEach(d => {
      if (d.tingkat && d.nomor_kelas) set.add(`${d.tingkat}-${d.nomor_kelas}${d.kelompok ? ' ' + d.kelompok : ''}`)
    })
    return [...set].sort()
  }, [tagihan])

  const filtered = useMemo(() => {
    reset()
    return tagihan.filter(r => {
      const matchS = !search || r.nama_lengkap.toLowerCase().includes(search.toLowerCase())
      const matchSt = filterStatus === 'semua' || r.status === filterStatus
      const matchAngkatan = filterAngkatan === 'semua' || String(r.tahun_masuk) === filterAngkatan
      const matchKelas = filterKelas === 'semua' || `${r.tingkat}-${r.nomor_kelas}${r.kelompok ? ' ' + r.kelompok : ''}` === filterKelas
      return matchS && matchSt && matchAngkatan && matchKelas
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagihan, search, filterStatus, filterAngkatan, filterKelas])

  const paginated = paginate(filtered)

  // ── Summary (hanya siswa yang sudah ada tagihan) ──────────────────────────
  const withTagihan = filtered.filter(r => r.status !== 'tidak_ada')
  const tidakAda    = filtered.filter(r => r.status === 'tidak_ada').length

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleSaveSetting(tingkat: number) {
    const s = settings.find(x => x.tingkat === tingkat)
    if (!s) return
    startTransition(async () => {
      const res = await updateSppSetting(s.tingkat, s.nominal, s.aktif)
      setMsg(res.error ?? res.success ?? '')
    })
  }

  async function handleGenerate() {
    const angkatan = generateAngkatan === 'semua' ? undefined : parseInt(generateAngkatan)
    const label = angkatan ? `Angkatan ${angkatan}` : 'semua angkatan'
    startTransition(async () => {
      const res = await generateSppBulanan(tahun, bulan, angkatan)
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) {
        // Reload data setelah generate
        const fresh = await getSppTagihanList({ bulan, tahun })
        setTagihan(fresh.data as SppRow[])
        reset()
      }
    })
  }

  function openBuatModal(row: SppRow) {
    // Pre-fill nominal dari setting tingkat
    const nomSetting = settings.find(s => s.tingkat === row.tingkat)?.nominal ?? 0
    setBuatNominal(String(nomSetting))
    setBuatModal(row)
  }

  async function handleBuatTagihan() {
    if (!buatModal) return
    startTransition(async () => {
      const res = await buatSppTagihanSiswa(buatModal.siswa_id, bulan, tahun, parseInt(buatNominal) || 0)
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) {
        setBuatModal(null)
        const fresh = await getSppTagihanList({ bulan, tahun })
        setTagihan(fresh.data as SppRow[])
        reset()
      }
    })
  }

  // ── Tahun options: 3 tahun ke belakang sampai 2 tahun ke depan ────────────
  const tahunOptions = Array.from({ length: 6 }, (_, i) => defaultTahun - 3 + i)

  return (
    <>
    <Tabs defaultValue="tagihan" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <TabsList className="h-8 text-xs">
          <TabsTrigger value="tagihan" className="text-xs h-7 px-3">Daftar Tagihan</TabsTrigger>
          <TabsTrigger value="setting" className="text-xs h-7 px-3 gap-1.5">
            <Settings2 className="h-3 w-3" />Pengaturan
          </TabsTrigger>
        </TabsList>
        {msg && (
          <p className={`text-xs px-3 py-1 rounded-md ${msg.startsWith('Error') || msg.includes('tidak') ? 'text-rose-600 bg-rose-50 dark:bg-rose-900/20' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'}`}>
            {msg}
          </p>
        )}
      </div>

      {/* ── Tab: Daftar Tagihan ─────────────────────────────────────────── */}
      <TabsContent value="tagihan" className="space-y-3 mt-0">

        {/* Baris 1: Period + Generate */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-wrap gap-2 items-center">
          <p className="text-xs font-medium text-slate-500 mr-1">Periode:</p>
          <Select value={String(bulan)} onValueChange={handleBulanChange} disabled={isPending}>
            <SelectTrigger className="h-8 w-32 text-xs rounded-md"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BULAN_LABEL.slice(1).map((b, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(tahun)} onValueChange={handleTahunChange} disabled={isPending}>
            <SelectTrigger className="h-8 w-24 text-xs rounded-md"><SelectValue /></SelectTrigger>
            <SelectContent>
              {tahunOptions.map(t => <SelectItem key={t} value={String(t)}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

          <p className="text-xs font-medium text-slate-500 mr-1">Generate untuk:</p>
          <Select value={generateAngkatan} onValueChange={setGenerateAngkatan}>
            <SelectTrigger className="h-8 w-36 text-xs rounded-md"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Angkatan</SelectItem>
              {angkatanList.map(y => (
                <SelectItem key={y} value={String(y)}>Angkatan {y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleGenerate} disabled={isPending}>
            <Zap className="h-3.5 w-3.5" />
            Generate {BULAN_SHORT[bulan]} {tahun}
          </Button>
        </div>

        {/* Baris 2: Filter & Search */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input placeholder="Cari nama siswa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm rounded-md" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-40 text-xs rounded-md"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Status</SelectItem>
              <SelectItem value="lunas">Lunas</SelectItem>
              <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
              <SelectItem value="tidak_ada">Belum Ada Tagihan</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAngkatan} onValueChange={setFilterAngkatan}>
            <SelectTrigger className="h-8 w-32 text-xs rounded-md"><SelectValue placeholder="Angkatan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Angkatan</SelectItem>
              {angkatanList.map(y => (
                <SelectItem key={y} value={String(y)}>Angkatan {y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterKelas} onValueChange={setFilterKelas}>
            <SelectTrigger className="h-8 w-28 text-xs rounded-md"><SelectValue placeholder="Kelas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Kelas</SelectItem>
              {kelasList.map(k => (
                <SelectItem key={k} value={k}>Kelas {k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total Tagihan', value: formatRupiah(withTagihan.reduce((s, r) => s + r.nominal, 0)), color: 'text-slate-900 dark:text-slate-50' },
            { label: 'Terkumpul', value: formatRupiah(withTagihan.reduce((s, r) => s + r.total_dibayar, 0)), color: 'text-emerald-600' },
            { label: 'Belum Bayar', value: withTagihan.filter(r => r.status === 'belum_bayar').length + ' siswa', color: 'text-rose-600' },
            { label: 'Belum Ada Tagihan', value: tidakAda + ' siswa', color: tidakAda > 0 ? 'text-amber-600' : 'text-slate-400' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
              <p className="text-[11px] text-slate-500">{s.label}</p>
              <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead className="text-xs font-semibold">Nama Siswa</TableHead>
                <TableHead className="text-xs font-semibold">Kelas</TableHead>
                <TableHead className="text-xs font-semibold text-right">Nominal</TableHead>
                <TableHead className="text-xs font-semibold text-right">Dibayar</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-sm text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                      Memuat data...
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!isPending && paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-sm text-slate-400">
                    Tidak ada data
                  </TableCell>
                </TableRow>
              )}
              {!isPending && paginated.map((row, idx) => {
                const noTagihan = row.status === 'tidak_ada'
                return (
                  <TableRow
                    key={row.id ?? `${row.siswa_id}-${idx}`}
                    className={`${noTagihan ? 'opacity-60' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                    onClick={noTagihan ? undefined : () => router.push(`/dashboard/keuangan/siswa/${row.siswa_id}?tab=spp`)}
                  >
                    <TableCell>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{row.nama_lengkap}</p>
                      <p className="text-[11px] text-slate-400">{row.nisn}</p>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                      {row.tingkat ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ' ' + row.kelompok : ''}` : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      {noTagihan ? <span className="text-slate-300 dark:text-slate-600">—</span> : formatRupiah(row.nominal)}
                    </TableCell>
                    <TableCell className="text-sm text-right text-emerald-600">
                      {noTagihan ? <span className="text-slate-300 dark:text-slate-600">—</span> : formatRupiah(row.total_dibayar)}
                    </TableCell>
                    <TableCell>
                      {noTagihan ? (
                        <Button
                          size="sm" variant="outline"
                          className="h-6 text-[11px] px-2 gap-1 border-amber-300 text-amber-600 hover:bg-amber-50"
                          onClick={e => { e.stopPropagation(); openBuatModal(row) }}
                        >
                          <Plus className="h-2.5 w-2.5" /> Buat Tagihan
                        </Button>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          row.status === 'lunas'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                        }`}>
                          {row.status === 'lunas' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                          {row.status === 'lunas' ? 'Lunas' : 'Belum Bayar'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!noTagihan && <ChevronRight className="h-4 w-4 text-slate-400" />}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <DataPagination
            total={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            entityLabel="siswa"
          />
        </div>
      </TabsContent>

      {/* ── Tab: Pengaturan ─────────────────────────────────────────────── */}
      <TabsContent value="setting" className="mt-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Pengaturan SPP per Tingkat</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Nominal default saat generate tagihan. Toggle aktif hanya berpengaruh pada tampilan — generate tetap bisa untuk semua angkatan.</p>
          </div>
          {settings.map(s => (
            <div key={s.tingkat} className="px-4 py-4 flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Kelas {s.tingkat}</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings(prev => prev.map(x => x.tingkat === s.tingkat ? { ...x, aktif: x.aktif ? 0 : 1 } : x))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${s.aktif ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform ${s.aktif ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className={`text-xs font-medium ${s.aktif ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {s.aktif ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label className="text-xs font-medium">Nominal per Bulan</Label>
                <Input
                  type="number" min={0}
                  value={s.nominal}
                  onChange={e => setSettings(prev => prev.map(x => x.tingkat === s.tingkat ? { ...x, nominal: parseInt(e.target.value) || 0 } : x))}
                  className="h-9 text-sm"
                />
              </div>
              <Button size="sm" className="h-9 text-xs" onClick={() => handleSaveSetting(s.tingkat)} disabled={isPending}>
                Simpan Kelas {s.tingkat}
              </Button>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>

    {/* ── Modal Buat Tagihan Individual ──────────────────────────────────── */}
    <Dialog open={!!buatModal} onOpenChange={v => { if (!v) setBuatModal(null) }}>
      <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700">
          <DialogTitle className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Buat Tagihan SPP
          </DialogTitle>
        </DialogHeader>
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm">
            <p className="font-medium text-slate-800 dark:text-slate-100">{buatModal?.nama_lengkap}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {BULAN_LABEL[bulan]} {tahun} · Kelas {buatModal?.tingkat}-{buatModal?.nomor_kelas}{buatModal?.kelompok ? ' ' + buatModal.kelompok : ''}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Nominal SPP (Rp)</Label>
            <Input
              type="number" min={0}
              value={buatNominal}
              onChange={e => setBuatNominal(e.target.value)}
              className="h-9 text-sm"
              placeholder="0"
              autoFocus
            />
            <p className="text-[11px] text-slate-400">
              <AlertCircle className="inline h-3 w-3 mr-1" />
              Pre-fill dari setting nominal tingkat ini
            </p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setBuatModal(null)}>
              Batal
            </Button>
            <Button size="sm" className="flex-1 h-9 text-sm" disabled={isPending} onClick={handleBuatTagihan}>
              {isPending ? 'Menyimpan...' : 'Buat Tagihan'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
