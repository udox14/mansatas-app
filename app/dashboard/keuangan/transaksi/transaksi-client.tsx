'use client'

import { CohortCards } from '@/components/dashboard/cohort-cards'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Printer, Search, SlidersHorizontal } from 'lucide-react'
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
import { dateInputWIB, formatDateTimeWIB } from '@/lib/time'
import { getKuitansiTahunAjaran } from '@/lib/tahun-ajaran'
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
}

const KATEGORI_CLASS: Record<string, string> = {
  dspt: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  spp: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

function formatTanggal(dateString: string) {
  return formatDateTimeWIB(dateString)
}

export function TransaksiClient({
  initialData,
  tahunAjaranAktif,
  activeYears,
  initialYear,
}: {
  initialData: TransaksiRow[]
  tahunAjaranAktif: string
  activeYears: number[]
  initialYear?: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [kategori, setKategori] = useState('semua')
  const [status, setStatus] = useState('aktif')
  const [angkatan, setAngkatan] = useState(initialYear ?? 'semua')
  const [metodeBayar, setMetodeBayar] = useState('semua')
  const [tanggalAwal, setTanggalAwal] = useState('')
  const [tanggalAkhir, setTanggalAkhir] = useState('')
  const [showExtraFilters, setShowExtraFilters] = useState(false)
  const [kuitansiData, setKuitansiData] = useState<KuitansiData | null>(null)
  const [kuitansiOpen, setKuitansiOpen] = useState(false)
  const { page, pageSize, setPage, setPageSize, paginate, reset } = usePagination(15)

  const angkatanOptions = useMemo(() => {
    const unique = [...new Set(initialData.map(r => r.tahun_masuk).filter(Boolean))] as number[]
    return unique.sort((a, b) => b - a)
  }, [initialData])

  const matchingRows = useMemo(() => {
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
      const matchMetode = metodeBayar === 'semua'
        || (metodeBayar === 'tunai' ? row.metode_bayar === 'tunai' : row.metode_bayar === 'transfer' || row.metode_bayar === 'qris')
      const tanggal = dateInputWIB(row.created_at)
      const matchTanggal = (!tanggalAwal || tanggal >= tanggalAwal) && (!tanggalAkhir || tanggal <= tanggalAkhir)
      return matchSearch && matchKategori && matchStatus && matchMetode && matchTanggal
    })
  }, [initialData, search, kategori, status, metodeBayar, tanggalAwal, tanggalAkhir])

  const filtered = useMemo(() => {
    reset()
    return angkatan === 'semua' ? matchingRows : matchingRows.filter(row => String(row.tahun_masuk) === angkatan)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchingRows, angkatan])

  const cohortMetrics = Object.fromEntries(['all', ...activeYears.map(String)].map(scope => {
    const rows = matchingRows.filter(row => !row.is_void && (scope === 'all' || String(row.tahun_masuk) === scope))
    return [scope, {
      label: 'Total pembayaran sah',
      value: formatRupiah(rows.reduce((sum, row) => sum + row.jumlah_total, 0)),
      details: [{ label: 'Transaksi sah', value: rows.length.toLocaleString('id-ID') }],
    }]
  }))

  const paginated = paginate(filtered)
  const totalAktif = filtered
    .filter(row => !row.is_void)
    .reduce((sum, row) => sum + row.jumlah_total, 0)

  const extraFilterCount = (metodeBayar !== 'semua' ? 1 : 0) + (tanggalAwal ? 1 : 0) + (tanggalAkhir ? 1 : 0)
  const hasAnyFilter = Boolean(
    search.trim() || kategori !== 'semua' || status !== 'aktif' ||
    angkatan !== 'semua' || metodeBayar !== 'semua' || tanggalAwal || tanggalAkhir
  )

  function resetAllFilters() {
    setSearch('')
    setKategori('semua')
    setStatus('aktif')
    setAngkatan('semua')
    setMetodeBayar('semua')
    setTanggalAwal('')
    setTanggalAkhir('')
  }

  const openDetail = (row: TransaksiRow) => {
    router.push(`/dashboard/keuangan/siswa/${row.siswa_id}?tab=riwayat`)
  }

  const openKuitansi = (row: TransaksiRow) => {
    const kategoriLabel = row.kategori === 'dspt' ? 'DSPT' : 'SPP'
    setKuitansiData({
      nomorKuitansi: row.nomor_kuitansi,
      tanggal: row.created_at,
      kategori: kategoriLabel,
      tahunAjaran: getKuitansiTahunAjaran(tahunAjaranAktif, Boolean(row.kelas)),
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
      <CohortCards
        compact
        activeYears={activeYears}
        years={angkatanOptions}
        metrics={cohortMetrics}
        value={angkatan === 'semua' ? 'all' : angkatan}
        onChange={scope => setAngkatan(scope === 'all' ? 'semua' : scope)}
      />

      <search
        aria-label="Filter riwayat pembayaran siswa"
        className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari siswa, NISN, atau nomor kuitansi..."
              value={search}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={event => setSearch(event.target.value)}
              className="h-8 rounded-md pl-8 text-sm"
            />
          </div>
          <Select value={kategori} onValueChange={setKategori}>
            <SelectTrigger aria-label="Kategori pembayaran" className="h-8 w-36 rounded-md text-xs"><SelectValue placeholder="Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Kategori</SelectItem>
              <SelectItem value="dspt">DSPT</SelectItem>
              <SelectItem value="spp">SPP Lama</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Status transaksi" className="h-8 w-32 rounded-md text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aktif">Transaksi Sah</SelectItem>
              <SelectItem value="semua">Semua Status</SelectItem>
              <SelectItem value="void">Void / Batal</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant={showExtraFilters || extraFilterCount > 0 ? 'secondary' : 'ghost'}
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={() => setShowExtraFilters(prev => !prev)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Tanggal & Metode
            {extraFilterCount > 0 && (
              <span className="rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">{extraFilterCount}</span>
            )}
          </Button>
          {hasAnyFilter && (
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs text-slate-500" onClick={resetAllFilters}>
              Reset
            </Button>
          )}
        </div>

        {(showExtraFilters || extraFilterCount > 0) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <label htmlFor="trx-date-start" className="whitespace-nowrap text-xs font-medium text-slate-500">Dari</label>
              <Input
                id="trx-date-start"
                type="date"
                value={tanggalAwal}
                onChange={event => setTanggalAwal(event.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label htmlFor="trx-date-end" className="whitespace-nowrap text-xs font-medium text-slate-500">Sampai</label>
              <Input
                id="trx-date-end"
                type="date"
                value={tanggalAkhir}
                onChange={event => setTanggalAkhir(event.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
            <Select value={metodeBayar} onValueChange={setMetodeBayar}>
              <SelectTrigger aria-label="Metode pembayaran" className="h-8 w-36 rounded-md text-xs"><SelectValue placeholder="Metode" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua Metode</SelectItem>
                <SelectItem value="tunai">Tunai</SelectItem>
                <SelectItem value="transfer">Transfer / QRIS</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </search>

      {/* Compact Summary Strip */}
      <div className="grid grid-cols-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="px-3.5 py-2.5">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Transaksi Tampil</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">{filtered.length} transaksi</p>
        </div>
        <div className="px-3.5 py-2.5">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Nominal Sah</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatRupiah(totalAktif)}</p>
        </div>
        <div className="px-3.5 py-2.5">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Pembayaran DSPT</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">{filtered.filter(row => row.kategori === 'dspt').length} transaksi</p>
        </div>
        <div className="px-3.5 py-2.5">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Pembayaran SPP Lama</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{filtered.filter(row => row.kategori === 'spp').length} transaksi</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {/* Mobile Card View */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
          {paginated.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">Tidak ada transaksi sesuai filter.</div>
          ) : (
            paginated.map(row => (
              <div
                key={`m-${row.id}`}
                onClick={() => openDetail(row)}
                className={`cursor-pointer space-y-2 p-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${row.is_void ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${KATEGORI_CLASS[row.kategori] ?? 'bg-slate-100 text-slate-600'}`}>
                        {KATEGORI_LABEL[row.kategori] ?? row.kategori}
                      </span>
                      {row.is_void ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-600">VOID</span> : null}
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{row.nama_lengkap}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {row.kelas ?? '-'}{row.nisn ? ` · ${row.nisn}` : ''} · {row.nomor_kuitansi}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{formatTanggal(row.created_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatRupiah(row.jumlah_total)}</p>
                    <p className="text-[11px] text-slate-500">{row.metode_bayar === 'tunai' ? 'Tunai' : 'Transfer'}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-[11px] text-slate-400">Petugas: {row.nama_input ?? '-'}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!!row.is_void}
                    className="h-7 gap-1 px-2.5 text-xs"
                    onClick={event => {
                      event.stopPropagation()
                      openKuitansi(row)
                    }}
                  >
                    <Printer className="h-3 w-3" /> Kuitansi
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div role="region" aria-label="Tabel pembayaran siswa" tabIndex={0} className="hidden overflow-x-auto md:block">
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
                    Tidak ada transaksi sesuai filter.
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
                    <p className="font-mono text-xs font-medium text-slate-700 dark:text-slate-200">{row.nomor_kuitansi}</p>
                    {row.void_alasan ? <p className="text-[10px] text-rose-500">{row.void_alasan}</p> : null}
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {row.metode_bayar === 'tunai' ? 'Tunai' : 'Transfer'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(row.jumlah_total)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">{row.nama_input ?? '-'}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!!row.is_void}
                      title={row.is_void ? 'Transaksi void tidak bisa dicetak' : 'Cetak kuitansi'}
                      className="h-7 gap-1 px-2 text-[11px]"
                      onClick={event => {
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
        </div>

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
