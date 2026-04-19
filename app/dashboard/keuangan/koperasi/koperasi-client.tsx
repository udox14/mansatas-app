'use client'

import { useState, useMemo, useTransition, useEffect } from 'react'
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
import { Search, ChevronRight, CheckCircle2, Clock, XCircle, Plus, Settings2, RefreshCw, Trash2 } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { saveMasterItem, generateKoperasiTagihanBulk, hapusMasterItem } from '../actions'
import { DataPagination, usePagination } from '@/components/ui/data-pagination'

interface TagihanRow {
  id: string; siswa_id: string; nama_lengkap: string; nisn: string
  total_nominal: number; total_dibayar: number; total_diskon: number; status: string
  tingkat: number; nomor_kelas: number; kelompok: string; tahun_masuk: number
  nama_tahun_ajaran: string
}
interface MasterItem { id: string; nama_item: string; nominal_default: number; aktif: number; urutan: number }

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  lunas: { label: 'Lunas', cls: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-400' },
  nyicil: { label: 'Sebagian', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  belum_bayar: { label: 'Belum Bayar', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
}

export function KoperasiClient({ initialTagihan, masterItem, isBendahara, tahunAjaranId }: {
  initialTagihan: TagihanRow[]
  masterItem: MasterItem[]
  isBendahara: boolean
  tahunAjaranId?: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [filterAngkatan, setFilterAngkatan] = useState('semua')
  const [filterKelas, setFilterKelas] = useState('semua')
  const [items, setItems] = useState<MasterItem[]>(masterItem)
  const [tagihan, setTagihan] = useState<TagihanRow[]>(initialTagihan)
  const [isPending, startTransition] = useTransition()
  const [editItem, setEditItem] = useState<MasterItem | null>(null)
  const [showItemModal, setShowItemModal] = useState(false)
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<MasterItem | null>(null)
  const [itemForm, setItemForm] = useState({ nama_item: '', nominal_default: '', urutan: '' })
  const [msg, setMsg] = useState('')
  const { page, pageSize, setPage, setPageSize, paginate, reset } = usePagination(10)

  // Sync state saat server kirim data baru via router.refresh()
  useEffect(() => { setTagihan(initialTagihan) }, [initialTagihan])
  useEffect(() => { setItems(masterItem) }, [masterItem])

  const angkatanList = useMemo(() => {
    const years = [...new Set(tagihan.map(d => d.tahun_masuk).filter(Boolean))].sort((a, b) => b - a)
    return years
  }, [tagihan])

  const kelasList = useMemo(() => {
    const set = new Set<string>()
    tagihan.forEach(d => { if (d.tingkat && d.nomor_kelas) set.add(`${d.tingkat}-${d.nomor_kelas}${d.kelompok ? ' ' + d.kelompok : ''}`) })
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
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

  function openEdit(item: MasterItem | null) {
    setEditItem(item)
    setItemForm(item
      ? { nama_item: item.nama_item, nominal_default: String(item.nominal_default), urutan: String(item.urutan) }
      : { nama_item: '', nominal_default: '', urutan: '' })
    setShowItemModal(true)
  }

  function handleGenerate() {
    if (!tahunAjaranId) { setMsg('Tahun ajaran aktif tidak ditemukan'); return }
    if (!confirm('Generate tagihan koperasi untuk semua siswa kelas 10 yang belum memiliki tagihan?')) return
    startTransition(async () => {
      const res = await generateKoperasiTagihanBulk(tahunAjaranId)
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) router.refresh()
    })
  }

  async function handleHapusItem(item: MasterItem) {
    startTransition(async () => {
      const res = await hapusMasterItem(item.id)
      setMsg(res.error ?? res.success ?? '')
      setDeleteItemConfirm(null)
      if (!res.error) router.refresh()
    })
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await saveMasterItem({
        id: editItem?.id,
        nama_item: itemForm.nama_item,
        nominal_default: parseInt(itemForm.nominal_default) || 0,
        urutan: parseInt(itemForm.urutan) || 0,
      })
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) { setEditItem(null); setShowItemModal(false); router.refresh() }
    })
  }

  return (
    <>
    <Tabs defaultValue="tagihan" className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <TabsList className="h-8 text-xs">
          <TabsTrigger value="tagihan" className="text-xs h-7 px-3">Daftar Tagihan</TabsTrigger>
          {isBendahara && (
            <TabsTrigger value="master" className="text-xs h-7 px-3 gap-1.5">
              <Settings2 className="h-3 w-3" />Master Item
            </TabsTrigger>
          )}
        </TabsList>
        {msg && <p className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:bg-emerald-900/20 px-3 py-1 rounded-md">{msg}</p>}
      </div>

      {/* Tab Tagihan */}
      <TabsContent value="tagihan" className="space-y-3 mt-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-wrap gap-2 items-center justify-between">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input placeholder="Cari nama siswa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm rounded-md" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-36 text-xs rounded-md"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Status</SelectItem>
              <SelectItem value="lunas">Lunas</SelectItem>
              <SelectItem value="nyicil">Sebagian</SelectItem>
              <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
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
          {isBendahara && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 ml-auto" onClick={handleGenerate} disabled={isPending}>
              <RefreshCw className="h-3 w-3" /> Generate Tagihan
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Total Tagihan', value: formatRupiah(filtered.reduce((s, r) => s + r.total_nominal, 0)), color: 'text-slate-900 dark:text-slate-50' },
            { label: 'Terkumpul', value: formatRupiah(filtered.reduce((s, r) => s + r.total_dibayar, 0)), color: 'text-emerald-600' },
            { label: 'Sisa', value: formatRupiah(filtered.reduce((s, r) => s + (r.total_nominal - r.total_dibayar - r.total_diskon), 0)), color: 'text-rose-600' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.label}</p>
              <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead className="text-xs font-semibold">Nama Siswa</TableHead>
                <TableHead className="text-xs font-semibold">Angkatan</TableHead>
                <TableHead className="text-xs font-semibold text-right">Total Tagihan</TableHead>
                <TableHead className="text-xs font-semibold text-right">Dibayar</TableHead>
                <TableHead className="text-xs font-semibold text-right">Sisa</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-sm text-slate-400">Tidak ada data</TableCell></TableRow>
              )}
              {paginated.map(row => {
                const sisa = row.total_nominal - row.total_dibayar - row.total_diskon
                const s = STATUS_MAP[row.status] ?? STATUS_MAP.belum_bayar
                return (
                  <TableRow key={row.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    onClick={() => router.push(`/dashboard/keuangan/siswa/${row.siswa_id}?tab=koperasi`)}>
                    <TableCell>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{row.nama_lengkap}</p>
                      <p className="text-[11px] text-slate-400">{row.nisn}</p>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-400">{row.tahun_masuk}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{formatRupiah(row.total_nominal)}</TableCell>
                    <TableCell className="text-sm text-right text-emerald-600 font-medium">{formatRupiah(row.total_dibayar)}</TableCell>
                    <TableCell className="text-sm text-right text-rose-600 font-medium">{formatRupiah(sisa)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex text-[11px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                    </TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-slate-400" /></TableCell>
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

      {/* Tab Master Item */}
      {isBendahara && (
        <TabsContent value="master" className="mt-0 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => openEdit(null)}>
              <Plus className="h-3.5 w-3.5" /> Tambah Item
            </Button>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="text-xs font-semibold">No</TableHead>
                  <TableHead className="text-xs font-semibold">Nama Item</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Nominal Default</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm text-slate-400">{idx + 1}</TableCell>
                    <TableCell className="text-sm font-medium text-slate-900 dark:text-slate-50">{item.nama_item}</TableCell>
                    <TableCell className="text-sm text-right">{formatRupiah(item.nominal_default)}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${item.aktif ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400'}`}>
                        {item.aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(item)}>Edit</Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => setDeleteItemConfirm(item)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-slate-400">Belum ada item</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Edit/Tambah Modal */}
          <Dialog open={showItemModal} onOpenChange={v => { if (!v) { setShowItemModal(false); setEditItem(null); setItemForm({ nama_item: '', nominal_default: '', urutan: '' }) }}}>
            <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
              <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
                <DialogTitle className="text-sm font-semibold">{editItem ? 'Edit Item' : 'Tambah Item'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveItem} className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nama Item</Label>
                  <Input value={itemForm.nama_item} onChange={e => setItemForm(f => ({ ...f, nama_item: e.target.value }))} className="h-9 text-sm" placeholder="Seragam Olahraga, Batik, dll" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nominal Default</Label>
                  <Input type="number" value={itemForm.nominal_default} onChange={e => setItemForm(f => ({ ...f, nominal_default: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Urutan Tampil</Label>
                  <Input type="number" value={itemForm.urutan} onChange={e => setItemForm(f => ({ ...f, urutan: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm"
                    onClick={() => { setShowItemModal(false); setEditItem(null); setItemForm({ nama_item: '', nominal_default: '', urutan: '' }) }}>
                    Batal
                  </Button>
                  <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending}>
                    {isPending ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>
      )}
    </Tabs>

    {/* Konfirmasi Hapus Item */}
    <Dialog open={!!deleteItemConfirm} onOpenChange={v => { if (!v) setDeleteItemConfirm(null) }}>
      <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 bg-rose-50 dark:bg-rose-900/20 border-b border-rose-200 dark:border-rose-800">
          <DialogTitle className="text-sm font-semibold text-rose-700 dark:text-rose-400">Hapus Item Koperasi?</DialogTitle>
        </DialogHeader>
        <div className="p-5">
          <p className="text-sm text-slate-600 dark:text-slate-400 dark:text-slate-300 mb-1">Item <strong>{deleteItemConfirm?.nama_item}</strong> akan dihapus permanen.</p>
          <p className="text-xs text-slate-400 mb-4">Item yang sudah dipakai di tagihan tidak bisa dihapus.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setDeleteItemConfirm(null)}>Batal</Button>
            <Button variant="destructive" size="sm" className="flex-1 h-9 text-sm" disabled={isPending}
              onClick={() => deleteItemConfirm && handleHapusItem(deleteItemConfirm)}>
              {isPending ? 'Menghapus...' : 'Ya, Hapus'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
