'use client'

import { useState, useTransition, useCallback } from 'react'
import { getDataTamu, hapusEntriTamu } from '../actions'
import type { EntriTamu, FilterTamu } from '../actions'
import { cn } from '@/lib/utils'
import {
  Search, Calendar, CalendarDays, Trash2, Loader2,
  User, Building2, Clock, Image as ImageIcon, ChevronLeft,
  ChevronRight, AlertCircle, RefreshCw, X
} from 'lucide-react'

interface Props {
  initialData: EntriTamu[]
  initialTotal: number
}

// ─── FOTO MODAL ──────────────────────────────────────────────
function FotoModal({ url, nama, onClose }: { url: string; nama: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="relative max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={nama} className="w-full object-cover" />
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
          <p className="text-white font-semibold text-sm">{nama}</p>
        </div>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── MAIN ADMIN PANEL ─────────────────────────────────────────
export function BukuTamuAdminClient({ initialData, initialTotal }: Props) {
  const [data, setData] = useState<EntriTamu[]>(initialData)
  const [total, setTotal] = useState(initialTotal)
  const [isPending, startTransition] = useTransition()

  // Filter state
  const [filterMode, setFilterMode] = useState<'tanggal' | 'bulan'>('tanggal')
  const [filterTanggal, setFilterTanggal] = useState('')
  const [filterBulan, setFilterBulan] = useState('')
  const [page, setPage] = useState(1)

  // Modal foto
  const [modalFoto, setModalFoto] = useState<{ url: string; nama: string } | null>(null)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const LIMIT = 50
  const totalPages = Math.ceil(total / LIMIT)

  const loadData = useCallback((filter: FilterTamu) => {
    startTransition(async () => {
      const res = await getDataTamu(filter)
      setData(res.data)
      setTotal(res.total)
    })
  }, [])

  const applyFilter = () => {
    setPage(1)
    const filter: FilterTamu = { page: 1 }
    if (filterMode === 'tanggal' && filterTanggal) filter.tanggal = filterTanggal
    if (filterMode === 'bulan' && filterBulan) filter.bulan = filterBulan
    loadData(filter)
  }

  const resetFilter = () => {
    setFilterTanggal('')
    setFilterBulan('')
    setPage(1)
    loadData({ page: 1 })
  }

  const changePage = (newPage: number) => {
    setPage(newPage)
    const filter: FilterTamu = { page: newPage }
    if (filterMode === 'tanggal' && filterTanggal) filter.tanggal = filterTanggal
    if (filterMode === 'bulan' && filterBulan) filter.bulan = filterBulan
    loadData(filter)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus data kunjungan ini?')) return
    setDeletingId(id)
    setDeleteError('')
    const res = await hapusEntriTamu(id)
    if (res.error) {
      setDeleteError(res.error)
    } else {
      setData(prev => prev.filter(d => d.id !== id))
      setTotal(prev => prev - 1)
    }
    setDeletingId(null)
  }

  const hasFilter = (filterMode === 'tanggal' && filterTanggal) || (filterMode === 'bulan' && filterBulan)

  return (
    <>
      {modalFoto && <FotoModal url={modalFoto.url} nama={modalFoto.nama} onClose={() => setModalFoto(null)} />}

      <div className="space-y-3 h-[calc(100vh-10rem)] flex flex-col">
        {/* Filter Bar */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            {[
              { id: 'tanggal', label: 'Per Tanggal', icon: Calendar },
              { id: 'bulan', label: 'Per Bulan', icon: CalendarDays },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setFilterMode(m.id as any)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all',
                  filterMode === m.id
                    ? 'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
              >
                <m.icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            ))}
          </div>

          {/* Input Filter + Actions */}
          <div className="flex gap-2">
            {filterMode === 'tanggal' ? (
              <input
                type="date"
                value={filterTanggal}
                onChange={e => setFilterTanggal(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-50 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
              />
            ) : (
              <input
                type="month"
                value={filterBulan}
                onChange={e => setFilterBulan(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-50 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
              />
            )}
            <button
              onClick={applyFilter}
              disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Cari
            </button>
            {hasFilter && (
              <button
                onClick={resetFilter}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-700 text-slate-600 dark:text-slate-400 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-violet-600 dark:text-violet-400">{total}</span>
            <span>kunjungan ditemukan</span>
            {hasFilter && (
              <span className="px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 font-medium">
                Difilter
              </span>
            )}
          </div>
        </div>

        {deleteError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {deleteError}
          </div>
        )}

        {/* Data List — scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1" style={{scrollbarWidth:'thin', scrollbarColor:'#a78bfa50 transparent'}}>
        {isPending ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Memuat data...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <CalendarDays className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">Tidak ada data kunjungan</p>
            <p className="text-xs text-slate-400">Coba ubah filter atau reset pencarian.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {data.map((tamu, i) => (
              <div
                key={tamu.id}
                className="flex gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow group"
              >
                {/* No + Foto */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400 font-mono leading-none">{(page - 1) * LIMIT + i + 1}</span>
                  {tamu.foto_url ? (
                    <button onClick={() => setModalFoto({ url: tamu.foto_url!, nama: tamu.nama || tamu.instansi || 'Tamu' })}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tamu.foto_url}
                        alt="foto"
                        className="w-14 h-14 rounded-xl object-cover hover:ring-2 hover:ring-violet-400 transition-all cursor-zoom-in"
                      />
                    </button>
                  ) : (
                    <div className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center',
                      tamu.kategori === 'INDIVIDU' ? 'bg-violet-50 dark:bg-violet-950/30' : 'bg-blue-50 dark:bg-blue-950/30'
                    )}>
                      {tamu.kategori === 'INDIVIDU'
                        ? <User className="h-6 w-6 text-violet-300" />
                        : <Building2 className="h-6 w-6 text-blue-300" />
                      }
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-slate-50 dark:text-slate-100 text-sm truncate">
                        {tamu.nama || tamu.instansi || '—'}
                      </p>
                      <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                        <span className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full',
                          tamu.kategori === 'INDIVIDU'
                            ? 'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                            : 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        )}>
                          {tamu.kategori}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-0.5">
                          <Calendar className="h-3 w-3" />
                          {tamu.tanggal}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {tamu.waktu}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(tamu.id)}
                      disabled={deletingId === tamu.id}
                      className="shrink-0 p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all opacity-0 group-hover:opacity-100"
                    >
                      {deletingId === tamu.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />
                      }
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                    <span className="font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300">Keperluan: </span>
                    {tamu.maksud_tujuan}
                  </p>
                  {tamu.pencatat_nama && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      Dicatat oleh: {tamu.pencatat_nama}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => changePage(page - 1)}
              disabled={page <= 1 || isPending}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-4 w-4" /> Sebelumnya
            </button>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => changePage(page + 1)}
              disabled={page >= totalPages || isPending}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Berikutnya <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
