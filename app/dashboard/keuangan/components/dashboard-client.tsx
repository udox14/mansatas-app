'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Wallet, Users, Trash2 } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { devResetDataKeuangan } from '../actions'

const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des']

interface Props {
  stats: {
    dspt: any
    spp: any
    kasKeluar: any
    cashflowMasuk: Array<{ bulan: number; total: number }>
    cashflowKeluar: Array<{ bulan: number; total: number }>
  }
}

export function KeuanganDashboardClient({ stats }: Props) {
  const { dspt, spp, kasKeluar, cashflowMasuk, cashflowKeluar } = stats
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [resetMsg, setResetMsg] = useState('')

  function handleReset() {
    startTransition(async () => {
      const res = await devResetDataKeuangan()
      setResetMsg(res.error ?? res.success ?? '')
      if (!res.error) { setShowResetDialog(false); router.refresh() }
    })
  }

  const totalMasuk = cashflowMasuk.reduce((s, r) => s + (r.total ?? 0), 0)
  const totalKeluar = cashflowKeluar.reduce((s, r) => s + (r.total ?? 0), 0)

  // Build 12-month array
  const bulanData = Array.from({ length: 12 }, (_, i) => {
    const masuk = cashflowMasuk.find(r => r.bulan === i + 1)?.total ?? 0
    const keluar = cashflowKeluar.find(r => r.bulan === i + 1)?.total ?? 0
    return { label: BULAN[i], masuk, keluar }
  })

  const maxVal = Math.max(...bulanData.map(d => Math.max(d.masuk, d.keluar)), 1)

  const dsptTotal = dspt?.total_siswa ?? 0
  const dsptLunas = dspt?.lunas ?? 0
  const dsptPersen = dsptTotal > 0 ? Math.round((dsptLunas / dsptTotal) * 100) : 0

  const sppTotal = spp?.total_tagihan ?? 0
  const sppLunas = spp?.lunas ?? 0
  const sppPersen = sppTotal > 0 ? Math.round((sppLunas / sppTotal) * 100) : 0

  return (
    <div className="space-y-4 pb-8">

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Total Masuk</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatRupiah(totalMasuk)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">tahun berjalan</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Total Keluar</span>
              <TrendingDown className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
              {formatRupiah(totalKeluar)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">tahun berjalan</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Saldo Bersih</span>
              <Wallet className="h-4 w-4 text-blue-500" />
            </div>
            <p className={`text-lg font-bold ${totalMasuk - totalKeluar >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600'}`}>
              {formatRupiah(totalMasuk - totalKeluar)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">masuk − keluar</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Tunggakan DSPT</span>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {formatRupiah((dspt?.total_target ?? 0) - (dspt?.total_dibayar ?? 0) - (dspt?.total_diskon ?? 0))}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">sisa belum terbayar</p>
          </CardContent>
        </Card>
      </div>

      {/* Cashflow Chart + Kepatuhan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Cashflow Bar Chart */}
        <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold">Cashflow Bulanan</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-end gap-1.5 h-36">
              {bulanData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex items-end gap-0.5" style={{ height: '112px' }}>
                    <div
                      className="flex-1 bg-emerald-400 dark:bg-emerald-600 rounded-t-sm min-h-[2px] transition-all"
                      style={{ height: `${Math.max(2, (d.masuk / maxVal) * 112)}px` }}
                      title={`Masuk: ${formatRupiah(d.masuk)}`}
                    />
                    <div
                      className="flex-1 bg-rose-400 dark:bg-rose-600 rounded-t-sm min-h-[2px] transition-all"
                      style={{ height: `${Math.max(2, (d.keluar / maxVal) * 112)}px` }}
                      title={`Keluar: ${formatRupiah(d.keluar)}`}
                    />
                  </div>
                  <span className="text-[9px] text-slate-400">{d.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded-sm bg-emerald-400 dark:bg-emerald-600" />
                <span className="text-[11px] text-slate-500">Masuk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded-sm bg-rose-400 dark:bg-rose-600" />
                <span className="text-[11px] text-slate-500">Keluar</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kepatuhan */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold">Tingkat Kepatuhan</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <KepatuhanBar label="DSPT" persen={dsptPersen} lunas={dsptLunas} total={dsptTotal} color="blue" />
            <KepatuhanBar label="SPP" persen={sppPersen} lunas={sppLunas} total={sppTotal} color="purple" />
          </CardContent>
        </Card>
      </div>

      {/* Detail DSPT */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatChip
          label="DSPT Lunas"
          value={`${dspt?.lunas ?? 0} siswa`}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          sub={formatRupiah(dspt?.total_dibayar ?? 0)}
        />
        <StatChip
          label="DSPT Nyicil"
          value={`${dspt?.nyicil ?? 0} siswa`}
          icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
          sub="pembayaran sebagian"
        />
        <StatChip
          label="DSPT Belum Bayar"
          value={`${dspt?.belum_bayar ?? 0} siswa`}
          icon={<AlertCircle className="h-4 w-4 text-rose-500" />}
          sub="belum ada pembayaran"
        />
      </div>

      {/* [DEV] Reset data — hapus sebelum production */}
      <div className="flex justify-end pt-2">
        <Button
          size="sm" variant="outline"
          className="h-8 text-xs gap-1.5 border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:border-rose-800 dark:text-rose-400"
          onClick={() => { setResetMsg(''); setShowResetDialog(true) }}
        >
          <Trash2 className="h-3.5 w-3.5" /> [DEV] Hapus Semua Data Keuangan
        </Button>
      </div>

      {/* Dialog konfirmasi */}
      <Dialog open={showResetDialog} onOpenChange={v => { if (!v) setShowResetDialog(false) }}>
        <DialogContent className="sm:max-w-sm rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-rose-50 dark:bg-rose-900/20 border-b border-rose-200 dark:border-rose-800">
            <DialogTitle className="text-sm font-semibold text-rose-700 dark:text-rose-400">
              Hapus Semua Data Keuangan?
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Semua data berikut akan dihapus permanen:
            </p>
            <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
              <li>Semua tagihan DSPT, SPP, Koperasi</li>
              <li>Semua transaksi & detail transaksi</li>
              <li>Semua diskon & janji bayar</li>
              <li>Semua kas keluar</li>
              <li>Nomor kuitansi direset ke 0</li>
            </ul>
            <p className="text-xs font-semibold text-rose-600">Tindakan ini tidak dapat dibatalkan!</p>
            {resetMsg && <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 rounded-md">{resetMsg}</p>}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setShowResetDialog(false)}>
                Batal
              </Button>
              <Button variant="destructive" size="sm" className="flex-1 h-9 text-sm" disabled={isPending} onClick={handleReset}>
                {isPending ? 'Menghapus...' : 'Ya, Hapus Semua'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KepatuhanBar({ label, persen, lunas, total, color }: {
  label: string; persen: number; lunas: number; total: number; color: 'blue' | 'purple'
}) {
  const colorClass = color === 'blue'
    ? 'bg-blue-500'
    : 'bg-purple-500'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{persen}%</span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
        <div
          className={`${colorClass} h-2 rounded-full transition-all`}
          style={{ width: `${persen}%` }}
        />
      </div>
      <p className="text-[11px] text-slate-400">{lunas} / {total} {label === 'DSPT' ? 'siswa' : 'tagihan'} lunas</p>
    </div>
  )
}

function StatChip({ label, value, icon, sub }: { label: string; value: string; icon: React.ReactNode; sub: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex items-center gap-3">
      <div className="flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{value}</p>
        <p className="text-[11px] text-slate-400">{sub}</p>
      </div>
    </div>
  )
}
