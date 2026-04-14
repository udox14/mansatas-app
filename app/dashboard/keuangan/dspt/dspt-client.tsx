'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Search, ChevronRight, HandCoins, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { TambahDsptModal } from './components/tambah-dspt-modal'

interface DsptRow {
  id: string
  siswa_id: string
  nama_lengkap: string
  nisn: string
  tahun_masuk: number
  nominal_target: number
  total_dibayar: number
  total_diskon: number
  status: 'belum_bayar' | 'nyicil' | 'lunas'
  tingkat: number
  nomor_kelas: number
  kelompok: string
}

const STATUS_MAP = {
  lunas: { label: 'Lunas', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  nyicil: { label: 'Nyicil', icon: Clock, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  belum_bayar: { label: 'Belum Bayar', icon: XCircle, cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
}

export function DsptClient({ initialData }: { initialData: DsptRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [filterAngkatan, setFilterAngkatan] = useState('semua')

  const angkatanList = useMemo(() => {
    const years = [...new Set(initialData.map(d => d.tahun_masuk))].sort((a, b) => b - a)
    return years
  }, [initialData])

  const filtered = useMemo(() => {
    return initialData.filter(row => {
      const matchSearch = !search || row.nama_lengkap.toLowerCase().includes(search.toLowerCase()) || row.nisn?.includes(search)
      const matchStatus = filterStatus === 'semua' || row.status === filterStatus
      const matchAngkatan = filterAngkatan === 'semua' || String(row.tahun_masuk) === filterAngkatan
      return matchSearch && matchStatus && matchAngkatan
    })
  }, [initialData, search, filterStatus, filterAngkatan])

  const totalTarget = filtered.reduce((s, r) => s + r.nominal_target, 0)
  const totalDibayar = filtered.reduce((s, r) => s + r.total_dibayar, 0)
  const totalDiskon = filtered.reduce((s, r) => s + r.total_diskon, 0)
  const totalSisa = totalTarget - totalDibayar - totalDiskon

  return (
    <div className="space-y-3 pb-8">
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Cari nama atau NISN..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm rounded-md"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-36 text-xs rounded-md">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Status</SelectItem>
            <SelectItem value="lunas">Lunas</SelectItem>
            <SelectItem value="nyicil">Nyicil</SelectItem>
            <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAngkatan} onValueChange={setFilterAngkatan}>
          <SelectTrigger className="h-8 w-32 text-xs rounded-md">
            <SelectValue placeholder="Angkatan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Angkatan</SelectItem>
            {angkatanList.map(y => (
              <SelectItem key={y} value={String(y)}>Angkatan {y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <TambahDsptModal onSuccess={() => router.refresh()} />
        </div>
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

      {/* Mobile Cards */}
      <div className="block xl:hidden space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">Tidak ada data</div>
        )}
        {filtered.map(row => {
          const sisa = row.nominal_target - row.total_dibayar - row.total_diskon
          const s = STATUS_MAP[row.status]
          const Icon = s.icon
          return (
            <button
              key={row.id}
              onClick={() => router.push(`/dashboard/keuangan/siswa/${row.siswa_id}`)}
              className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">{row.nama_lengkap}</p>
                  <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium ${s.cls}`}>
                    <Icon className="h-2.5 w-2.5" />{s.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {row.tahun_masuk} · {row.tingkat ? `Kelas ${row.tingkat}-${row.nomor_kelas}${row.kelompok ?? ''}` : '-'}
                </p>
                <div className="flex gap-4 mt-1.5">
                  <span className="text-[11px] text-slate-500">Target: <strong>{formatRupiah(row.nominal_target)}</strong></span>
                  <span className="text-[11px] text-slate-500">Dibayar: <strong className="text-emerald-600">{formatRupiah(row.total_dibayar)}</strong></span>
                  <span className="text-[11px] text-slate-500">Sisa: <strong className="text-rose-600">{formatRupiah(sisa)}</strong></span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
            </button>
          )
        })}
      </div>

      {/* Desktop Table */}
      <div className="hidden xl:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead className="text-xs font-semibold">Nama Siswa</TableHead>
              <TableHead className="text-xs font-semibold">Angkatan</TableHead>
              <TableHead className="text-xs font-semibold">Kelas</TableHead>
              <TableHead className="text-xs font-semibold text-right">Target</TableHead>
              <TableHead className="text-xs font-semibold text-right">Dibayar</TableHead>
              <TableHead className="text-xs font-semibold text-right">Diskon</TableHead>
              <TableHead className="text-xs font-semibold text-right">Sisa</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-slate-400 text-sm">
                  Tidak ada data
                </TableCell>
              </TableRow>
            )}
            {filtered.map(row => {
              const sisa = row.nominal_target - row.total_dibayar - row.total_diskon
              const s = STATUS_MAP[row.status]
              const Icon = s.icon
              return (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  onClick={() => router.push(`/dashboard/keuangan/siswa/${row.siswa_id}`)}
                >
                  <TableCell>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{row.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400">{row.nisn}</p>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">{row.tahun_masuk}</TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                    {row.tingkat ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ?? ''}` : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-right font-medium">{formatRupiah(row.nominal_target)}</TableCell>
                  <TableCell className="text-sm text-right text-emerald-600 dark:text-emerald-400 font-medium">{formatRupiah(row.total_dibayar)}</TableCell>
                  <TableCell className="text-sm text-right text-blue-600 dark:text-blue-400 font-medium">{formatRupiah(row.total_diskon)}</TableCell>
                  <TableCell className="text-sm text-right text-rose-600 dark:text-rose-400 font-medium">{formatRupiah(sisa)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
                      <Icon className="h-2.5 w-2.5" />{s.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          {filtered.length} siswa ditampilkan
        </div>
      </div>
    </div>
  )
}
