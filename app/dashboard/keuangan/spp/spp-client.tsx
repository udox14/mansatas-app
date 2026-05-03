'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { DataPagination, usePagination } from '@/components/ui/data-pagination'
import { formatRupiah } from '@/lib/utils'

interface SppTunggakanRow {
  id: string
  siswa_id: string
  nama_lengkap: string
  nisn: string | null
  tahun_masuk: number | null
  tingkat: number | null
  nomor_kelas: number | null
  kelompok: string | null
  jumlah: number
  total_dibayar: number
  status: string
  keterangan: string | null
}

interface SppTunggakanStats {
  total: number
  total_jumlah: number
  total_dibayar: number
  total_sisa: number
}

export function SppClient({
  tunggakanList,
  tunggakanStats,
  angkatanList,
}: {
  tunggakanList: SppTunggakanRow[]
  tunggakanStats: SppTunggakanStats | null
  angkatanList: number[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterAngkatan, setFilterAngkatan] = useState('semua')
  const [filterKelas, setFilterKelas] = useState('semua')
  const { page, pageSize, setPage, setPageSize, paginate, reset } = usePagination(10)

  const kelasList = useMemo(() => {
    const set = new Set<string>()
    tunggakanList.forEach(row => {
      if (row.tingkat && row.nomor_kelas) {
        set.add(`${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ' ' + row.kelompok : ''}`)
      }
    })
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  }, [tunggakanList])

  const filtered = useMemo(() => {
    reset()
    const term = search.trim().toLowerCase()
    return tunggakanList.filter(row => {
      const kelas = row.tingkat && row.nomor_kelas
        ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ' ' + row.kelompok : ''}`
        : '-'
      const matchSearch = !term
        || row.nama_lengkap.toLowerCase().includes(term)
        || (row.nisn ?? '').toLowerCase().includes(term)
      const matchAngkatan = filterAngkatan === 'semua' || String(row.tahun_masuk) === filterAngkatan
      const matchKelas = filterKelas === 'semua' || kelas === filterKelas
      return matchSearch && matchAngkatan && matchKelas
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tunggakanList, search, filterAngkatan, filterKelas])

  const paginated = paginate(filtered)
  const filteredTotal = filtered.reduce((sum, row) => sum + Math.max(0, row.jumlah - (row.total_dibayar ?? 0)), 0)

  function getKelas(row: SppTunggakanRow) {
    return row.tingkat && row.nomor_kelas
      ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ' ' + row.kelompok : ''}`
      : '-'
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/10">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Mode SPP: hanya tunggakan terdahulu</p>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          Pembayaran SPP bulanan reguler dinonaktifkan. Halaman ini hanya menampilkan siswa yang masih punya sisa tunggakan awal.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Siswa Ditagih', value: `${tunggakanStats?.total ?? 0} siswa`, color: 'text-slate-900 dark:text-slate-50' },
          { label: 'Total Tunggakan', value: formatRupiah(tunggakanStats?.total_jumlah ?? 0), color: 'text-slate-900 dark:text-slate-50' },
          { label: 'Sudah Dibayar', value: formatRupiah(tunggakanStats?.total_dibayar ?? 0), color: 'text-emerald-600' },
          { label: 'Sisa Ditagih', value: formatRupiah(filteredTotal), color: 'text-rose-600' },
        ].map(item => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Cari nama atau NISN..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="h-8 rounded-md pl-8 text-sm"
          />
        </div>
        <Select value={filterAngkatan} onValueChange={setFilterAngkatan}>
          <SelectTrigger className="h-8 w-36 rounded-md text-xs"><SelectValue placeholder="Angkatan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Angkatan</SelectItem>
            {angkatanList.map(year => (
              <SelectItem key={year} value={String(year)}>Angkatan {year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterKelas} onValueChange={setFilterKelas}>
          <SelectTrigger className="h-8 w-32 rounded-md text-xs"><SelectValue placeholder="Kelas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Kelas</SelectItem>
            {kelasList.map(kelas => (
              <SelectItem key={kelas} value={kelas}>Kelas {kelas}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="text-xs font-semibold">Nama Siswa</TableHead>
              <TableHead className="text-xs font-semibold">Kelas</TableHead>
              <TableHead className="text-right text-xs font-semibold">Total Tunggakan</TableHead>
              <TableHead className="text-right text-xs font-semibold">Dibayar</TableHead>
              <TableHead className="text-right text-xs font-semibold">Sisa</TableHead>
              <TableHead className="text-xs font-semibold">Keterangan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-400">
                  Tidak ada siswa dengan tunggakan terdahulu
                </TableCell>
              </TableRow>
            )}
            {paginated.map(row => {
              const sisa = Math.max(0, row.jumlah - (row.total_dibayar ?? 0))
              return (
                <TableRow
                  key={row.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  onClick={() => router.push(`/dashboard/keuangan/siswa/${row.siswa_id}?tab=spp`)}
                >
                  <TableCell>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{row.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400">{row.nisn ?? '-'}</p>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">{getKelas(row)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatRupiah(row.jumlah)}</TableCell>
                  <TableCell className="text-right text-sm text-emerald-600">{formatRupiah(row.total_dibayar ?? 0)}</TableCell>
                  <TableCell className="text-right text-sm font-bold text-rose-600">{formatRupiah(sisa)}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs text-slate-500 dark:text-slate-400">
                    {row.keterangan || (row.status === 'nyicil' ? 'Pembayaran sebagian' : 'Belum ada pembayaran')}
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
    </div>
  )
}
