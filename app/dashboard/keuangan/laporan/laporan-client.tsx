'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronRight, CheckCircle2, AlertCircle, Send, Search } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { DataPagination, usePagination } from '@/components/ui/data-pagination'

interface RekapAngkatan {
  tahun_masuk: number
  total_siswa: number
  dspt_lunas: number
  dspt_nyicil: number
  dspt_belum: number
  dspt_target: number
  dspt_dibayar: number
}

export function LaporanClient({ rekapAngkatan }: { rekapAngkatan: RekapAngkatan[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const { page, pageSize, setPage, setPageSize, paginate, reset } = usePagination(10)

  const filtered = useMemo(() => {
    reset()
    return rekapAngkatan.filter(r => !search || String(r.tahun_masuk).includes(search))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rekapAngkatan, search])

  const paginated = paginate(filtered)

  return (
    <Tabs defaultValue="angkatan" className="space-y-3">
      <TabsList className="h-8 text-xs">
        <TabsTrigger value="angkatan" className="text-xs h-7 px-3">Rekap per Angkatan</TabsTrigger>
        <TabsTrigger value="wa-blast" className="text-xs h-7 px-3 gap-1.5">
          <Send className="h-3 w-3" />WA Blast
        </TabsTrigger>
      </TabsList>

      {/* Tab Rekap Angkatan */}
      <TabsContent value="angkatan" className="space-y-3 mt-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input placeholder="Cari angkatan..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm rounded-md" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead className="text-xs font-semibold">Angkatan</TableHead>
                <TableHead className="text-xs font-semibold text-center">Total Siswa</TableHead>
                <TableHead className="text-xs font-semibold text-center">Lunas DSPT</TableHead>
                <TableHead className="text-xs font-semibold text-center">Nyicil</TableHead>
                <TableHead className="text-xs font-semibold text-center">Belum Bayar</TableHead>
                <TableHead className="text-xs font-semibold text-right">Target</TableHead>
                <TableHead className="text-xs font-semibold text-right">Terkumpul</TableHead>
                <TableHead className="text-xs font-semibold text-center">% Lunas</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-sm text-slate-400">Tidak ada data</TableCell></TableRow>
              )}
              {paginated.map(row => {
                const persen = row.total_siswa > 0 ? Math.round((row.dspt_lunas / row.total_siswa) * 100) : 0
                return (
                  <TableRow key={row.tahun_masuk} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <TableCell className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      Angkatan {row.tahun_masuk}
                    </TableCell>
                    <TableCell className="text-sm text-center text-slate-600">{row.total_siswa}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="h-2.5 w-2.5" />{row.dspt_lunas}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        {row.dspt_nyicil}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">
                        <AlertCircle className="h-2.5 w-2.5" />{row.dspt_belum}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">{formatRupiah(row.dspt_target)}</TableCell>
                    <TableCell className="text-sm text-right text-emerald-600 font-medium">{formatRupiah(row.dspt_dibayar)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                          <div className="h-1.5 bg-emerald-500 rounded-full" style={{ width: `${persen}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 w-8 text-right">{persen}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
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
            entityLabel="angkatan"
          />
        </div>
      </TabsContent>

      {/* Tab WA Blast */}
      <TabsContent value="wa-blast" className="mt-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-0.5">Kirim Pengingat Tagihan via WhatsApp</p>
            <p className="text-xs text-slate-500">Pilih kriteria siswa yang akan dikirimkan pesan pengingat</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Filter Tunggakan</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" defaultChecked /> <span className="text-sm text-slate-600 dark:text-slate-300">DSPT belum lunas</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" defaultChecked /> <span className="text-sm text-slate-600 dark:text-slate-300">SPP belum bayar</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" /> <span className="text-sm text-slate-600 dark:text-slate-300">Koperasi belum lunas</span>
              </label>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Filter Janji Bayar</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" /> <span className="text-sm text-slate-600 dark:text-slate-300">Mendekati janji bayar (≤ 7 hari)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" /> <span className="text-sm text-slate-600 dark:text-slate-300">Janji bayar sudah lewat</span>
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Preview Pesan</label>
            <textarea
              className="w-full h-24 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue={`Assalamu'alaikum Bapak/Ibu Orang Tua {nama_siswa}.\n\nKami mengingatkan bahwa masih terdapat tunggakan pembayaran {jenis_tagihan} sebesar {sisa_tagihan}.\n\nMohon segera diselesaikan. Terima kasih.`}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Estimasi: <strong>0 siswa</strong> akan dikirim pesan</p>
            <Button size="sm" className="h-8 text-xs gap-1.5">
              <Send className="h-3.5 w-3.5" /> Kirim WA Blast
            </Button>
          </div>
          <p className="text-[11px] text-slate-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            ⚠️ Fitur WA Blast membutuhkan integrasi dengan layanan WhatsApp API (Fonnte/Wablas). Konfigurasi token di Pengaturan Aplikasi.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  )
}
