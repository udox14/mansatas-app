'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, ListChecks, Loader2, RefreshCw, Search, TriangleAlert, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataPagination, usePagination } from '@/components/ui/data-pagination'
import { cn } from '@/lib/utils'
import { formatDateTimeWIB } from '@/lib/time'
import { naturalSort } from '@/lib/natural-sort'
import { RENCANA_LABEL } from '@/lib/pendidikan-lanjutan'
import { getTkaParentApprovalRows } from '../actions'
import type { KelasItem, TkaParentApprovalRow, TkaParentApprovalStatus } from '../actions'

type Props = {
  tahunAjaranId: string
  kelasList: KelasItem[]
}

const STATUS_META: Record<TkaParentApprovalStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  disetujui: { label: 'Sudah disetujui', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300', icon: CheckCircle2 },
  belum_disetujui: { label: 'Belum disetujui', className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300', icon: Clock3 },
  perlu_persetujuan_ulang: { label: 'Perlu persetujuan ulang', className: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300', icon: TriangleAlert },
  belum_lengkap: { label: 'Pilihan belum lengkap', className: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: ListChecks },
}

function kelasLabel(row: Pick<TkaParentApprovalRow, 'tingkat' | 'nomor_kelas' | 'kelompok'>) {
  return row.tingkat ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ` ${row.kelompok}` : ''}` : '-'
}

function StatusBadge({ status }: { status: TkaParentApprovalStatus }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', meta.className)}><Icon className="h-3.5 w-3.5" />{meta.label}</span>
}

export function TabPersetujuanOrtu({ tahunAjaranId, kelasList }: Props) {
  const [rows, setRows] = useState<TkaParentApprovalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [kelasFilter, setKelasFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const pg = usePagination(50)

  useEffect(() => {
    let cancelled = false
    getTkaParentApprovalRows(tahunAjaranId)
      .then(data => { if (!cancelled) setRows(data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tahunAjaranId, refreshKey])

  const sortedKelas = useMemo(() => naturalSort(kelasList, kelas => `${kelas.tingkat}|${kelas.nomor_kelas}|${kelas.kelompok}`), [kelasList])
  const counts = useMemo(() => ({
    total: rows.length,
    disetujui: rows.filter(row => row.approval_status === 'disetujui').length,
    belum: rows.filter(row => row.approval_status === 'belum_disetujui').length,
    ulang: rows.filter(row => row.approval_status === 'perlu_persetujuan_ulang').length,
    belumLengkap: rows.filter(row => row.approval_status === 'belum_lengkap').length,
  }), [rows])

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('id-ID')
    return rows.filter(row => {
      if (kelasFilter && row.kelas_id !== kelasFilter) return false
      if (statusFilter && row.approval_status !== statusFilter) return false
      if (keyword && !`${row.nama_lengkap} ${row.nisn}`.toLocaleLowerCase('id-ID').includes(keyword)) return false
      return true
    })
  }, [rows, kelasFilter, statusFilter, search])

  useEffect(() => { pg.reset() }, [kelasFilter, statusFilter, search]) // eslint-disable-line react-hooks/exhaustive-deps

  const paginatedRows = useMemo(() => {
    if (pg.pageSize === 'semua') return filteredRows
    const start = (pg.page - 1) * Number(pg.pageSize)
    return filteredRows.slice(start, start + Number(pg.pageSize))
  }, [filteredRows, pg.page, pg.pageSize])

  const refresh = () => {
    setLoading(true)
    setRefreshKey(key => key + 1)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Total siswa', value: counts.total, className: 'text-slate-800 dark:text-slate-100', icon: Users },
          { label: 'Disetujui', value: counts.disetujui, className: 'text-emerald-600', icon: CheckCircle2 },
          { label: 'Belum disetujui', value: counts.belum, className: 'text-amber-600', icon: Clock3 },
          { label: 'Setujui ulang', value: counts.ulang, className: 'text-rose-600', icon: TriangleAlert },
          { label: 'Data belum lengkap', value: counts.belumLengkap, className: 'text-slate-500', icon: ListChecks },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-medium text-slate-500">{item.label}</p><item.icon className={cn('h-4 w-4', item.className)} /></div>
            <p className={cn('mt-2 text-2xl font-bold tabular-nums', item.className)}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-2 md:grid-cols-[minmax(200px,1fr)_180px_210px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama atau NISN..." className="pl-9" />
          </label>
          <select value={kelasFilter} onChange={event => setKelasFilter(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">Semua kelas</option>
            {sortedKelas.map(kelas => <option key={kelas.id} value={kelas.id}>{kelas.tingkat}-{kelas.nomor_kelas}{kelas.kelompok ? ` ${kelas.kelompok}` : ''}</option>)}
          </select>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">Semua status</option>
            {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
          </select>
          <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />Muat ulang</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid min-h-64 place-items-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900"><ListChecks className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">Tidak ada siswa yang sesuai filter.</p></div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/70"><tr><th className="px-4 py-3">Siswa</th><th className="px-4 py-3">Kelas</th><th className="px-4 py-3">Pilihan TKA</th><th className="px-4 py-3">Pendidikan lanjutan</th><th className="px-4 py-3">Status orang tua</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedRows.map(row => (
                    <tr key={row.siswa_id} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3"><p className="font-semibold text-slate-800 dark:text-slate-100">{row.nama_lengkap}</p><p className="mt-0.5 text-xs text-slate-400">{row.nisn || '-'}</p></td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{kelasLabel(row)}</td>
                      <td className="px-4 py-3 text-xs leading-5 text-slate-600 dark:text-slate-300"><p>1. {row.mapel_pilihan1 || '-'}</p><p>2. {row.mapel_pilihan2 || '-'}</p></td>
                      <td className="max-w-[280px] px-4 py-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
                        <p className="font-medium">{RENCANA_LABEL[row.rencana_kategori || 'KULIAH'] || row.rencana_kategori}</p>
                        {row.rencana_kategori === 'KULIAH' && <><p className="truncate">1. {row.pilihan1_kampus_nama || '-'} · {row.pilihan1_prodi || '-'}</p><p className="truncate">2. {row.pilihan2_kampus_nama || '-'} · {row.pilihan2_prodi || '-'}</p></>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={row.approval_status} />{row.approved_at && <p className="mt-1.5 text-[11px] text-slate-400">{formatDateTimeWIB(row.approved_at)} WIB</p>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {paginatedRows.map(row => (
              <div key={row.siswa_id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-slate-800 dark:text-slate-100">{row.nama_lengkap}</p><p className="mt-0.5 text-xs text-slate-400">{kelasLabel(row)} · {row.nisn || '-'}</p></div><StatusBadge status={row.approval_status} /></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/70"><p className="font-semibold text-slate-500">TKA</p><p className="mt-1">{row.mapel_pilihan1 || '-'}<br />{row.mapel_pilihan2 || '-'}</p></div><div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/70"><p className="font-semibold text-slate-500">Rencana</p><p className="mt-1">{RENCANA_LABEL[row.rencana_kategori || 'KULIAH'] || row.rencana_kategori}</p></div></div>
                {row.approved_at && <p className="mt-3 text-[11px] text-slate-400">Disetujui {formatDateTimeWIB(row.approved_at)} WIB</p>}
              </div>
            ))}
          </div>

          <DataPagination total={filteredRows.length} page={pg.page} pageSize={pg.pageSize} onPageChange={pg.setPage} onPageSizeChange={pg.setPageSize} pageSizeOptions={[50, 100]} entityLabel="siswa" />
        </>
      )}
    </div>
  )
}
