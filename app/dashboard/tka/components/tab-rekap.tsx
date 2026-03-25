// Lokasi: app/dashboard/tka/components/tab-rekap.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, Users, BookMarked } from 'lucide-react'
import { getRekapMapelPilihan, getSiswaByMapel } from '../actions'
import type { KelasItem } from '../actions'
import { cn } from '@/lib/utils'

interface Props {
  tahunAjaranId: string
  kelasList: KelasItem[]
  isAdmin: boolean
}

type RekapItem = { mapel: string; jumlah: number }

const KATEGORI_COLOR: Record<string, string> = {
  'Matematika Tingkat Lanjut': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  'Bahasa Indonesia Tingkat Lanjut': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  'Bahasa Inggris Tingkat Lanjut': 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  'Fisika': 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
  'Kimia': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  'Biologi': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800',
  'Ekonomi': 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  'Sosiologi': 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800',
  'Geografi': 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
  'Sejarah': 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  'Bahasa Arab': 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
}

function getMapelColor(mapel: string) {
  return KATEGORI_COLOR[mapel] ?? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
}

export function TabRekap({ tahunAjaranId, isAdmin }: Props) {
  const [loading, setLoading] = useState(false)
  const [pilihan1, setPilihan1] = useState<RekapItem[]>([])
  const [pilihan2, setPilihan2] = useState<RekapItem[]>([])
  const [loaded, setLoaded] = useState(false)

  // Modal state
  const [modal, setModal] = useState<{ mapel: string; pilihan: 1 | 2 } | null>(null)
  const [modalData, setModalData] = useState<any[]>([])
  const [modalTotal, setModalTotal] = useState(0)
  const [modalPage, setModalPage] = useState(1)
  const [modalLoading, setModalLoading] = useState(false)
  const PAGE_SIZE = 20

  const loadRekap = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getRekapMapelPilihan(tahunAjaranId)
      setPilihan1(res.pilihan1)
      setPilihan2(res.pilihan2)
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [tahunAjaranId])

  const openModal = async (mapel: string, pilihan: 1 | 2) => {
    setModal({ mapel, pilihan })
    setModalPage(1)
    setModalLoading(true)
    try {
      const res = await getSiswaByMapel(tahunAjaranId, mapel, pilihan, 1, PAGE_SIZE)
      setModalData(res.data)
      setModalTotal(res.total)
    } finally {
      setModalLoading(false)
    }
  }

  const loadModalPage = async (page: number) => {
    if (!modal) return
    setModalPage(page)
    setModalLoading(true)
    try {
      const res = await getSiswaByMapel(tahunAjaranId, modal.mapel, modal.pilihan, page, PAGE_SIZE)
      setModalData(res.data)
      setModalTotal(res.total)
    } finally {
      setModalLoading(false)
    }
  }

  const totalPilihan1 = pilihan1.reduce((s, r) => s + r.jumlah, 0)
  const totalPilihan2 = pilihan2.reduce((s, r) => s + r.jumlah, 0)
  const maxPilihan1 = pilihan1[0]?.jumlah ?? 1
  const maxPilihan2 = pilihan2[0]?.jumlah ?? 1
  const totalPages = Math.ceil(modalTotal / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {!loaded ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl border-dashed border-slate-200 dark:border-slate-700">
          <BookMarked className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium text-sm">Lihat rekapitulasi mapel pilihan siswa</p>
          <p className="text-slate-400 text-xs mt-1 mb-4">Klik tombol di bawah untuk memuat data</p>
          <Button onClick={loadRekap} disabled={loading} size="sm" variant="outline">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Muat Rekapitulasi
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{totalPilihan1} siswa telah memilih Mapel Pilihan 1 · {totalPilihan2} siswa untuk Pilihan 2</p>
            <Button onClick={loadRekap} disabled={loading} size="sm" variant="outline">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Pilihan 1 */}
            <RekapCard
              title="Mapel Pilihan 1"
              items={pilihan1}
              total={totalPilihan1}
              maxVal={maxPilihan1}
              pilihan={1}
              onClickMapel={openModal}
            />
            {/* Pilihan 2 */}
            <RekapCard
              title="Mapel Pilihan 2"
              items={pilihan2}
              total={totalPilihan2}
              maxVal={maxPilihan2}
              pilihan={2}
              onClickMapel={openModal}
            />
          </div>
        </>
      )}

      {/* Modal Detail Siswa */}
      <Dialog open={!!modal} onOpenChange={open => !open && setModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Siswa Pemilih: {modal?.mapel}
              <span className="ml-2 text-xs font-normal text-slate-500">(Pilihan {modal?.pilihan})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-slate-500 mb-2">{modalTotal} siswa</div>
          <ScrollArea className="h-72">
            {modalLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left py-1.5 pr-2">#</th>
                    <th className="text-left py-1.5 pr-2">Nama</th>
                    <th className="text-left py-1.5 pr-2">NISN</th>
                    <th className="text-left py-1.5">Kelas</th>
                  </tr>
                </thead>
                <tbody>
                  {modalData.map((row, i) => (
                    <tr key={row.nisn} className="border-b border-slate-50 dark:border-slate-800">
                      <td className="py-1.5 pr-2 text-xs text-slate-400">{(modalPage - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="py-1.5 pr-2 font-medium text-slate-800 dark:text-slate-200">{row.nama_lengkap}</td>
                      <td className="py-1.5 pr-2 text-xs font-mono text-slate-500">{row.nisn}</td>
                      <td className="py-1.5 text-xs text-slate-500">
                        {row.tingkat ? `${row.tingkat}-${row.nomor_kelas} ${row.kelompok}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ScrollArea>
          {/* Pagination modal */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" disabled={modalPage <= 1} onClick={() => loadModalPage(modalPage - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-slate-500">Hal {modalPage} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={modalPage >= totalPages} onClick={() => loadModalPage(modalPage + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RekapCard({
  title, items, total, maxVal, pilihan, onClickMapel
}: {
  title: string
  items: RekapItem[]
  total: number
  maxVal: number
  pilihan: 1 | 2
  onClickMapel: (mapel: string, pilihan: 1 | 2) => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{total} siswa · {items.length} mapel dipilih</p>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-400">Belum ada data</div>
      ) : (
        <div className="p-3 space-y-2">
          {items.map(item => (
            <button
              key={item.mapel}
              onClick={() => onClickMapel(item.mapel, pilihan)}
              className="w-full group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full border font-medium',
                  getMapelColor(item.mapel)
                )}>
                  {item.mapel}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.jumlah}</span>
                  <Users className="h-3 w-3 text-slate-400 group-hover:text-sky-500 transition-colors" />
                </div>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-sky-400 dark:bg-sky-500 transition-all"
                  style={{ width: `${(item.jumlah / maxVal) * 100}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
