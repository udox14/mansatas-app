// Lokasi: app/dashboard/kedisiplinan/components/analitik-client.tsx
'use client'

import { useState, useActionState } from 'react'
import Link from 'next/link'
import {
  TrendingUp, Users, AlertTriangle, ShieldAlert,
  ShieldCheck, Flame, BarChart3, Settings2, CheckCircle2,
  ChevronRight, Info, X
} from 'lucide-react'
import { simpanKedisiplinanConfig } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ─── Warna level ─────────────────────────────────────────────
const LEVEL_MAP = {
  kritis:     { label: 'Kritis',      bg: 'bg-red-100 dark:bg-red-900/30',    text: 'text-red-700 dark:text-red-400',    border: 'border-red-200 dark:border-red-800',    dot: 'bg-red-500' },
  peringatan: { label: 'Peringatan',  bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800', dot: 'bg-orange-500' },
  perhatian:  { label: 'Perhatian',   bg: 'bg-amber-100 dark:bg-amber-900/30',  text: 'text-amber-700 dark:text-amber-400',  border: 'border-amber-200 dark:border-amber-800',  dot: 'bg-amber-400' },
  aman:       { label: 'Aman',        bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
}

const KATEGORI_COLORS: Record<string, string> = {
  'Ringan':  'bg-yellow-400',
  'Sedang':  'bg-orange-500',
  'Berat':   'bg-red-600',
  'Sangat Berat': 'bg-purple-700',
}

type AnalitikData = {
  ringkasan: { total_kasus: number; total_poin: number }
  perKategori: any[]
  perBulan: any[]
  topPelanggaran: any[]
  siswaBerisiko: any[]
  perKelas: any[]
  thresholds: { perhatian: number; peringatan: number; kritis: number; creditAwal: number }
}

// ─── Sparkline Chart (Bar sederhana) ─────────────────────────
function SimpleBarChart({ data, maxVal, colorClass = 'bg-indigo-500' }: { data: number[]; maxVal: number; colorClass?: string }) {
  return (
    <div className="flex items-end gap-0.5 h-12">
      {data.map((v, i) => (
        <div key={i} className={`flex-1 rounded-t ${colorClass} opacity-80`}
          style={{ height: maxVal > 0 ? `${Math.max(4, (v / maxVal) * 100)}%` : '4%' }}
          title={String(v)} />
      ))}
    </div>
  )
}

// ─── Credit Score Ring ────────────────────────────────────────
function CreditScoreRing({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100))
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'
  const r = 28, circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="rotate-[-90deg]">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────
export function AnalitikKedisiplinanClient({
  data, isAdmin
}: { data: AnalitikData; isAdmin: boolean }) {
  const [showConfig, setShowConfig] = useState(false)
  const [filterLevel, setFilterLevel] = useState<string>('all')

  const [configState, configAction, isConfigPending] = useActionState(simpanKedisiplinanConfig, null)

  const { ringkasan, perKategori, perBulan, topPelanggaran, siswaBerisiko, perKelas, thresholds } = data

  // Hitung statistik level
  const countByLevel = siswaBerisiko.reduce((acc: Record<string, number>, s) => {
    acc[s.level] = (acc[s.level] || 0) + 1
    return acc
  }, {})

  const maxKasus = Math.max(...perBulan.map((b: any) => b.jumlah), 1)
  const bulanLabels = perBulan.map((b: any) => {
    const [, m] = (b.bulan as string).split('-')
    return ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][parseInt(m) - 1] || m
  })

  const filteredSiswa = filterLevel === 'all' ? siswaBerisiko : siswaBerisiko.filter((s: any) => s.level === filterLevel)

  return (
    <div className="space-y-6">

      {/* ── KARTU RINGKASAN ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Kasus', value: ringkasan.total_kasus, icon: BarChart3, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
          { label: 'Total Poin Beban', value: ringkasan.total_poin, icon: Flame, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/30' },
          { label: 'Siswa Perlu Perhatian', value: (countByLevel.perhatian || 0) + (countByLevel.peringatan || 0) + (countByLevel.kritis || 0), icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
          { label: 'Siswa Kritis', value: countByLevel.kritis || 0, icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
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
              // Tampilkan hanya tingkat-nomor_kelas (mis. "9-3"), tanpa kelompok/jurusan
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

      {/* ── SISWA BERISIKO ── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-500" /> Radar Siswa Perlu Tindakan
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', 'kritis', 'peringatan', 'perhatian'] as const).map(lv => (
              <button key={lv} onClick={() => setFilterLevel(lv)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${filterLevel === lv ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                {lv === 'all' ? 'Semua' : LEVEL_MAP[lv].label}
                {lv !== 'all' && ` (${countByLevel[lv] || 0})`}
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
              const lv = LEVEL_MAP[s.level as keyof typeof LEVEL_MAP] || LEVEL_MAP.aman
              const kelas = s.tingkat ? `${s.tingkat}-${s.nomor_kelas}` : 'N/A'
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  {/* Credit Score Ring */}
                  <div className="relative shrink-0">
                    <CreditScoreRing score={s.credit_score} max={thresholds.creditAwal} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{s.credit_score}</span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{s.nama_lengkap}</p>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border ${lv.bg} ${lv.text} ${lv.border}`}>
                        {lv.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Kelas {kelas} · {s.jumlah_kasus} kasus · {s.total_poin} poin akumulasi</p>
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

      {/* ── KONFIGURASI THRESHOLD — Modal (Admin Only) ── */}
      {isAdmin && (
        <>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(true)}
              className="h-8 text-xs gap-1.5 border-slate-200 dark:border-slate-700"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Konfigurasi Aturan Peringatan
            </Button>
          </div>

          <Dialog open={showConfig} onOpenChange={setShowConfig}>
            <DialogContent className="sm:max-w-md rounded-xl">
              <DialogHeader className="border-b pb-3">
                <DialogTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-slate-500" />
                  Konfigurasi Aturan Peringatan
                </DialogTitle>
              </DialogHeader>

              <div className="py-3 space-y-4">
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 flex gap-2 text-xs text-blue-700 dark:text-blue-400">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>Atur batas poin akumulasi untuk setiap level peringatan. Credit Score siswa dihitung dari: <strong>Credit Score Awal − Total Poin Pelanggaran</strong>.</p>
                </div>

                <form action={configAction} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'threshold_perhatian',  label: 'Batas Perhatian',  desc: 'Siswa perlu dipantau',         current: thresholds.perhatian  },
                      { key: 'threshold_peringatan', label: 'Batas Peringatan', desc: 'Peringatan keras / SP',        current: thresholds.peringatan },
                      { key: 'threshold_kritis',     label: 'Batas Kritis',     desc: 'Tindakan khusus',             current: thresholds.kritis     },
                      { key: 'credit_score_awal',    label: 'Credit Score Awal',desc: 'Nilai awal tiap TA',          current: thresholds.creditAwal  },
                    ].map(field => (
                      <div key={field.key} className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">{field.label}</Label>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{field.desc}</p>
                        <Input name={field.key} type="number" min="1" defaultValue={field.current}
                          className="h-8 text-sm" />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      {configState?.success && (
                        <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />{configState.success}
                        </p>
                      )}
                      {configState?.error && (
                        <p className="text-xs text-red-500">{configState.error}</p>
                      )}
                    </div>
                    <Button type="submit" disabled={isConfigPending} size="sm"
                      className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white text-xs">
                      {isConfigPending ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                  </div>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
