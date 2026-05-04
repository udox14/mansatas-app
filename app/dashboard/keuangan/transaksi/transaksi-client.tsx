'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Printer, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { DataPagination, usePagination } from '@/components/ui/data-pagination'
import { formatRupiah } from '@/lib/utils'
import { KuitansiModal, type KuitansiData } from '../components/kuitansi-print'

interface TransaksiRow {
  id: string
  nomor_kuitansi: string
  siswa_id: string
  nama_lengkap: string
  nisn: string | null
  tahun_masuk: number | null
  kelas: string | null
  kategori: string
  metode_bayar: string
  jumlah_total: number
  is_void: number
  void_alasan: string | null
  created_at: string
  nama_input: string | null
  rincian: string | null
}

const KATEGORI_LABEL: Record<string, string> = {
  dspt: 'DSPT',
  spp: 'SPP',
  koperasi: 'Koperasi',
}

const KATEGORI_CLASS: Record<string, string> = {
  dspt: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  spp: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  koperasi: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

function formatTanggal(dateString: string) {
  return new Date(dateString).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TransaksiClient({ initialData }: { initialData: TransaksiRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [kategori, setKategori] = useState('semua')
  const [status, setStatus] = useState('aktif')
  const [kuitansiData, setKuitansiData] = useState<KuitansiData | null>(null)
  const [kuitansiOpen, setKuitansiOpen] = useState(false)
  const { page, pageSize, setPage, setPageSize, paginate, reset } = usePagination(15)

  const filtered = useMemo(() => {
    reset()
    const term = search.trim().toLowerCase()
    return initialData.filter(row => {
      const matchSearch = !term
        || row.nama_lengkap.toLowerCase().includes(term)
        || (row.nisn ?? '').toLowerCase().includes(term)
        || row.nomor_kuitansi.toLowerCase().includes(term)
      const matchKategori = kategori === 'semua' || row.kategori === kategori
      const matchStatus = status === 'semua'
        || (status === 'aktif' && !row.is_void)
        || (status === 'void' && !!row.is_void)
      return matchSearch && matchKategori && matchStatus
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, search, kategori, status])

  const paginated = paginate(filtered)
  const totalAktif = filtered
    .filter(row => !row.is_void)
    .reduce((sum, row) => sum + row.jumlah_total, 0)

  const openDetail = (row: TransaksiRow) => {
    router.push(`/dashboard/keuangan/siswa/${row.siswa_id}?tab=riwayat`)
  }

  const openKuitansi = (row: TransaksiRow) => {
    const kategoriLabel = row.kategori === 'dspt' ? 'DSPT' : row.kategori === 'spp' ? 'SPP' : 'Koperasi'
    setKuitansiData({
      nomorKuitansi: row.nomor_kuitansi,
      tanggal: row.created_at,
      kategori: kategoriLabel,
      namaSiswa: row.nama_lengkap,
      nisn: row.nisn ?? '-',
      kelas: row.kelas ?? '-',
      namaPerugas: row.nama_input ?? 'Bendahara Komite',
      metodeBayar: row.metode_bayar === 'tunai' ? 'Tunai' : 'Transfer Bank',
      jumlahDiserahkan: row.jumlah_total,
      jumlahTagihan: row.jumlah_total,
      rincianBayar: [{ label: `Pembayaran ${kategoriLabel}`, nominal: row.jumlah_total }],
      sisaTunggakan: [],
      isLunas: !row.is_void,
    })
    setKuitansiOpen(true)
  }

  return (
    <div className="space-y-3 pb-8">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Transaksi Tampil</p>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{filtered.length} transaksi</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Aktif</p>
          <p className="text-sm font-bold text-emerald-600">{formatRupiah(totalAktif)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">DSPT</p>
          <p className="text-sm font-bold text-blue-600">{filtered.filter(row => row.kategori === 'dspt').length} transaksi</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Koperasi</p>
          <p className="text-sm font-bold text-amber-600">{filtered.filter(row => row.kategori === 'koperasi').length} transaksi</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Cari siswa, NISN, atau nomor kuitansi..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="h-8 rounded-md pl-8 text-sm"
          />
        </div>
        <Select value={kategori} onValueChange={setKategori}>
          <SelectTrigger className="h-8 w-36 rounded-md text-xs"><SelectValue placeholder="Kategori" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Kategori</SelectItem>
            <SelectItem value="dspt">DSPT</SelectItem>
            <SelectItem value="spp">SPP</SelectItem>
            <SelectItem value="koperasi">Koperasi</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-32 rounded-md text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aktif">Aktif</SelectItem>
            <SelectItem value="semua">Semua Status</SelectItem>
            <SelectItem value="void">Void</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="text-xs font-semibold">Waktu</TableHead>
              <TableHead className="text-xs font-semibold">Siswa</TableHead>
              <TableHead className="text-xs font-semibold">Kategori</TableHead>
              <TableHead className="text-xs font-semibold">No. Kuitansi</TableHead>
              <TableHead className="text-xs font-semibold">Metode</TableHead>
              <TableHead className="text-right text-xs font-semibold">Jumlah</TableHead>
              <TableHead className="text-xs font-semibold">Petugas</TableHead>
              <TableHead className="w-24 text-xs font-semibold">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-400">
                  Tidak ada transaksi
                </TableCell>
              </TableRow>
            )}
            {paginated.map(row => (
              <TableRow
                key={row.id}
                onClick={() => openDetail(row)}
                className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${row.is_void ? 'opacity-60' : ''}`}
              >
                <TableCell className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                  {formatTanggal(row.created_at)}
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{row.nama_lengkap}</p>
                  <p className="text-[11px] text-slate-400">
                    {row.kelas ?? '-'}{row.nisn ? ` · ${row.nisn}` : ''}
                  </p>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${KATEGORI_CLASS[row.kategori] ?? 'bg-slate-100 text-slate-600'}`}>
                    {KATEGORI_LABEL[row.kategori] ?? row.kategori}
                  </span>
                  {row.is_void ? (
                    <p className="mt-1 text-[10px] font-semibold text-rose-500">VOID</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{row.nomor_kuitansi}</p>
                  {row.void_alasan ? <p className="text-[10px] text-rose-500">{row.void_alasan}</p> : null}
                </TableCell>
                <TableCell>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {row.metode_bayar === 'tunai' ? 'Tunai' : 'Transfer'}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm font-semibold text-emerald-600">
                  {formatRupiah(row.jumlah_total)}
                </TableCell>
                <TableCell className="text-xs text-slate-400">{row.nama_input ?? '-'}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!!row.is_void}
                    title={row.is_void ? 'Transaksi void tidak bisa dicetak' : 'Print kuitansi'}
                    className="h-7 gap-1 px-2 text-[11px]"
                    onClick={(event) => {
                      event.stopPropagation()
                      openKuitansi(row)
                    }}
                  >
                    <Printer className="h-3 w-3" /> Print
                  </Button>
                </TableCell>
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
          entityLabel="transaksi"
        />
      </div>
      <KuitansiModal
        data={kuitansiData}
        open={kuitansiOpen}
        onClose={() => { setKuitansiOpen(false); setKuitansiData(null) }}
      />
    </div>
  )
}
