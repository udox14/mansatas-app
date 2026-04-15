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
import { Plus, Trash2, TrendingDown } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { catatKasKeluar, hapusKasKeluar } from '../actions'
import { DataPagination, usePagination } from '@/components/ui/data-pagination'

interface KasRow {
  id: string; jumlah: number; keterangan: string; kategori: string
  metode: string; tanggal: string; nama_pembuat: string
}

const BULAN_LABEL = ['', 'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const KATEGORI_LIST = ['Operasional', 'Pemeliharaan', 'Kegiatan Siswa', 'Administrasi', 'Lainnya']

export function KasKeluarClient({ initialData, defaultTahun, defaultBulan }: {
  initialData: KasRow[]
  defaultTahun: number
  defaultBulan: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    jumlah: '', keterangan: '', kategori: 'Operasional', metode: 'tunai', tanggal: new Date().toISOString().slice(0, 10),
  })
  const { page, pageSize, setPage, setPageSize, paginate } = usePagination(10)

  const total = initialData.reduce((s, r) => s + r.jumlah, 0)
  const paginated = paginate(initialData)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.jumlah || !form.keterangan) { setMsg('Jumlah dan keterangan wajib diisi'); return }
    startTransition(async () => {
      const res = await catatKasKeluar({
        jumlah: parseInt(form.jumlah),
        keterangan: form.keterangan,
        kategori: form.kategori,
        metode: form.metode as 'tunai' | 'transfer',
        tanggal: form.tanggal,
      })
      setMsg(res.error ?? res.success ?? '')
      if (!res.error) { setOpen(false); router.refresh() }
    })
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      const res = await hapusKasKeluar(id)
      setMsg(res.error ?? res.success ?? '')
      setDeleteConfirm(null)
      if (!res.error) router.refresh()
    })
  }

  return (
    <div className="space-y-3 pb-8">
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
          <TrendingDown className="h-4 w-4 text-rose-500" />
          <div>
            <p className="text-[11px] text-slate-500">Total Keluar Bulan Ini</p>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatRupiah(total)}</p>
          </div>
        </div>
        <div className="ml-auto">
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Catat Pengeluaran
          </Button>
        </div>
      </div>

      {msg && <p className={`text-xs px-3 py-2 rounded-md ${msg.includes('berhasil') ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>{msg}</p>}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="text-xs font-semibold">Tanggal</TableHead>
              <TableHead className="text-xs font-semibold">Keterangan</TableHead>
              <TableHead className="text-xs font-semibold">Kategori</TableHead>
              <TableHead className="text-xs font-semibold">Metode</TableHead>
              <TableHead className="text-xs font-semibold text-right">Jumlah</TableHead>
              <TableHead className="text-xs font-semibold">Dicatat oleh</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-sm text-slate-400">Tidak ada data pengeluaran</TableCell></TableRow>
            )}
            {paginated.map(row => (
              <TableRow key={row.id}>
                <TableCell className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {new Date(row.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </TableCell>
                <TableCell className="text-sm font-medium text-slate-900 dark:text-slate-50 max-w-[200px]">
                  <p className="truncate">{row.keterangan}</p>
                </TableCell>
                <TableCell>
                  <span className="text-[11px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
                    {row.kategori}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    row.metode === 'tunai'
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {row.metode === 'tunai' ? 'Tunai' : 'Transfer'}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-right font-semibold text-rose-600 dark:text-rose-400">
                  {formatRupiah(row.jumlah)}
                </TableCell>
                <TableCell className="text-xs text-slate-400">{row.nama_pembuat}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                    onClick={() => setDeleteConfirm(row.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <DataPagination
          total={initialData.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          entityLabel="transaksi"
        />
      </div>

      {/* Form Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b">
            <DialogTitle className="text-sm font-semibold">Catat Pengeluaran</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tanggal</Label>
              <Input type="date" value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Keterangan</Label>
              <Input placeholder="Deskripsi pengeluaran..." value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Kategori</Label>
                <Select value={form.kategori} onValueChange={v => setForm(f => ({ ...f, kategori: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KATEGORI_LIST.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Metode</Label>
                <Select value={form.metode} onValueChange={v => setForm(f => ({ ...f, metode: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tunai">Tunai</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Jumlah (Rp)</Label>
              <Input type="number" min={0} value={form.jumlah} onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))} className="h-9 text-sm" placeholder="0" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending}>
                {isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={v => { if (!v) setDeleteConfirm(null) }}>
        <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-rose-50 dark:bg-rose-900/20 border-b border-rose-200 dark:border-rose-800">
            <DialogTitle className="text-sm font-semibold text-rose-700 dark:text-rose-400">Hapus Pengeluaran?</DialogTitle>
          </DialogHeader>
          <div className="p-5">
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Data pengeluaran ini akan dihapus permanen.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setDeleteConfirm(null)}>Batal</Button>
              <Button variant="destructive" size="sm" className="flex-1 h-9 text-sm" disabled={isPending}
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
                {isPending ? 'Menghapus...' : 'Ya, Hapus'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
