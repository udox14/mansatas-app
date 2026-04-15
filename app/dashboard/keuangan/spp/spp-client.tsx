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
import { Search, ChevronRight, CheckCircle2, XCircle, Zap, Settings2 } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { updateSppSetting, generateSppBulanan, getSppTagihanList } from '../actions'
import { DataPagination, usePagination } from '@/components/ui/data-pagination'

interface SppSetting { id: string; tingkat: number; nominal: number; aktif: number }
interface SppRow {
  id: string; siswa_id: string; nama_lengkap: string; nisn: string
  bulan: number; tahun: number; nominal: number
  total_dibayar: number; total_diskon: number; status: string
  tingkat: number; nomor_kelas: number; kelompok: string
}

const BULAN_LABEL = ['', 'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

export function SppClient({ initialSettings, initialTagihan, defaultTahun, defaultBulan }: {
  initialSettings: SppSetting[]
  initialTagihan: SppRow[]
  defaultTahun: number
  defaultBulan: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [settings, setSettings] = useState<SppSetting[]>(initialSettings)
  const [tagihan] = useState<SppRow[]>(initialTagihan)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [msg, setMsg] = useState('')
  const { page, pageSize, setPage, setPageSize, paginate, reset } = usePagination(10)

  const filtered = useMemo(() => {
    reset()
    return tagihan.filter(r => {
      const matchS = !search || r.nama_lengkap.toLowerCase().includes(search.toLowerCase())
      const matchSt = filterStatus === 'semua' || r.status === filterStatus
      return matchS && matchSt
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagihan, search, filterStatus])

  const paginated = paginate(filtered)

  async function handleSaveSetting(tingkat: number) {
    const s = settings.find(x => x.tingkat === tingkat)
    if (!s) return
    startTransition(async () => {
      const res = await updateSppSetting(s.tingkat, s.nominal, s.aktif)
      setMsg(res.error ?? res.success ?? '')
    })
  }

  async function handleGenerate() {
    startTransition(async () => {
      const res = await generateSppBulanan(defaultTahun, defaultBulan)
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) router.refresh()
    })
  }

  return (
    <Tabs defaultValue="tagihan" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <TabsList className="h-8 text-xs">
          <TabsTrigger value="tagihan" className="text-xs h-7 px-3">Daftar Tagihan</TabsTrigger>
          <TabsTrigger value="setting" className="text-xs h-7 px-3 gap-1.5">
            <Settings2 className="h-3 w-3" />Pengaturan
          </TabsTrigger>
        </TabsList>
        {msg && <p className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-md">{msg}</p>}
      </div>

      {/* Tab: Daftar Tagihan */}
      <TabsContent value="tagihan" className="space-y-3 mt-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input placeholder="Cari nama siswa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm rounded-md" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-36 text-xs rounded-md"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Status</SelectItem>
              <SelectItem value="lunas">Lunas</SelectItem>
              <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 text-xs gap-1.5 ml-auto" onClick={handleGenerate} disabled={isPending}>
            <Zap className="h-3.5 w-3.5" />
            Generate {BULAN_LABEL[defaultBulan]} {defaultTahun}
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Total Tagihan', value: formatRupiah(filtered.reduce((s, r) => s + r.nominal, 0)), color: 'text-slate-900 dark:text-slate-50' },
            { label: 'Terkumpul', value: formatRupiah(filtered.reduce((s, r) => s + r.total_dibayar, 0)), color: 'text-emerald-600' },
            { label: 'Belum Bayar', value: filtered.filter(r => r.status === 'belum_bayar').length + ' tagihan', color: 'text-rose-600' },
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
                <TableHead className="text-xs font-semibold">Periode</TableHead>
                <TableHead className="text-xs font-semibold text-right">Nominal</TableHead>
                <TableHead className="text-xs font-semibold text-right">Dibayar</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-sm text-slate-400">Tidak ada data</TableCell></TableRow>
              )}
              {paginated.map(row => (
                <TableRow key={row.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  onClick={() => router.push(`/dashboard/keuangan/siswa/${row.siswa_id}`)}>
                  <TableCell>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{row.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400">{row.nisn}</p>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                    {row.tingkat ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ?? ''}` : '-'}
                  </TableCell>
                  <TableCell className="text-sm">{BULAN_LABEL[row.bulan]} {row.tahun}</TableCell>
                  <TableCell className="text-sm text-right font-medium">{formatRupiah(row.nominal)}</TableCell>
                  <TableCell className="text-sm text-right text-emerald-600">{formatRupiah(row.total_dibayar)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      row.status === 'lunas'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                    }`}>
                      {row.status === 'lunas' ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                      {row.status === 'lunas' ? 'Lunas' : 'Belum Bayar'}
                    </span>
                  </TableCell>
                  <TableCell><ChevronRight className="h-4 w-4 text-slate-400" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataPagination
            total={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            entityLabel="tagihan"
          />
        </div>
      </TabsContent>

      {/* Tab: Pengaturan */}
      <TabsContent value="setting" className="mt-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Pengaturan SPP per Tingkat</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Nonaktifkan untuk tingkat yang tidak dikenakan SPP</p>
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
                  type="number"
                  min={0}
                  value={s.nominal}
                  onChange={e => setSettings(prev => prev.map(x => x.tingkat === s.tingkat ? { ...x, nominal: parseInt(e.target.value) || 0 } : x))}
                  className="h-9 text-sm"
                  disabled={!s.aktif}
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
  )
}
