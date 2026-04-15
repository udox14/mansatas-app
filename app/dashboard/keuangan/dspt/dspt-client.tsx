'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Search, ChevronRight, CheckCircle2, Clock, XCircle, Minus, Plus } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { createDspt, searchSiswa } from '../actions'
import { DataPagination, usePagination } from '@/components/ui/data-pagination'

interface DsptRow {
  id: string | null
  siswa_id: string
  nama_lengkap: string
  nisn: string
  tahun_masuk: number
  nominal_target: number | null
  total_dibayar: number | null
  total_diskon: number | null
  status: 'belum_bayar' | 'nyicil' | 'lunas' | 'tidak_ada'
  tingkat: number | null
  nomor_kelas: string | null
  kelompok: string | null
}

const STATUS_MAP = {
  lunas:       { label: 'Lunas',       icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  nyicil:      { label: 'Nyicil',      icon: Clock,        cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  belum_bayar: { label: 'Belum Bayar', icon: XCircle,      cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  tidak_ada:   { label: 'Belum Diinput', icon: Minus,      cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
}

export function DsptClient({ initialData }: { initialData: DsptRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [filterAngkatan, setFilterAngkatan] = useState('semua')

  // Modal input DSPT baru
  const [modalSiswa, setModalSiswa] = useState<DsptRow | null>(null)
  const [nominal, setNominal] = useState('')
  const [catatan, setCatatan] = useState('')
  const [modalMsg, setModalMsg] = useState('')

  // Modal tambah manual (cari siswa)
  const [addModal, setAddModal] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [addResults, setAddResults] = useState<any[]>([])
  const [addNominal, setAddNominal] = useState('')
  const [addCatatan, setAddCatatan] = useState('')
  const [addSelected, setAddSelected] = useState<any | null>(null)
  const [addMsg, setAddMsg] = useState('')

  const { page, pageSize, setPage, setPageSize, paginate, reset } = usePagination(10)

  const angkatanList = useMemo(() => {
    const years = [...new Set(initialData.map(d => d.tahun_masuk).filter(Boolean))].sort((a, b) => b - a)
    return years
  }, [initialData])

  const filtered = useMemo(() => {
    reset()
    return initialData.filter(row => {
      const matchSearch = !search || row.nama_lengkap.toLowerCase().includes(search.toLowerCase()) || row.nisn?.includes(search)
      const matchStatus = filterStatus === 'semua' || row.status === filterStatus
      const matchAngkatan = filterAngkatan === 'semua' || String(row.tahun_masuk) === filterAngkatan
      return matchSearch && matchStatus && matchAngkatan
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, search, filterStatus, filterAngkatan])

  const paginated = paginate(filtered)

  const withDspt = filtered.filter(r => r.status !== 'tidak_ada')
  const totalTarget  = withDspt.reduce((s, r) => s + (r.nominal_target ?? 0), 0)
  const totalDibayar = withDspt.reduce((s, r) => s + (r.total_dibayar ?? 0), 0)
  const totalDiskon  = withDspt.reduce((s, r) => s + (r.total_diskon ?? 0), 0)
  const totalSisa    = totalTarget - totalDibayar - totalDiskon

  function openSetDspt(row: DsptRow) {
    setModalSiswa(row)
    setNominal('')
    setCatatan('')
    setModalMsg('')
  }

  async function handleSetDspt(e: React.FormEvent) {
    e.preventDefault()
    if (!modalSiswa || !nominal) return
    startTransition(async () => {
      const res = await createDspt(modalSiswa.siswa_id, parseInt(nominal), catatan)
      if (res.error) { setModalMsg(res.error); return }
      setModalSiswa(null)
      router.refresh()
    })
  }

  async function handleAddSearch() {
    if (addSearch.trim().length < 2) return
    const res = await searchSiswa(addSearch)
    setAddResults(res.data)
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!addSelected || !addNominal) { setAddMsg('Pilih siswa dan isi nominal'); return }
    startTransition(async () => {
      const res = await createDspt(addSelected.id, parseInt(addNominal), addCatatan)
      if (res.error) { setAddMsg(res.error); return }
      setAddModal(false); setAddSelected(null); setAddSearch(''); setAddNominal(''); setAddCatatan(''); setAddResults([])
      router.refresh()
    })
  }

  return (
    <div className="space-y-3 pb-8">
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input placeholder="Cari nama atau NISN..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm rounded-md" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-36 text-xs rounded-md"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Status</SelectItem>
            <SelectItem value="lunas">Lunas</SelectItem>
            <SelectItem value="nyicil">Nyicil</SelectItem>
            <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
            <SelectItem value="tidak_ada">Belum Diinput</SelectItem>
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
        <Button size="sm" className="h-8 text-xs gap-1.5 ml-auto" onClick={() => { setAddModal(true); setAddMsg('') }}>
          <Plus className="h-3.5 w-3.5" /> Input Manual
        </Button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Total Target', value: formatRupiah(totalTarget), color: 'text-slate-900 dark:text-slate-50' },
          { label: 'Terkumpul', value: formatRupiah(totalDibayar), color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Diskon', value: formatRupiah(totalDiskon), color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Sisa Tunggakan', value: formatRupiah(totalSisa), color: 'text-rose-600 dark:text-rose-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
            <p className="text-[11px] text-slate-500">{s.label}</p>
            <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="text-xs font-semibold">Nama Siswa</TableHead>
              <TableHead className="text-xs font-semibold">Angkatan</TableHead>
              <TableHead className="text-xs font-semibold">Kelas</TableHead>
              <TableHead className="text-xs font-semibold text-right">Target</TableHead>
              <TableHead className="text-xs font-semibold text-right">Dibayar</TableHead>
              <TableHead className="text-xs font-semibold text-right">Sisa</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-slate-400 text-sm">Tidak ada data</TableCell>
              </TableRow>
            )}
            {paginated.map(row => {
              const sisa = (row.nominal_target ?? 0) - (row.total_dibayar ?? 0) - (row.total_diskon ?? 0)
              const s = STATUS_MAP[row.status] ?? STATUS_MAP.tidak_ada
              const Icon = s.icon
              const belumInput = row.status === 'tidak_ada'
              return (
                <TableRow
                  key={row.siswa_id}
                  className={`transition-colors ${belumInput ? 'opacity-60' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  onClick={() => belumInput ? openSetDspt(row) : router.push(`/dashboard/keuangan/siswa/${row.siswa_id}`)}
                >
                  <TableCell>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{row.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400">{row.nisn ?? '-'}</p>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">{row.tahun_masuk}</TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                    {row.tingkat ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ?? ''}` : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-right font-medium">{belumInput ? '-' : formatRupiah(row.nominal_target ?? 0)}</TableCell>
                  <TableCell className="text-sm text-right text-emerald-600 font-medium">{belumInput ? '-' : formatRupiah(row.total_dibayar ?? 0)}</TableCell>
                  <TableCell className={`text-sm text-right font-medium ${sisa > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {belumInput ? '-' : formatRupiah(sisa)}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
                      <Icon className="h-2.5 w-2.5" />{s.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    {belumInput
                      ? <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={e => { e.stopPropagation(); openSetDspt(row) }}>Input</Button>
                      : <ChevronRight className="h-4 w-4 text-slate-400" />
                    }
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
        <div className="px-4 py-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          {withDspt.length} dari {filtered.length} sudah diinput DSPT
        </div>
      </div>

      {/* Modal: Input DSPT untuk siswa yang belum */}
      <Dialog open={!!modalSiswa} onOpenChange={v => { if (!v) setModalSiswa(null) }}>
        <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
            <DialogTitle className="text-sm font-semibold">Input Target DSPT</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSetDspt} className="p-5 space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{modalSiswa?.nama_lengkap}</p>
              <p className="text-[11px] text-slate-500">{modalSiswa?.nisn ?? '-'} · Angkatan {modalSiswa?.tahun_masuk}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nominal Target DSPT (Rp)</Label>
              <Input type="number" min={0} value={nominal} onChange={e => setNominal(e.target.value)}
                className="h-9 text-sm" placeholder="Contoh: 5000000" autoFocus />
              <p className="text-[11px] text-slate-400">Sesuai kesepakatan saat pendaftaran</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Catatan (opsional)</Label>
              <Input value={catatan} onChange={e => setCatatan(e.target.value)} className="h-9 text-sm" placeholder="Anak guru, beasiswa, dll" />
            </div>
            {modalMsg && <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-md">{modalMsg}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setModalSiswa(null)}>Batal</Button>
              <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending || !nominal}>
                {isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Tambah manual dengan cari siswa */}
      <Dialog open={addModal} onOpenChange={v => { if (!v) setAddModal(false) }}>
        <DialogContent className="sm:max-w-md rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
            <DialogTitle className="text-sm font-semibold">Input Manual DSPT</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cari Siswa</Label>
              <div className="flex gap-2">
                <Input value={addSearch} onChange={e => setAddSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSearch())}
                  className="h-9 text-sm flex-1" placeholder="Ketik nama atau NISN, tekan Enter..." />
                <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={handleAddSearch}>Cari</Button>
              </div>
            </div>
            {addResults.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {addResults.map((s: any) => (
                  <button key={s.id} type="button"
                    onClick={() => setAddSelected(s)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 border-b last:border-b-0 border-slate-100 dark:border-slate-700 transition-colors ${addSelected?.id === s.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  >
                    <p className="font-medium text-slate-900 dark:text-slate-50">{s.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400">{s.nisn ?? '-'} · {s.tingkat ? `Kelas ${s.tingkat}` : 'Kelas -'} · Angkatan {s.tahun_masuk}</p>
                  </button>
                ))}
              </div>
            )}
            {addSelected && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Dipilih: {addSelected.nama_lengkap}</p>
              </div>
            )}
            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nominal Target DSPT (Rp)</Label>
                <Input type="number" min={0} value={addNominal} onChange={e => setAddNominal(e.target.value)} className="h-9 text-sm" placeholder="5000000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Catatan (opsional)</Label>
                <Input value={addCatatan} onChange={e => setAddCatatan(e.target.value)} className="h-9 text-sm" placeholder="Anak guru, beasiswa, dll" />
              </div>
              {addMsg && <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-md">{addMsg}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setAddModal(false)}>Batal</Button>
                <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending || !addSelected || !addNominal}>
                  {isPending ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
