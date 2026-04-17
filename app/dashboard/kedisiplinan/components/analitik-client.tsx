// Lokasi: app/dashboard/kedisiplinan/components/analitik-client.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp, Users, AlertTriangle, ShieldAlert,
  ShieldCheck, Flame, BarChart3, Settings2, ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SanksiConfigModal } from './sanksi-config-modal'
import type { SanksiConfig } from '../actions'

const KATEGORI_COLORS: Record<string, string> = {
  'Ringan':  'bg-yellow-400',
  'Sedang':  'bg-orange-500',
  'Berat':   'bg-red-600',
  'Sangat Berat': 'bg-purple-700',
}

function getSanksiStyle(urutan: number) {
  if (urutan === 1) return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
  if (urutan === 2) return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800'
  if (urutan === 3) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
  return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800'
}

const AMAN_STYLE = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'

type AnalitikData = {
  ringkasan: { total_kasus: number; total_poin: number }
  perKategori: any[]
  perBulan: any[]
  topPelanggaran: any[]
  siswaBerisiko: any[]
  perKelas: any[]
  sanksiList: SanksiConfig[]
}

export function AnalitikKedisiplinanClient({
  data, isAdmin
}: { data: AnalitikData; isAdmin: boolean }) {
  const [filterLevel, setFilterLevel] = useState<string>('all')
  const [showSanksiConfig, setShowSanksiConfig] = useState(false)

  const { ringkasan, perKategori, perBulan, topPelanggaran, siswaBerisiko, perKelas, sanksiList } = data

  // Count by sanksi id (null → 'baik')
  const countBySanksi = siswaBerisiko.reduce((acc: Record<string, number>, s) => {
    const key = s.sanksi?.id ?? 'baik'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const countWithAnySanksi = siswaBerisiko.filter(s => s.sanksi).length

  const maxKasus = Math.max(...perBulan.map((b: any) => b.jumlah), 1)
  const bulanLabels = perBulan.map((b: any) => {
    const [, m] = (b.bulan as string).split('-')
    return ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][parseInt(m) - 1] || m
  })

  const filteredSiswa = filterLevel === 'all'
    ? siswaBerisiko
    : filterLevel === 'baik'
      ? siswaBerisiko.filter(s => !s.sanksi)
      : siswaBerisiko.filter(s => s.sanksi?.id === filterLevel)

  return (
    <div className="space-y-6">

      {/* ── KARTU RINGKASAN ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Kasus', value: ringkasan.total_kasus, icon: BarChart3, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
          { label: 'Total Poin Beban', value: ringkasan.total_poin, icon: Flame, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/30' },
          { label: 'Siswa Bersanksi', value: countWithAnySanksi, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
          { label: 'Jenis Sanksi', value: sanksiList.length, icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl p-4 border border-slate-200 dark:border-slate-700 ${card.bg} flex flex-col gap-2`}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{card.label}</p>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <p className={`text-3xl font-black ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── BARIS 2: TREN + DISTRIBUSI KATEGORI ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Tren Per Bulan */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" /> Tren Pelanggaran Per Bulan
          </h3>
          {perBulan.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-slate-400 dark:text-slate-500 text-sm">Belum ada data.</div>
          ) : (
            <div>
              <div className="flex items-end gap-1 h-20 mb-1">
                {perBulan.map((b: any, i: number) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full rounded-t bg-indigo-500 transition-all hover:bg-indigo-600"
                      style={{ height: `${Math.max(4, (b.jumlah / maxKasus) * 80)}px` }}
                      title={`${b.jumlah} kasus (${b.total_poin} poin)`} />
                  </div>
                ))}
              </div>
              <div className="flex gap-1">
                {bulanLabels.map((l, i) => (
                  <div key={i} className="flex-1 text-center text-[9px] text-slate-400 dark:text-slate-500 truncate">{l}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Distribusi Kategori */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-orange-500" /> Distribusi Kategori
          </h3>
          {perKategori.length === 0 ? (
            <div className="text-center text-slate-400 dark:text-slate-500 text-sm py-8">Belum ada data.</div>
          ) : (
            <div className="space-y-2">
              {perKategori.map((k: any) => {
                const maxPoin = Math.max(...perKategori.map((x: any) => x.total_poin), 1)
                const pct = (k.total_poin / maxPoin) * 100
                return (
                  <div key={k.kategori}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{k.kategori}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{k.jumlah}x · {k.total_poin} poin</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${KATEGORI_COLORS[k.kategori] || 'bg-slate-400'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── BARIS 3: TOP PELANGGARAN + PER KELAS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Top 10 Jenis Pelanggaran */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-500" /> Jenis Pelanggaran Terbanyak
          </h3>
          <div className="space-y-2">
            {topPelanggaran.length === 0 ? (
              <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4">Belum ada data.</p>
            ) : topPelanggaran.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <span className="text-[11px] font-black w-5 text-slate-400 dark:text-slate-500 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{p.nama_pelanggaran}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{p.kategori} · {p.poin} poin/kasus</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-rose-600">{p.frekuensi}x</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per Kelas */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" /> Pelanggaran per Kelas
          </h3>
          <div className="space-y-2">
            {perKelas.length === 0 ? (
              <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4">Belum ada data.</p>
            ) : perKelas.slice(0, 8).map((k: any, i: number) => {
              const namaKelas = k.tingkat ? `${k.tingkat}-${k.nomor_kelas}` : 'N/A'
              const maxPoin = Math.max(...perKelas.map((x: any) => x.total_poin), 1)
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold w-10 text-slate-600 dark:text-slate-300 shrink-0">{namaKelas}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${(k.total_poin / maxPoin) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0 w-14 text-right">{k.total_kasus}k · {k.total_poin}p</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── RADAR SISWA ── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-500" /> Radar Siswa Perlu Tindakan
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setFilterLevel('all')}
              className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full transition-all',
                filterLevel === 'all' ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700')}>
              Semua
            </button>
            {sanksiList.map(s => (
              <button key={s.id} onClick={() => setFilterLevel(s.id)}
                className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full transition-all',
                  filterLevel === s.id ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700')}>
                {s.nama} ({countBySanksi[s.id] || 0})
              </button>
            ))}
          </div>
        </div>

        {filteredSiswa.length === 0 ? (
          <div className="py-12 text-center">
            <ShieldCheck className="h-10 w-10 mx-auto text-emerald-300 mb-2" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Tidak ada siswa pada level ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {filteredSiswa.map((s: any) => {
              const sanksi: SanksiConfig | null = s.sanksi
              const badgeStyle = sanksi ? getSanksiStyle(sanksi.urutan) : AMAN_STYLE
              const kelas = s.tingkat ? `${s.tingkat}-${s.nomor_kelas}` : 'N/A'
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  {/* Poin bubble */}
                  <div className="shrink-0 h-14 w-14 rounded-full bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-200 dark:border-rose-800 flex flex-col items-center justify-center">
                    <span className="text-base font-black text-rose-600 dark:text-rose-400 leading-none">{s.total_poin}</span>
                    <span className="text-[8px] text-rose-400 dark:text-rose-600 font-semibold uppercase tracking-wide">poin</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{s.nama_lengkap}</p>
                      <span className={cn('text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border', badgeStyle)}>
                        {sanksi?.nama || 'Baik'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Kelas {kelas} · {s.jumlah_kasus} kasus</p>
                    {sanksi?.deskripsi && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">{sanksi.deskripsi}</p>
                    )}
                  </div>

                  <Link href={`/dashboard/siswa/${s.id}`}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── KELOLA SANKSI (Admin Only) ── */}
      {isAdmin && (
        <>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSanksiConfig(true)}
              className="h-8 text-xs gap-1.5 border-slate-200 dark:border-slate-700"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Kelola Tingkat Sanksi
            </Button>
          </div>
          <SanksiConfigModal
            isOpen={showSanksiConfig}
            onClose={() => setShowSanksiConfig(false)}
            sanksiList={sanksiList}
          />
        </>
      )}
    </div>
  )
}
