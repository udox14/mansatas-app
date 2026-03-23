// Lokasi: app/dashboard/psikotes/components/psikotes-client.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Brain, Search, Upload, Loader2, X, ChevronRight, ChevronDown, ChevronUp,
  BarChart2, Info, Pencil, Trash2, Plus, CheckCircle2, AlertCircle,
  BookOpen, Users, RefreshCw, HelpCircle, Eye
} from 'lucide-react'
import {
  getListPsikotes, getDetailPsikotes, getAnalitikPsikotes,
  fuzzyMatchNama, importPsikotesChunk,
  tambahMapping, editMapping, hapusMapping, hapusPsikotes,
} from '../actions'
import type { RekomMapping } from '../actions'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────
type KelasItem = { id: string; tingkat: number; nomor_kelas: string; kelompok: string }
type Stats = { total: number; superior: number; diatas: number; rata: number; visual: number; auditori: number; kinestetik: number } | null
type PsikotesRow = {
  id: string; siswa_id: string; nama_lengkap: string; nisn: string; foto_url: string | null
  tingkat: number | null; nomor_kelas: string | null; kelas_kelompok: string | null
  iq_score: number | null; iq_klasifikasi: string | null
  riasec: string | null; rekom_jurusan: string | null; rekom_raw: string | null
  mbti: string | null; gaya_belajar: string | null; updated_at: string
}

// ── Kamus Istilah ──────────────────────────────────────────────────────
const KAMUS: { kode: string; nama: string; deskripsi: string; kategori: string }[] = [
  { kode: 'CFIT', nama: 'Culture Fair Intelligence Test', deskripsi: 'Tes kecerdasan yang bebas pengaruh budaya dan bahasa, mengukur kemampuan berpikir murni.', kategori: 'IQ' },
  { kode: 'VER', nama: 'Verbal', deskripsi: 'Kemampuan memahami dan menggunakan bahasa secara efektif, termasuk kosakata dan pemahaman bacaan.', kategori: 'Bakat' },
  { kode: 'NUM', nama: 'Numerikal', deskripsi: 'Kemampuan berhitung, memahami pola angka, dan logika matematis.', kategori: 'Bakat' },
  { kode: 'SKL', nama: 'Skolastik', deskripsi: 'Kemampuan belajar akademis secara umum, mencerminkan potensi keberhasilan di sekolah.', kategori: 'Bakat' },
  { kode: 'ABS', nama: 'Abstrak', deskripsi: 'Kemampuan berpikir non-verbal, memahami pola, bentuk, dan hubungan visual.', kategori: 'Bakat' },
  { kode: 'MEK (Bakat)', nama: 'Mekanikal', deskripsi: 'Kemampuan memahami prinsip mekanis, fisika terapan, dan cara kerja alat.', kategori: 'Bakat' },
  { kode: 'RR', nama: 'Relasi Ruang', deskripsi: 'Kemampuan visualisasi dan manipulasi objek dalam ruang tiga dimensi.', kategori: 'Bakat' },
  { kode: 'KKK', nama: 'Kecepatan & Ketelitian Klerikal', deskripsi: 'Kemampuan bekerja cepat, teliti, dan akurat dalam tugas administratif atau data.', kategori: 'Bakat' },
  { kode: 'PS', nama: 'Personal-Sosial', deskripsi: 'Minat bekerja dengan dan untuk orang lain, membantu, mendidik, dan berinteraksi sosial.', kategori: 'Minat' },
  { kode: 'NAT', nama: 'Natural', deskripsi: 'Minat terhadap alam, biologi, lingkungan, dan ilmu pengetahuan alam.', kategori: 'Minat' },
  { kode: 'MEK (Minat)', nama: 'Mekanikal', deskripsi: 'Minat terhadap mesin, teknologi, teknik, dan cara kerja peralatan.', kategori: 'Minat' },
  { kode: 'BIS', nama: 'Bisnis', deskripsi: 'Minat di bidang ekonomi, kewirausahaan, manajemen, dan dunia bisnis.', kategori: 'Minat' },
  { kode: 'ART', nama: 'Artistik', deskripsi: 'Minat terhadap seni, kreativitas, estetika, musik, dan ekspresi diri.', kategori: 'Minat' },
  { kode: 'SI', nama: 'Sains-Investigatif', deskripsi: 'Minat meneliti, menganalisis, dan memecahkan masalah ilmiah.', kategori: 'Minat' },
  { kode: 'V', nama: 'Visual', deskripsi: 'Gaya belajar dengan melihat: diagram, grafik, video, dan presentasi visual.', kategori: 'Gaya Belajar' },
  { kode: 'M', nama: 'Auditori', deskripsi: 'Gaya belajar dengan mendengar: ceramah, diskusi, musik, dan penjelasan lisan.', kategori: 'Gaya Belajar' },
  { kode: 'K', nama: 'Kinestetik', deskripsi: 'Gaya belajar dengan bergerak dan menyentuh: praktik, eksperimen, dan simulasi.', kategori: 'Gaya Belajar' },
  { kode: 'RIASEC', nama: 'Holland Occupational Themes', deskripsi: 'Model kepribadian karir: Realistic (praktis), Investigative (analitis), Artistic (kreatif), Social (sosial), Enterprising (pemimpin), Conventional (teratur).', kategori: 'Karir' },
  { kode: 'MBTI', nama: 'Myers-Briggs Type Indicator', deskripsi: '16 tipe kepribadian berdasarkan 4 dimensi: E/I (Ekstrover/Introver), S/N (Sensing/Intuition), T/F (Thinking/Feeling), J/P (Judging/Perceiving).', kategori: 'Kepribadian' },
]

// ── Helpers ────────────────────────────────────────────────────────────
const IQ_COLORS: Record<string, string> = {
  'Superior':            'bg-violet-100 text-violet-700 border-violet-200',
  'Di atas rata-rata':   'bg-blue-100 text-blue-700 border-blue-200',
  'Rata-rata':           'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Di bawah rata-rata':  'bg-amber-100 text-amber-700 border-amber-200',
}
const GAYA_COLORS: Record<string, string> = {
  'VISUAL':      'bg-blue-50 text-blue-700 border-blue-200',
  'AUDITORI':    'bg-emerald-50 text-emerald-700 border-emerald-200',
  'KINESTETIK':  'bg-amber-50 text-amber-700 border-amber-200',
}

function Badge({ label, colorClass }: { label: string; colorClass?: string }) {
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', colorClass ?? 'bg-surface-3 text-slate-500 border-surface')}>
      {label}
    </span>
  )
}

// ── Radar Chart SVG ────────────────────────────────────────────────────
function RadarChart({ data, labels, color = '#7c3aed' }: {
  data: number[]; labels: string[]; color?: string
}) {
  const n = data.length
  const cx = 120, cy = 120, r = 90
  const angles = Array.from({ length: n }, (_, i) => (i * 2 * Math.PI) / n - Math.PI / 2)
  const maxVal = 100

  const point = (val: number, i: number) => {
    const ratio = val / maxVal
    return [cx + r * ratio * Math.cos(angles[i]), cy + r * ratio * Math.sin(angles[i])]
  }

  const polygon = data.map((v, i) => point(v, i)).map(p => p.join(',')).join(' ')

  // Grid circles
  const grids = [25, 50, 75, 100]

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-[220px]">
      {/* Grid */}
      {grids.map(g => (
        <polygon key={g}
          points={angles.map((_, i) => {
            const [x, y] = [cx + r * (g/100) * Math.cos(angles[i]), cy + r * (g/100) * Math.sin(angles[i])]
            return `${x},${y}`
          }).join(' ')}
          fill="none" stroke="#e2e8f0" strokeWidth="1"
        />
      ))}
      {/* Axis lines */}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {/* Data polygon */}
      <polygon points={polygon} fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {/* Data points */}
      {data.map((v, i) => {
        const [x, y] = point(v, i)
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />
      })}
      {/* Labels */}
      {labels.map((label, i) => {
        const [x, y] = [cx + (r + 14) * Math.cos(angles[i]), cy + (r + 14) * Math.sin(angles[i])]
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fontWeight="600" fill="#64748b">
            {label}
          </text>
        )
      })}
    </svg>
  )
}

// ── Bar Chart SVG ──────────────────────────────────────────────────────
function BarChart({ data, color = '#7c3aed' }: { data: { label: string; value: number; total: number }[]; color?: string }) {
  const maxVal = Math.max(...data.map(d => d.value), 1)
  const barW = Math.floor(240 / data.length) - 4
  return (
    <svg viewBox={`0 0 240 80`} className="w-full">
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / maxVal) * 55)
        const x = i * (240 / data.length) + 2
        const pct = d.total > 0 ? Math.round(d.value / d.total * 100) : 0
        return (
          <g key={i}>
            <rect x={x} y={60 - h} width={barW} height={h} rx="3" fill={color} fillOpacity="0.85" />
            <text x={x + barW/2} y={58 - h} textAnchor="middle" fontSize="8" fontWeight="700" fill={color}>{d.value}</text>
            <text x={x + barW/2} y={70} textAnchor="middle" fontSize="7" fill="#94a3b8">{d.label}</text>
            <text x={x + barW/2} y={78} textAnchor="middle" fontSize="7" fill="#94a3b8">{pct}%</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Modal Kamus ────────────────────────────────────────────────────────
function ModalKamus({ open, onClose }: { open: boolean; onClose: () => void }) {
  const kategori = [...new Set(KAMUS.map(k => k.kategori))]
  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-xl">
        <DialogHeader className="border-b border-surface-2 pb-3">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-violet-500" /> Kamus Istilah Psikotes
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-1">
          <div className="space-y-4 py-2">
            {kategori.map(kat => (
              <div key={kat}>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 mb-1.5">{kat}</p>
                <div className="space-y-1.5">
                  {KAMUS.filter(k => k.kategori === kat).map(k => (
                    <div key={k.kode} className="flex gap-3 px-2 py-2 rounded-lg hover:bg-surface-2 transition-colors">
                      <div className="shrink-0">
                        <span className="text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded font-mono">{k.kode.split(' ')[0]}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">{k.nama}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed mt-0.5">{k.deskripsi}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal Detail Siswa ─────────────────────────────────────────────────
function ModalDetail({ siswaId, onClose, isAdmin, onDeleted }: {
  siswaId: string; onClose: () => void; isAdmin: boolean; onDeleted: () => void
}) {
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showKamus, setShowKamus] = useState(false)

  useEffect(() => {
    getDetailPsikotes(siswaId).then(d => { setData(d); setIsLoading(false) })
  }, [siswaId])

  const handleDelete = async () => {
    if (!confirm('Hapus data psikotes siswa ini?')) return
    const res = await hapusPsikotes(siswaId)
    if (res.error) { alert(res.error); return }
    onDeleted()
    onClose()
  }

  const bakatData = data ? [
    data.bakat_ver, data.bakat_num, data.bakat_skl,
    data.bakat_abs, data.bakat_mek, data.bakat_rr, data.bakat_kkk
  ].map(v => v ?? 0) : []
  const bakatLabels = ['VER', 'NUM', 'SKL', 'ABS', 'MEK', 'RR', 'KKK']

  const minatData = data ? [
    data.minat_ps, data.minat_nat, data.minat_mek,
    data.minat_bis, data.minat_art, data.minat_si
  ].map(v => v ?? 0) : []
  const minatLabels = ['PS', 'NAT', 'MEK', 'BIS', 'ART', 'SI']

  return (
    <>
      <Dialog open onOpenChange={open => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl rounded-xl max-h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-surface-2 shrink-0">
            {isLoading ? (
              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Memuat data...</span>
              </div>
            ) : data ? (
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {data.foto_url
                    ? <img src={data.foto_url} alt="" className="h-full w-full object-cover" />
                    : <span className="text-sm font-bold text-violet-600">{data.nama_lengkap?.charAt(0)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{data.nama_lengkap}</DialogTitle>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Kelas {data.tingkat}-{data.nomor_kelas} {data.kelas_kelompok}
                    {data.usia_thn ? ` · Usia ${data.usia_thn} thn ${data.usia_bln ?? 0} bln saat tes` : ''}
                  </p>
                </div>
                <button onClick={() => setShowKamus(true)}
                  className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-violet-500 hover:bg-violet-50 transition-colors"
                  title="Kamus Istilah">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            {!isLoading && data && (
              <div className="px-4 py-4 space-y-5">
                {/* IQ & Kepribadian */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="col-span-2 sm:col-span-1 rounded-xl bg-surface-2 border border-surface p-3 text-center">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">IQ (CFIT)</p>
                    <p className="text-3xl font-black text-violet-600 leading-none">{data.iq_score ?? '—'}</p>
                    {data.iq_klasifikasi && (
                      <span className={cn('mt-1.5 inline-block text-[10px] font-semibold px-2 py-0.5 rounded border', IQ_COLORS[data.iq_klasifikasi] ?? 'bg-surface-3 text-slate-500 border-surface')}>
                        {data.iq_klasifikasi}
                      </span>
                    )}
                  </div>
                  <div className="rounded-xl bg-surface-2 border border-surface p-3 text-center">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">MBTI</p>
                    <p className="text-xl font-black text-blue-600">{data.mbti ?? '—'}</p>
                  </div>
                  <div className="rounded-xl bg-surface-2 border border-surface p-3 text-center">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Gaya Belajar</p>
                    {data.gaya_belajar
                      ? <Badge label={data.gaya_belajar} colorClass={GAYA_COLORS[data.gaya_belajar?.toUpperCase()] ?? 'bg-surface-3 text-slate-500 border-surface'} />
                      : <span className="text-sm text-slate-400 dark:text-slate-500">—</span>}
                  </div>
                  <div className="rounded-xl bg-surface-2 border border-surface p-3 text-center">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Rekom Jurusan</p>
                    <p className="text-sm font-bold text-emerald-600">{data.rekom_jurusan ?? data.rekom_raw ?? '—'}</p>
                    {data.rekom_raw && data.rekom_jurusan && data.rekom_raw !== data.rekom_jurusan && (
                      <p className="text-[9px] text-slate-400 dark:text-slate-500">asli: {data.rekom_raw}</p>
                    )}
                  </div>
                </div>

                {/* RIASEC */}
                {data.riasec && (
                  <div className="rounded-xl bg-surface-2 border border-surface p-3">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Kematangan Karir (RIASEC)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.riasec.split(',').map((r: string, i: number) => (
                        <span key={i} className={cn(
                          'text-xs font-semibold px-2.5 py-1 rounded-full border',
                          i === 0 ? 'bg-violet-100 text-violet-700 border-violet-200' :
                          i === 1 ? 'bg-blue-50 text-blue-600 border-blue-200' :
                          'bg-surface text-slate-500 border-surface'
                        )}>{r.trim()}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mapel Pilihan */}
                {data.mapel_pilihan && (
                  <div className="rounded-xl bg-surface-2 border border-surface p-3">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Mata Pelajaran Pilihan</p>
                    <div className="flex flex-wrap gap-1">
                      {data.mapel_pilihan.split(',').map((m: string, i: number) => (
                        <span key={i} className="text-[11px] font-medium px-2 py-0.5 rounded bg-surface border border-surface text-slate-600 dark:text-slate-300">{m.trim()}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Radar Charts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Bakat */}
                  <div className="rounded-xl bg-surface-2 border border-surface p-3">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Profil Bakat</p>
                    <div className="flex flex-col items-center gap-2">
                      <RadarChart data={bakatData} labels={bakatLabels} color="#7c3aed" />
                      <div className="w-full space-y-1">
                        {bakatLabels.map((label, i) => (
                          <div key={label} className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 w-8 shrink-0">{label}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                              <div className="h-full rounded-full bg-violet-500" style={{ width: `${bakatData[i]}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-violet-600 w-6 text-right">{bakatData[i]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Minat */}
                  <div className="rounded-xl bg-surface-2 border border-surface p-3">
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Profil Minat</p>
                    <div className="flex flex-col items-center gap-2">
                      <RadarChart data={minatData} labels={minatLabels} color="#0891b2" />
                      <div className="w-full space-y-1">
                        {minatLabels.map((label, i) => (
                          <div key={label} className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 w-8 shrink-0">{label}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                              <div className="h-full rounded-full bg-cyan-500" style={{ width: `${minatData[i]}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-cyan-600 w-6 text-right">{minatData[i]}</span>
                          </div>
                        ))}
                        {/* Tambahan V, M, K */}
                        {[
                          { l: 'V', v: data.minat_v }, { l: 'M', v: data.minat_m }, { l: 'K', v: data.minat_k }
                        ].map(({ l, v }) => v != null && (
                          <div key={l} className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 w-8 shrink-0">{l}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                              <div className="h-full rounded-full bg-cyan-300" style={{ width: `${v}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-cyan-500 w-6 text-right">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hapus */}
                {isAdmin && (
                  <div className="flex justify-end pt-2 border-t border-surface-2">
                    <button onClick={handleDelete}
                      className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-700 font-medium">
                      <Trash2 className="h-3.5 w-3.5" /> Hapus Data Psikotes
                    </button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <ModalKamus open={showKamus} onClose={() => setShowKamus(false)} />
    </>
  )
}

// ── Tab Daftar Siswa ───────────────────────────────────────────────────
function TabDaftar({ kelasList, isAdmin, userRole }: {
  kelasList: KelasItem[]; isAdmin: boolean; userRole: string
}) {
  const [filterKelas, setFilterKelas] = useState('')
  const [filterRekom, setFilterRekom] = useState('')
  const [filterGaya, setFilterGaya] = useState('')
  const [filterIQ, setFilterIQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<PsikotesRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSiswa, setSelectedSiswa] = useState<string | null>(null)
  const [showKamus, setShowKamus] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const PAGE_SIZE = 20

  const loadData = useCallback(async (p = 1) => {
    setIsLoading(true)
    const res = await getListPsikotes(
      { kelas_id: filterKelas || undefined, rekom_jurusan: filterRekom || undefined,
        gaya_belajar: filterGaya || undefined, iq_klasifikasi: filterIQ || undefined,
        search: search || undefined },
      p, PAGE_SIZE
    )
    setRows(res.rows as PsikotesRow[])
    setTotal(res.total)
    setPage(p)
    setIsLoading(false)
  }, [filterKelas, filterRekom, filterGaya, filterIQ, search])

  useEffect(() => { loadData(1) }, [filterKelas, filterRekom, filterGaya, filterIQ])

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => loadData(1), 400)
    return () => { if (searchRef.current) clearTimeout(searchRef.current) }
  }, [search])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-surface border border-surface rounded-xl p-3 space-y-2">
        {/* Filter row */}
        <div className="flex flex-wrap gap-2">
          <Select value={filterKelas || 'all'} onValueChange={v => setFilterKelas(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-36 text-xs rounded-lg border-surface"><SelectValue placeholder="Semua kelas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Semua kelas</SelectItem>
              {[10,11,12].map(t => {
                const items = kelasList.filter(k => k.tingkat === t)
                if (!items.length) return null
                return <div key={t}>
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Kelas {t}</div>
                  {items.map(k => <SelectItem key={k.id} value={k.id} className="text-xs">{k.tingkat}-{k.nomor_kelas} {k.kelompok}</SelectItem>)}
                </div>
              })}
            </SelectContent>
          </Select>

          <Select value={filterIQ || 'all'} onValueChange={v => setFilterIQ(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-40 text-xs rounded-lg border-surface"><SelectValue placeholder="Semua IQ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Semua klasifikasi IQ</SelectItem>
              {['Superior', 'Di atas rata-rata', 'Rata-rata', 'Di bawah rata-rata'].map(v =>
                <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
              )}
            </SelectContent>
          </Select>

          <Select value={filterGaya || 'all'} onValueChange={v => setFilterGaya(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-36 text-xs rounded-lg border-surface"><SelectValue placeholder="Gaya belajar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Semua gaya belajar</SelectItem>
              {['VISUAL', 'AUDITORI', 'KINESTETIK'].map(v =>
                <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
              )}
            </SelectContent>
          </Select>

          <button onClick={() => { setFilterKelas(''); setFilterRekom(''); setFilterGaya(''); setFilterIQ('') }}
            className="h-8 px-3 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 hover:bg-surface-2 rounded-lg border border-surface transition-colors ml-auto">
            Reset filter
          </button>

          <button onClick={() => setShowKamus(true)}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-violet-500 hover:bg-violet-50 border border-violet-200 transition-colors"
            title="Kamus Istilah">
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama siswa..."
            className="pl-9 h-9 rounded-lg border-surface bg-surface-2 text-xs" />
        </div>
      </div>

      {/* Tabel/List */}
      <div className="bg-surface border border-surface rounded-xl overflow-hidden">
        {/* Header info */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isLoading ? 'Memuat...' : `${total} siswa`}
          </p>
          <button onClick={() => loadData(page)} className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-600 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400 dark:text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Memuat data...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2 text-slate-400 dark:text-slate-500">
            <Brain className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada data psikotes</p>
            <p className="text-xs">Import data dari tab Pengaturan & Import</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-2 border-b border-surface-2">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">Siswa</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">Kelas</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">IQ</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">RIASEC</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">Rekom Jurusan</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">MBTI</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">Gaya Belajar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-2">
                  {rows.map(row => (
                    <tr key={row.siswa_id} onClick={() => setSelectedSiswa(row.siswa_id)}
                      className="hover:bg-surface-2 cursor-pointer transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 overflow-hidden">
                            {row.foto_url ? <img src={row.foto_url} alt="" className="h-full w-full object-cover" />
                              : <span className="text-[10px] font-bold text-violet-600">{row.nama_lengkap?.charAt(0)}</span>}
                          </div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[160px]">{row.nama_lengkap}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {row.tingkat ? `${row.tingkat}-${row.nomor_kelas}` : '—'}
                        <span className="text-slate-400 dark:text-slate-500 ml-1 text-[10px]">{row.kelas_kelompok}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-bold text-violet-600">{row.iq_score ?? '—'}</span>
                          {row.iq_klasifikasi && (
                            <Badge label={row.iq_klasifikasi.replace('Di atas rata-rata', '↑ Rata-rata').replace('Di bawah rata-rata', '↓ Rata-rata')}
                              colorClass={IQ_COLORS[row.iq_klasifikasi]} />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[120px] block">
                          {row.riasec?.split(',').slice(0, 2).join(',') ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {row.rekom_jurusan
                          ? <Badge label={row.rekom_jurusan} colorClass="bg-emerald-50 text-emerald-700 border-emerald-200" />
                          : <span className="text-slate-400 dark:text-slate-500">—</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-blue-600 font-bold">{row.mbti ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        {row.gaya_belajar
                          ? <Badge label={row.gaya_belajar} colorClass={GAYA_COLORS[row.gaya_belajar?.toUpperCase()] ?? 'bg-surface-3 text-slate-500 border-surface'} />
                          : <span className="text-slate-400 dark:text-slate-500">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-surface-2">
              {rows.map(row => (
                <div key={row.siswa_id} onClick={() => setSelectedSiswa(row.siswa_id)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 cursor-pointer transition-colors">
                  <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {row.foto_url ? <img src={row.foto_url} alt="" className="h-full w-full object-cover" />
                      : <span className="text-xs font-bold text-violet-600">{row.nama_lengkap?.charAt(0)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{row.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {row.tingkat ? `${row.tingkat}-${row.nomor_kelas}` : '—'}
                      {row.iq_score ? ` · IQ ${row.iq_score}` : ''}
                    </p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {row.iq_klasifikasi && <Badge label={row.iq_klasifikasi} colorClass={IQ_COLORS[row.iq_klasifikasi]} />}
                      {row.gaya_belajar && <Badge label={row.gaya_belajar} colorClass={GAYA_COLORS[row.gaya_belajar?.toUpperCase()] ?? 'bg-surface-3 text-slate-500 border-surface'} />}
                      {row.rekom_jurusan && <Badge label={row.rekom_jurusan} colorClass="bg-emerald-50 text-emerald-700 border-emerald-200" />}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-2">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Hal. {page} dari {totalPages}</span>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => loadData(page - 1)}
                    className="h-7 px-3 text-xs rounded-lg">← Prev</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => loadData(page + 1)}
                    className="h-7 px-3 text-xs rounded-lg">Next →</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedSiswa && (
        <ModalDetail
          siswaId={selectedSiswa}
          onClose={() => setSelectedSiswa(null)}
          isAdmin={isAdmin}
          onDeleted={() => { setSelectedSiswa(null); loadData(page) }}
        />
      )}
      <ModalKamus open={showKamus} onClose={() => setShowKamus(false)} />
    </div>
  )
}

// ── Tab Analitik ───────────────────────────────────────────────────────
function TabAnalitik({ kelasList }: { kelasList: KelasItem[] }) {
  const [filterKelas, setFilterKelas] = useState('')
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    getAnalitikPsikotes(filterKelas || undefined).then(d => { setData(d); setIsLoading(false) })
  }, [filterKelas])

  const totalSiswa = data?.iqDist?.reduce((a: number, d: any) => a + d.n, 0) ?? 0

  return (
    <div className="space-y-3">
      {/* Filter kelas */}
      <div className="flex items-center gap-2">
        <Select value={filterKelas || 'all'} onValueChange={v => setFilterKelas(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-8 w-44 text-xs rounded-lg border-surface bg-surface">
            <SelectValue placeholder="Semua kelas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Semua kelas</SelectItem>
            {kelasList.map(k => <SelectItem key={k.id} value={k.id} className="text-xs">{k.tingkat}-{k.nomor_kelas} {k.kelompok}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 dark:text-slate-500">{isLoading ? '...' : `${totalSiswa} siswa`}</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-slate-400 dark:text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Memuat analitik...</span>
        </div>
      ) : !data || totalSiswa === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400 dark:text-slate-500">
          <BarChart2 className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm">Belum ada data untuk ditampilkan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">

          {/* IQ Distribusi */}
          <div className="bg-surface border border-surface rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">Distribusi Klasifikasi IQ</p>
            <BarChart color="#7c3aed"
              data={data.iqDist.map((d: any) => ({
                label: d.iq_klasifikasi?.replace('Di atas rata-rata', '↑Avg').replace('Di bawah rata-rata', '↓Avg').replace('Rata-rata', 'Avg') ?? '?',
                value: d.n, total: totalSiswa
              }))}
            />
          </div>

          {/* Gaya Belajar */}
          <div className="bg-surface border border-surface rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">Distribusi Gaya Belajar</p>
            <BarChart color="#0891b2"
              data={data.gayaDist.map((d: any) => ({ label: d.gaya_belajar?.charAt(0) ?? '?', value: d.n, total: totalSiswa }))}
            />
            <div className="flex gap-3 mt-2 justify-center">
              {data.gayaDist.map((d: any) => (
                <div key={d.gaya_belajar} className="flex items-center gap-1">
                  <span className={cn('h-2 w-2 rounded-full', d.gaya_belajar === 'VISUAL' ? 'bg-blue-500' : d.gaya_belajar === 'AUDITORI' ? 'bg-emerald-500' : 'bg-amber-500')} />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{d.gaya_belajar}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rekom Jurusan */}
          <div className="bg-surface border border-surface rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">Rekomendasi Jurusan</p>
            <BarChart color="#059669"
              data={data.rekomDist.map((d: any) => ({ label: d.rekom_jurusan ?? '?', value: d.n, total: totalSiswa }))}
            />
          </div>

          {/* RIASEC */}
          <div className="bg-surface border border-surface rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">Tipe RIASEC Dominan</p>
            <div className="space-y-2">
              {data.riasecDist.slice(0, 6).map((d: any) => (
                <div key={d.tipe} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-violet-600 w-20 shrink-0">{d.tipe}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden">
                    <div className="h-full rounded-full bg-violet-400"
                      style={{ width: `${Math.round(d.n / totalSiswa * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 w-12 text-right shrink-0">{d.n} ({Math.round(d.n/totalSiswa*100)}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* MBTI Top */}
          <div className="bg-surface border border-surface rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">Top 8 MBTI</p>
            <div className="space-y-1.5">
              {data.mbtiDist.map((d: any) => (
                <div key={d.mbti} className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-blue-600 w-10 shrink-0">{d.mbti}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-400"
                      style={{ width: `${Math.round(d.n / totalSiswa * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 w-12 text-right shrink-0">{d.n} ({Math.round(d.n/totalSiswa*100)}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rata-rata Bakat */}
          {data.bakatAvg && (
            <div className="bg-surface border border-surface rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">Rata-rata Profil Bakat</p>
              <RadarChart
                data={['ver','num','skl','abs','mek','rr','kkk'].map(k => data.bakatAvg[k] ?? 0)}
                labels={['VER','NUM','SKL','ABS','MEK','RR','KKK']}
                color="#7c3aed"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab Import ─────────────────────────────────────────────────────────
function TabImport({ mappingList: initialMapping }: { mappingList: RekomMapping[] }) {
  const [activeSubTab, setActiveSubTab] = useState<'mapping' | 'import'>('import')
  const [mappingList, setMappingList] = useState<RekomMapping[]>(initialMapping)

  // Mapping CRUD state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editJurusan, setEditJurusan] = useState('')
  const [editKet, setEditKet] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newJurusan, setNewJurusan] = useState('')
  const [newKet, setNewKet] = useState('')
  const [isSavingMap, setIsSavingMap] = useState(false)

  // Import state
  const fileRef1 = useRef<HTMLInputElement>(null)
  const fileRef2 = useRef<HTMLInputElement>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [matchResults, setMatchResults] = useState<any[]>([])
  const [isMatching, setIsMatching] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 })
  const [importResult, setImportResult] = useState<{ success: number; error: number; errors: string[] } | null>(null)

  // ── Parse Excel di client ──────────────────────────────────────────
  // ── Parse xlsx tanpa library (pure browser native) ──────────────────
  // xlsx = ZIP file → ambil XML dari dalamnya pakai native browser API
  const parseXlsxNative = async (file: File): Promise<string[][]> => {
    // Step 1: Baca sebagai ArrayBuffer
    const ab = await file.arrayBuffer()
    const uint8 = new Uint8Array(ab)

    // Step 2: Parse ZIP manual — cari file entry by name
    const readZipEntry = (name: string): Uint8Array | null => {
      const enc = new TextEncoder()
      const nameBytes = enc.encode(name)
      // Scan local file headers (signature 0x04034b50)
      for (let i = 0; i < uint8.length - 30; i++) {
        if (uint8[i] === 0x50 && uint8[i+1] === 0x4b && uint8[i+2] === 0x03 && uint8[i+3] === 0x04) {
          const compression = uint8[i+8] | (uint8[i+9] << 8)
          const compSize = uint8[i+18] | (uint8[i+19] << 8) | (uint8[i+20] << 16) | (uint8[i+21] << 24)
          const fnLen = uint8[i+26] | (uint8[i+27] << 8)
          const extraLen = uint8[i+28] | (uint8[i+29] << 8)
          const fnStart = i + 30
          const dataStart = fnStart + fnLen + extraLen

          if (fnLen === nameBytes.length) {
            let match = true
            for (let j = 0; j < fnLen; j++) {
              if (uint8[fnStart + j] !== nameBytes[j]) { match = false; break }
            }
            if (match) {
              const data = uint8.slice(dataStart, dataStart + compSize)
              if (compression === 0) return data // stored
              if (compression === 8) {
                // deflate — gunakan DecompressionStream (Chrome 80+, Firefox 113+, Safari 16.4+)
                // Tambah deflate header 0x78 0x9C
                const withHeader = new Uint8Array(data.length + 2)
                withHeader[0] = 0x78; withHeader[1] = 0x9c
                withHeader.set(data, 2)
                return withHeader // akan di-decompress async
              }
            }
          }
        }
      }
      return null
    }

    const decompressDeflate = async (data: Uint8Array): Promise<string> => {
      // xlsx pakai raw deflate (compression method 8 tanpa zlib header)
      // 'deflate-raw' didukung Chrome 103+, Firefox 113+, Safari 16.4+
      // Cast ke ArrayBuffer untuk menghindari SharedArrayBuffer type conflict
      const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
      const format: CompressionFormat = 'deflate-raw'
      const ds = new DecompressionStream(format)
      const writer = ds.writable.getWriter()
      writer.write(new Uint8Array(buf))
      writer.close()
      const chunks: Uint8Array[] = []
      const reader = ds.readable.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      const total = chunks.reduce((a, c) => a + c.length, 0)
      const merged = new Uint8Array(total)
      let offset = 0
      for (const c of chunks) { merged.set(c, offset); offset += c.length }
      return new TextDecoder('utf-8').decode(merged)
    }

    const parseXml = async (entryName: string): Promise<Document | null> => {
      const raw = readZipEntry(entryName)
      if (!raw) return null
      let xmlStr: string
      if (raw[0] === 0x78) {
        xmlStr = await decompressDeflate(raw)
      } else {
        xmlStr = new TextDecoder('utf-8').decode(raw)
      }
      return new DOMParser().parseFromString(xmlStr, 'text/xml')
    }

    // Shared strings
    const sharedStrings: string[] = []
    const ssDoc = await parseXml('xl/sharedStrings.xml')
    if (ssDoc) {
      ssDoc.querySelectorAll('si').forEach(si => {
        // Ambil semua text nodes dalam si, concat
        const texts: string[] = []
        si.querySelectorAll('t').forEach(t => texts.push(t.textContent ?? ''))
        sharedStrings.push(texts.join('') || si.textContent || '')
      })
    }

    // Sheet 1
    const sheetDoc = await parseXml('xl/worksheets/sheet1.xml')
    if (!sheetDoc) return []

    const rows: string[][] = []
    sheetDoc.querySelectorAll('row').forEach(rowEl => {
      const rowIdx = parseInt(rowEl.getAttribute('r') ?? '1') - 1
      while (rows.length <= rowIdx) rows.push([])
      const row = rows[rowIdx]
      rowEl.querySelectorAll('c').forEach(cell => {
        const addr = cell.getAttribute('r') ?? ''
        const colStr = addr.replace(/[0-9]/g, '')
        let colIdx = 0
        for (let ci = 0; ci < colStr.length; ci++) {
          colIdx = colIdx * 26 + (colStr.charCodeAt(ci) - 64)
        }
        colIdx -= 1
        while (row.length <= colIdx) row.push('')
        const t = cell.getAttribute('t')
        const v = cell.querySelector('v')?.textContent ?? ''
        row[colIdx] = t === 's' ? (sharedStrings[parseInt(v)] ?? '') : v
      })
    })
    return rows
  }

  const parseExcel = async () => {
    const f1 = fileRef1.current?.files?.[0]
    const f2 = fileRef2.current?.files?.[0]
    if (!f1 && !f2) { alert('Upload minimal satu file Excel.'); return }

    setIsParsing(true)
    setPreviewData([])
    setMatchResults([])

    try {
      const rekapData = new Map<string, any>()
      const riasecData = new Map<string, any>()

      if (f2) {
        const raw2 = await parseXlsxNative(f2)
        for (const row of raw2) {
          const col0 = row[0]?.trim()
          if (!col0 || !/^\d+$/.test(col0) || !row[1]) continue
          const nama = row[1].trim().toUpperCase()
          if (!nama) continue
          rekapData.set(nama, {
            nama,
            usia_thn: row[3] ? parseInt(row[3]) : null,
            usia_bln: row[4] ? parseInt(row[4]) : null,
            iq_score: row[5] ? parseInt(row[5]) : null,
            iq_klasifikasi: row[6]?.trim() || null,
            bakat_ver: row[7] ? parseInt(row[7]) : null,
            bakat_num: row[8] ? parseInt(row[8]) : null,
            bakat_skl: row[9] ? parseInt(row[9]) : null,
            bakat_abs: row[10] ? parseInt(row[10]) : null,
            bakat_mek: row[11] ? parseInt(row[11]) : null,
            bakat_rr: row[12] ? parseInt(row[12]) : null,
            bakat_kkk: row[13] ? parseInt(row[13]) : null,
            minat_ps: row[14] ? parseInt(row[14]) : null,
            minat_nat: row[15] ? parseInt(row[15]) : null,
            minat_mek: row[16] ? parseInt(row[16]) : null,
            minat_bis: row[17] ? parseInt(row[17]) : null,
            minat_art: row[18] ? parseInt(row[18]) : null,
            minat_si: row[19] ? parseInt(row[19]) : null,
            minat_v: row[20] ? parseInt(row[20]) : null,
            minat_m: row[21] ? parseInt(row[21]) : null,
            minat_k: row[22] ? parseInt(row[22]) : null,
            rekom_raw: row[23]?.trim() || null,
            mbti: row[24]?.trim() || null,
            gaya_belajar: row[25]?.trim().toUpperCase() || null,
          })
        }
      }

      if (f1) {
        const raw1 = await parseXlsxNative(f1)
        for (const row of raw1) {
          const col0 = row[0]?.trim()
          if (!col0 || !/^\d+$/.test(col0) || !row[1]) continue
          const nama = row[1].trim().toUpperCase()
          if (!nama) continue
          riasecData.set(nama, {
            mapel_pilihan: row[2]?.trim() || null,
            riasec: row[3]?.trim().toUpperCase() || null,
          })
        }
      }

      const allNama = new Set([...rekapData.keys(), ...riasecData.keys()])
      const merged = Array.from(allNama).map(nama => ({
        nama,
        ...rekapData.get(nama),
        ...riasecData.get(nama),
      }))

      setPreviewData(merged)

      setIsMatching(true)
      const allNamaList = merged.map(r => r.nama)
      const allResults: any[] = []
      const CHUNK = 30
      for (let i = 0; i < allNamaList.length; i += CHUNK) {
        const chunk = allNamaList.slice(i, i + CHUNK)
        const res = await fuzzyMatchNama(chunk)
        allResults.push(...res)
      }
      setMatchResults(allResults)
      setIsMatching(false)

    } catch (e: any) {
      alert('Gagal parse Excel: ' + (e as Error).message)
      setIsMatching(false)
    }
    setIsParsing(false)
  }

  // ── Import ke DB ───────────────────────────────────────────────────
  const handleImport = async () => {
    const resolved = matchResults.filter(m => m.status === 'matched' && m.matched)
    if (resolved.length === 0) { alert('Tidak ada data yang siap diimport.'); return }
    if (!confirm(`Import ${resolved.length} data psikotes? Data yang sudah ada akan di-update.`)) return

    setIsImporting(true)
    setImportResult(null)
    const CHUNK = 10
    let totalSuccess = 0, totalError = 0
    const allErrors: string[] = []

    setImportProgress({ done: 0, total: resolved.length })

    for (let i = 0; i < resolved.length; i += CHUNK) {
      const chunk = resolved.slice(i, i + CHUNK)
      const rows = chunk.map((m: any) => {
        const d = previewData.find(p => p.nama === m.nama) ?? {}
        return {
          siswa_id: m.matched.siswa_id,
          iq_score: d.iq_score ? Number(d.iq_score) : null,
          iq_klasifikasi: d.iq_klasifikasi ?? null,
          bakat_ver: d.bakat_ver ? Number(d.bakat_ver) : null,
          bakat_num: d.bakat_num ? Number(d.bakat_num) : null,
          bakat_skl: d.bakat_skl ? Number(d.bakat_skl) : null,
          bakat_abs: d.bakat_abs ? Number(d.bakat_abs) : null,
          bakat_mek: d.bakat_mek ? Number(d.bakat_mek) : null,
          bakat_rr: d.bakat_rr ? Number(d.bakat_rr) : null,
          bakat_kkk: d.bakat_kkk ? Number(d.bakat_kkk) : null,
          minat_ps: d.minat_ps ? Number(d.minat_ps) : null,
          minat_nat: d.minat_nat ? Number(d.minat_nat) : null,
          minat_mek: d.minat_mek ? Number(d.minat_mek) : null,
          minat_bis: d.minat_bis ? Number(d.minat_bis) : null,
          minat_art: d.minat_art ? Number(d.minat_art) : null,
          minat_si: d.minat_si ? Number(d.minat_si) : null,
          minat_v: d.minat_v ? Number(d.minat_v) : null,
          minat_m: d.minat_m ? Number(d.minat_m) : null,
          minat_k: d.minat_k ? Number(d.minat_k) : null,
          riasec: d.riasec ?? null,
          mapel_pilihan: d.mapel_pilihan ?? null,
          rekom_raw: d.rekom_raw ? String(d.rekom_raw).trim() : null,
          mbti: d.mbti ?? null,
          gaya_belajar: d.gaya_belajar ?? null,
          usia_thn: d.usia_thn ? Number(d.usia_thn) : null,
          usia_bln: d.usia_bln ? Number(d.usia_bln) : null,
        }
      })

      const res = await importPsikotesChunk(rows)
      totalSuccess += res.success
      totalError += res.error
      allErrors.push(...res.errors)
      setImportProgress({ done: Math.min(i + CHUNK, resolved.length), total: resolved.length })
    }

    setImportResult({ success: totalSuccess, error: totalError, errors: allErrors })
    setIsImporting(false)
  }

  const matchedCount = matchResults.filter(m => m.status === 'matched').length
  const ambigCount = matchResults.filter(m => m.status === 'ambiguous').length
  const notFoundCount = matchResults.filter(m => m.status === 'notfound').length

  return (
    <div className="space-y-3">
      {/* Sub-tab toggle */}
      <div className="flex rounded-lg border border-surface overflow-hidden w-fit">
        <button onClick={() => setActiveSubTab('import')}
          className={cn('px-4 py-1.5 text-xs font-medium transition-colors',
            activeSubTab === 'import' ? 'bg-slate-900 text-white' : 'bg-surface text-slate-500 dark:text-slate-400 hover:bg-surface-2')}>
          Import Data
        </button>
        <button onClick={() => setActiveSubTab('mapping')}
          className={cn('px-4 py-1.5 text-xs font-medium transition-colors',
            activeSubTab === 'mapping' ? 'bg-slate-900 text-white' : 'bg-surface text-slate-500 dark:text-slate-400 hover:bg-surface-2')}>
          Mapping Jurusan
        </button>
      </div>

      {/* ── Sub-tab Mapping ── */}
      {activeSubTab === 'mapping' && (
        <div className="space-y-3">
          <div className="bg-surface border border-surface rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Mapping Label Excel → Jurusan Aplikasi</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Sesuaikan label rekomendasi dari Excel dengan jurusan yang aktif di aplikasi</p>
            </div>
            <div className="divide-y divide-surface-2">
              {mappingList.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 group transition-colors">
                  <span className="font-mono text-xs font-bold text-violet-600 w-20 shrink-0">{m.label_excel}</span>
                  <span className="text-slate-400 dark:text-slate-500 text-xs shrink-0">→</span>
                  {editingId === m.id ? (
                    <>
                      <Input value={editJurusan} onChange={e => setEditJurusan(e.target.value)}
                        className="h-7 text-xs flex-1 rounded border-surface" placeholder="Jurusan DB" />
                      <Input value={editKet} onChange={e => setEditKet(e.target.value)}
                        className="h-7 text-xs flex-1 rounded border-surface" placeholder="Keterangan" />
                      <button onClick={async () => {
                        setIsSavingMap(true)
                        const res = await editMapping(m.id, editJurusan, editKet)
                        if (res.error) alert(res.error)
                        else setMappingList(prev => prev.map(x => x.id === m.id ? { ...x, jurusan_db: editJurusan, keterangan: editKet } : x))
                        setEditingId(null); setIsSavingMap(false)
                      }} disabled={isSavingMap}
                        className="p-1 rounded text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="h-4 w-4" /></button>
                      <button onClick={() => setEditingId(null)}
                        className="p-1 rounded text-slate-400 dark:text-slate-500 hover:bg-surface-3"><X className="h-4 w-4" /></button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-semibold text-emerald-700 flex-1">{m.jurusan_db}</span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 flex-1 truncate">{m.keterangan ?? ''}</span>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                        <button onClick={() => { setEditingId(m.id); setEditJurusan(m.jurusan_db); setEditKet(m.keterangan ?? '') }}
                          className="p-1.5 rounded text-blue-500 hover:bg-blue-50"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={async () => {
                          if (!confirm(`Hapus mapping "${m.label_excel}"?`)) return
                          const res = await hapusMapping(m.id)
                          if (res.error) alert(res.error)
                          else setMappingList(prev => prev.filter(x => x.id !== m.id))
                        }} className="p-1.5 rounded text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {/* Tambah baru */}
            <div className="px-4 py-3 border-t border-surface-2 flex gap-2">
              <Input value={newLabel} onChange={e => setNewLabel(e.target.value.toUpperCase())}
                placeholder="Label (misal: MIA)" className="h-8 text-xs w-24 rounded font-mono font-bold" />
              <Input value={newJurusan} onChange={e => setNewJurusan(e.target.value)}
                placeholder="Jurusan DB" className="h-8 text-xs flex-1 rounded" />
              <Input value={newKet} onChange={e => setNewKet(e.target.value)}
                placeholder="Keterangan (opsional)" className="h-8 text-xs flex-1 rounded" />
              <Button size="sm" onClick={async () => {
                if (!newLabel || !newJurusan) return
                setIsSavingMap(true)
                const res = await tambahMapping(newLabel, newJurusan, newKet)
                if (res.error) alert(res.error)
                else { setMappingList(prev => [...prev, { id: Date.now().toString(), label_excel: newLabel, jurusan_db: newJurusan, keterangan: newKet }]); setNewLabel(''); setNewJurusan(''); setNewKet('') }
                setIsSavingMap(false)
              }} disabled={isSavingMap || !newLabel || !newJurusan}
                className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded gap-1 shrink-0">
                <Plus className="h-3.5 w-3.5" /> Tambah
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-tab Import ── */}
      {activeSubTab === 'import' && (
        <div className="space-y-3">
          {/* Upload area */}
          <div className="bg-surface border border-surface rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Upload File Excel</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">File Rekapitulasi (IQ, Bakat, Minat)</label>
                <input ref={fileRef2} type="file" accept=".xlsx,.xls"
                  className="w-full h-9 text-xs file:mr-2 file:h-full file:border-0 file:bg-violet-50 file:px-3 file:text-xs file:font-medium file:text-violet-700 hover:file:bg-violet-100 rounded-lg border border-surface bg-surface-2 cursor-pointer" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">File RIASEC & Mapel Pilihan</label>
                <input ref={fileRef1} type="file" accept=".xlsx,.xls"
                  className="w-full h-9 text-xs file:mr-2 file:h-full file:border-0 file:bg-violet-50 file:px-3 file:text-xs file:font-medium file:text-violet-700 hover:file:bg-violet-100 rounded-lg border border-surface bg-surface-2 cursor-pointer" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Bisa upload satu atau dua file sekaligus. File boleh berisi banyak kelas dalam satu sheet.</p>
            <Button onClick={parseExcel} disabled={isParsing || isMatching}
              className="h-9 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg gap-2">
              {isParsing || isMatching
                ? <><Loader2 className="h-4 w-4 animate-spin" />{isMatching ? 'Mencocokkan nama...' : 'Membaca file...'}</>
                : <><Upload className="h-4 w-4" /> Baca & Cocokkan Nama</>}
            </Button>
          </div>

          {/* Preview hasil matching */}
          {matchResults.length > 0 && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-emerald-600">{matchedCount}</p>
                  <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">✅ Matched</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-amber-600">{ambigCount}</p>
                  <p className="text-[11px] font-semibold text-amber-700 mt-0.5">⚠️ Ambigu</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-rose-600">{notFoundCount}</p>
                  <p className="text-[11px] font-semibold text-rose-700 mt-0.5">❌ Tidak ditemukan</p>
                </div>
              </div>

              {/* Tabel preview */}
              <div className="bg-surface border border-surface rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-surface-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{matchResults.length} baris data</p>
                  {ambigCount > 0 && <p className="text-[11px] text-amber-600">⚠️ {ambigCount} perlu pilihan manual</p>}
                </div>
                <ScrollArea className="max-h-64">
                  <div className="divide-y divide-surface-2">
                    {matchResults.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2 text-xs">
                        <div className="w-4 shrink-0">
                          {m.status === 'matched' && <span className="text-emerald-500">✓</span>}
                          {m.status === 'ambiguous' && <span className="text-amber-500">?</span>}
                          {m.status === 'notfound' && <span className="text-rose-500">✗</span>}
                        </div>
                        <span className="flex-1 font-medium text-slate-700 dark:text-slate-200 truncate">{m.nama}</span>
                        {m.status === 'matched' && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[160px]">
                            → {m.matched.nama_lengkap} ({m.matched.kelas})
                          </span>
                        )}
                        {m.status === 'ambiguous' && (
                          <select className="text-xs border border-amber-200 rounded px-1 py-0.5 bg-amber-50 text-amber-700"
                            onChange={e => {
                              const chosen = m.candidates.find((c: any) => c.siswa_id === e.target.value)
                              setMatchResults(prev => prev.map((x, j) => j === i
                                ? { ...x, status: 'matched', matched: chosen }
                                : x
                              ))
                            }}>
                            <option value="">-- Pilih --</option>
                            {m.candidates.map((c: any) => (
                              <option key={c.siswa_id} value={c.siswa_id}>{c.nama_lengkap} ({c.kelas})</option>
                            ))}
                          </select>
                        )}
                        {m.status === 'notfound' && (
                          <span className="text-[11px] text-rose-400 italic">tidak ditemukan di DB</span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Import button */}
              <div className="flex items-center gap-3">
                <Button onClick={handleImport} disabled={isImporting || matchedCount === 0}
                  className="h-9 bg-slate-900 hover:bg-slate-800 text-white text-sm rounded-lg gap-2">
                  {isImporting
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Importing... ({importProgress.done}/{importProgress.total})</>
                    : `Import ${matchedCount} data yang matched`}
                </Button>
                {ambigCount > 0 && (
                  <p className="text-[11px] text-amber-600">{ambigCount} data ambigu akan dilewati jika belum dipilih</p>
                )}
              </div>

              {/* Import result */}
              {importResult && (
                <div className={cn('p-3 rounded-xl border text-xs space-y-1',
                  importResult.error === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800')}>
                  <div className="flex items-center gap-2 font-semibold">
                    {importResult.error === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    Import selesai: {importResult.success} berhasil, {importResult.error} gagal
                  </div>
                  {importResult.errors.length > 0 && (
                    <details>
                      <summary className="cursor-pointer opacity-70">{importResult.errors.length} error detail</summary>
                      <div className="mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                        {importResult.errors.map((e, i) => <p key={i} className="font-mono text-[10px]">• {e}</p>)}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── MAIN ────────────────────────────────────────────────────────────────
export function PsikotesClient({ mappingList, kelasList, stats, userRole, isAdmin }: {
  mappingList: RekomMapping[]
  kelasList: KelasItem[]
  stats: Stats
  userRole: string
  isAdmin: boolean
}) {
  const canImport = ['super_admin', 'kepsek', 'guru_bk'].includes(userRole)

  return (
    <div className="space-y-3">
      {/* Stats strip */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-surface border border-surface rounded-xl px-3 py-2.5 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-violet-50 border border-violet-100"><Brain className="h-4 w-4 text-violet-600" /></div>
            <div><p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide font-medium">Total Data</p><p className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight">{stats.total}</p></div>
          </div>
          <div className="bg-surface border border-surface rounded-xl px-3 py-2.5 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-100"><Users className="h-4 w-4 text-blue-600" /></div>
            <div><p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide font-medium">Visual</p><p className="text-lg font-black text-blue-600 leading-tight">{stats.visual}</p></div>
          </div>
          <div className="bg-surface border border-surface rounded-xl px-3 py-2.5 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-100"><BookOpen className="h-4 w-4 text-emerald-600" /></div>
            <div><p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide font-medium">Auditori</p><p className="text-lg font-black text-emerald-600 leading-tight">{stats.auditori}</p></div>
          </div>
          <div className="bg-surface border border-surface rounded-xl px-3 py-2.5 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-100"><BarChart2 className="h-4 w-4 text-amber-600" /></div>
            <div><p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide font-medium">Kinestetik</p><p className="text-lg font-black text-amber-600 leading-tight">{stats.kinestetik}</p></div>
          </div>
        </div>
      )}

      <Tabs defaultValue="daftar" className="space-y-3">
        <TabsList className={cn('bg-surface border border-surface p-0.5 h-auto rounded-lg', canImport ? 'grid grid-cols-3' : 'grid grid-cols-2')}>
          <TabsTrigger value="daftar" className="py-2 rounded-md data-[state=active]:bg-violet-600 data-[state=active]:text-white text-xs font-medium">
            Daftar Siswa
          </TabsTrigger>
          <TabsTrigger value="analitik" className="py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs font-medium">
            Analitik
          </TabsTrigger>
          {canImport && (
            <TabsTrigger value="import" className="py-2 rounded-md data-[state=active]:bg-slate-700 data-[state=active]:text-white text-xs font-medium">
              Pengaturan & Import
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="daftar" className="m-0">
          <TabDaftar kelasList={kelasList} isAdmin={isAdmin} userRole={userRole} />
        </TabsContent>

        <TabsContent value="analitik" className="m-0">
          <TabAnalitik kelasList={kelasList} />
        </TabsContent>

        {canImport && (
          <TabsContent value="import" className="m-0">
            <TabImport mappingList={mappingList} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
