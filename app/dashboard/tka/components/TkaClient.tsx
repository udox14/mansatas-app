'use client'
// app/dashboard/tka/components/TkaClient.tsx

import { useState, useTransition, useEffect, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Upload, Loader2, CheckCircle2, AlertCircle, Users, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { upsertMapelPilihan, saveHasilTka, updateHasilMatch } from '../actions'
import { MAPEL_TKA, getKategori, KATEGORI_COLOR, ALLOWED_ROLES_TKA } from '@/lib/tka/types'
import { matchName, CONFIDENCE_THRESHOLD } from '@/lib/tka/fuzzy'
import { parseTkaPdf } from '@/lib/tka/pdf-parser'

// ── Types ─────────────────────────────────────────────────────
type SiswaRow = {
  id: string; nisn: string; nama_lengkap: string
  tingkat: number; nomor_kelas: number; kelompok: string
  mapel_pilihan_1: string | null; mapel_pilihan_2: string | null
}
type HasilRow = {
  id: string; siswa_id: string | null; raw_nama_pdf: string; nomor_peserta: string | null
  nilai_bind: number | null; nilai_mat: number | null; nilai_bing: number | null
  mapel_p1: string | null; nilai_p1: number | null; mapel_p2: string | null; nilai_p2: number | null
  match_confidence: number; nama_siswa: string | null; kelas_nama: string | null
}
type MatchRow = {
  idx: number; nomor_peserta: string; raw_nama: string
  siswa_id: string | null; nama_siswa: string | null
  confidence: number; needs_review: boolean
  candidates: { siswa_id: string; nama: string; score: number }[]
  nilai_bind: number | null; nilai_mat: number | null; nilai_bing: number | null
  mapel_p1: string; nilai_p1: number | null; mapel_p2: string; nilai_p2: number | null
}
type Props = {
  siswaList: SiswaRow[]
  rekap: { pilihan1: { mapel: string; count: number }[]; pilihan2: { mapel: string; count: number }[] }
  hasilList: HasilRow[]
  analitik: { avg: any; dist: any; top10: any[]; popularP1: any[]; popularP2: any[] }
  tahunAjaranId: string
}

const NONE = '__none__'

// ── NilaiBadge ────────────────────────────────────────────────
function NilaiBadge({ nilai }: { nilai: number | null }) {
  if (nilai === null) return <span className="text-slate-400 text-xs">-</span>
  const kat = getKategori(nilai)
  return (
    <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium border', KATEGORI_COLOR[kat])}>
      {nilai.toFixed(2)}
    </span>
  )
}

// ── Main Component ────────────────────────────────────────────
export function TkaClient({ siswaList, rekap, hasilList, analitik, tahunAjaranId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [pdfJsReady, setPdfJsReady] = useState(false)

  // Load PDF.js via useEffect — sama seperti pola SheetJS di psikotes
  useEffect(() => {
    if ((window as any).pdfjsLib) { setPdfJsReady(true); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.async = true
    script.onload = () => {
      ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      setPdfJsReady(true)
    }
    script.onerror = () => console.error('Gagal memuat PDF.js')
    document.head.appendChild(script)
  }, [])

  return (
    <Tabs defaultValue="mapel">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="mapel" className="flex-1 sm:flex-none gap-2">
          <Users className="h-4 w-4" />
          <span>Mapel Pilihan</span>
        </TabsTrigger>
        <TabsTrigger value="hasil" className="flex-1 sm:flex-none gap-2">
          <BarChart2 className="h-4 w-4" />
          <span>Hasil &amp; Analitik</span>
          {hasilList.length > 0 && (
            <span className="ml-1 bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 text-xs rounded-full px-1.5 py-0.5 font-medium">
              {hasilList.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="mapel" className="mt-4">
        <MapelPilihanSection
          siswaList={siswaList}
          rekap={rekap}
          tahunAjaranId={tahunAjaranId}
          isPending={isPending}
          startTransition={startTransition}
        />
      </TabsContent>

      <TabsContent value="hasil" className="mt-4">
        <HasilSection
          hasilList={hasilList}
          analitik={analitik}
          allSiswa={siswaList.map(s => ({ id: s.id, nama_lengkap: s.nama_lengkap }))}
          tahunAjaranId={tahunAjaranId}
          pdfJsReady={pdfJsReady}
          isPending={isPending}
          startTransition={startTransition}
        />
      </TabsContent>
    </Tabs>
  )
}

// ══════════════════════════════════════════════════════════════
// MAPEL PILIHAN SECTION
// ══════════════════════════════════════════════════════════════
function MapelPilihanSection({ siswaList, rekap, tahunAjaranId, isPending, startTransition }: {
  siswaList: SiswaRow[]; rekap: Props['rekap']; tahunAjaranId: string
  isPending: boolean; startTransition: any
}) {
  const [search, setSearch] = useState('')
  const [rekapModal, setRekapModal] = useState<{ mapel: string; pilihan: 1 | 2 } | null>(null)
  const [rekapSiswa, setRekapSiswa] = useState<any[]>([])
  const [rekapPage, setRekapPage] = useState(1)
  const [loadingRekap, setLoadingRekap] = useState(false)

  // Optimistic local state
  const [localMapel, setLocalMapel] = useState<Record<string, { p1: string | null; p2: string | null }>>(
    () => Object.fromEntries(siswaList.map(s => [s.id, { p1: s.mapel_pilihan_1, p2: s.mapel_pilihan_2 }]))
  )

  const filtered = siswaList.filter(s =>
    s.nama_lengkap.toLowerCase().includes(search.toLowerCase()) || s.nisn.includes(search)
  )
  const grouped = filtered.reduce<Record<string, SiswaRow[]>>((acc, s) => {
    const key = `XII ${s.kelompok} ${s.nomor_kelas}`
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  function handleChange(siswaId: string, pilihan: 1 | 2, value: string) {
    const val = value === NONE ? null : value
    const prev = localMapel[siswaId] ?? { p1: null, p2: null }
    const next = { p1: pilihan === 1 ? val : prev.p1, p2: pilihan === 2 ? val : prev.p2 }
    setLocalMapel(m => ({ ...m, [siswaId]: next }))
    startTransition(async () => {
      const res = await upsertMapelPilihan(siswaId, tahunAjaranId, next.p1, next.p2)
      if (!res.ok) {
        setLocalMapel(m => ({ ...m, [siswaId]: prev }))
        alert('Gagal menyimpan, coba lagi.')
      }
    })
  }

  async function openRekap(mapel: string, pilihan: 1 | 2) {
    setRekapModal({ mapel, pilihan })
    setRekapPage(1)
    setLoadingRekap(true)
    try {
      const res = await fetch(`/api/tka/siswa-by-mapel?ta=${tahunAjaranId}&mapel=${encodeURIComponent(mapel)}&pilihan=${pilihan}`)
      const data = await res.json()
      setRekapSiswa(data.rows ?? [])
    } finally { setLoadingRekap(false) }
  }

  // Merge rekap
  const rekapMap = new Map<string, { p1: number; p2: number }>()
  for (const r of rekap.pilihan1) rekapMap.set(r.mapel, { p1: r.count, p2: 0 })
  for (const r of rekap.pilihan2) {
    if (rekapMap.has(r.mapel)) rekapMap.get(r.mapel)!.p2 = r.count
    else rekapMap.set(r.mapel, { p1: 0, p2: r.count })
  }
  const rekapArr = [...rekapMap.entries()].sort((a, b) => (b[1].p1 + b[1].p2) - (a[1].p1 + a[1].p2))
  const totalIsi = Object.values(localMapel).filter(v => v.p1 || v.p2).length
  const PER_PAGE = 15
  const pagedRekap = rekapSiswa.slice((rekapPage - 1) * PER_PAGE, rekapPage * PER_PAGE)
  const totalPagesRekap = Math.ceil(rekapSiswa.length / PER_PAGE)

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Siswa Kelas 12', value: siswaList.length, cls: 'text-slate-800 dark:text-slate-100' },
          { label: 'Sudah Pilih', value: totalIsi, cls: 'text-emerald-600' },
          { label: 'Belum Pilih', value: siswaList.length - totalIsi, cls: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-1', s.cls)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Rekap bar */}
      {rekapArr.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <p className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-200">Rekapitulasi Pemilihan Mapel</p>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {rekapArr.map(([mapel, { p1, p2 }]) => (
              <div key={mapel} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{mapel}</span>
                <button onClick={() => openRekap(mapel, 1)} className="text-blue-600 hover:underline font-medium shrink-0">P1:{p1}</button>
                <button onClick={() => openRekap(mapel, 2)} className="text-purple-600 hover:underline font-medium shrink-0">P2:{p2}</button>
                <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shrink-0">
                  <div className="h-full bg-sky-500 rounded-full"
                    style={{ width: `${Math.min(100, ((p1 + p2) / siswaList.length) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Cari nama atau NISN..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {siswaList.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-12 text-center">
          <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Tidak ada siswa kelas 12 aktif pada tahun ajaran ini.</p>
        </div>
      )}

      {/* Tabel per kelas */}
      {Object.entries(grouped).map(([kelas, siswas]) => {
        const isi = siswas.filter(s => localMapel[s.id]?.p1 || localMapel[s.id]?.p2).length
        return (
          <div key={kelas} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
            <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
              <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{kelas}</span>
              <span className={cn('text-xs font-medium', isi === siswas.length ? 'text-emerald-600' : 'text-slate-400')}>
                {isi}/{siswas.length} terisi
              </span>
            </div>
            {/* Mobile: card view, Desktop: table */}
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                    <th className="text-left px-4 py-2 font-medium w-8">#</th>
                    <th className="text-left px-4 py-2 font-medium">Nama Siswa</th>
                    <th className="text-left px-3 py-2 font-medium w-48">Pilihan 1</th>
                    <th className="text-left px-3 py-2 font-medium w-48">Pilihan 2</th>
                  </tr>
                </thead>
                <tbody>
                  {siswas.map((s, idx) => {
                    const cur = localMapel[s.id] ?? { p1: null, p2: null }
                    return (
                      <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2 text-slate-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-2">
                          <p className="font-medium text-slate-800 dark:text-slate-100">{s.nama_lengkap}</p>
                          <p className="text-xs text-slate-400">{s.nisn}</p>
                        </td>
                        <td className="px-3 py-1.5">
                          <Select value={cur.p1 ?? NONE} onValueChange={v => handleChange(s.id, 1, v)} disabled={isPending}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih mapel..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>— Kosong —</SelectItem>
                              {MAPEL_TKA.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-1.5">
                          <Select value={cur.p2 ?? NONE} onValueChange={v => handleChange(s.id, 2, v)} disabled={isPending}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih mapel..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>— Kosong —</SelectItem>
                              {MAPEL_TKA.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile card layout */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {siswas.map((s, idx) => {
                const cur = localMapel[s.id] ?? { p1: null, p2: null }
                return (
                  <div key={s.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm text-slate-800 dark:text-slate-100">{s.nama_lengkap}</p>
                        <p className="text-xs text-slate-400">{s.nisn}</p>
                      </div>
                      <span className="text-xs text-slate-400">#{idx + 1}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Pilihan 1</p>
                        <Select value={cur.p1 ?? NONE} onValueChange={v => handleChange(s.id, 1, v)} disabled={isPending}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>— Kosong —</SelectItem>
                            {MAPEL_TKA.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Pilihan 2</p>
                        <Select value={cur.p2 ?? NONE} onValueChange={v => handleChange(s.id, 2, v)} disabled={isPending}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>— Kosong —</SelectItem>
                            {MAPEL_TKA.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Rekap modal */}
      <Dialog open={!!rekapModal} onOpenChange={() => setRekapModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm leading-snug">
              {rekapModal?.mapel}
              <span className="text-slate-400 font-normal ml-1">— Pilihan {rekapModal?.pilihan}</span>
            </DialogTitle>
          </DialogHeader>
          {loadingRekap
            ? <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">{rekapSiswa.length} siswa</p>
                <ScrollArea className="max-h-72">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-xs text-slate-500"><th className="text-left py-1.5 font-medium">Nama</th><th className="text-left py-1.5 font-medium">Kelas</th></tr></thead>
                    <tbody>
                      {pagedRekap.map((s: any, i: number) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1.5 text-sm">{s.nama_lengkap}</td>
                          <td className="py-1.5 text-xs text-slate-400">XII {s.kelompok} {s.nomor_kelas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
                {totalPagesRekap > 1 && (
                  <div className="flex items-center justify-between pt-1">
                    <Button size="sm" variant="outline" disabled={rekapPage === 1} onClick={() => setRekapPage(p => p - 1)}>Prev</Button>
                    <span className="text-xs text-slate-400">{rekapPage}/{totalPagesRekap}</span>
                    <Button size="sm" variant="outline" disabled={rekapPage === totalPagesRekap} onClick={() => setRekapPage(p => p + 1)}>Next</Button>
                  </div>
                )}
              </div>
            )
          }
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// HASIL SECTION
// ══════════════════════════════════════════════════════════════
function HasilSection({ hasilList, analitik, allSiswa, tahunAjaranId, pdfJsReady, isPending, startTransition }: {
  hasilList: HasilRow[]; analitik: Props['analitik']
  allSiswa: { id: string; nama_lengkap: string }[]
  tahunAjaranId: string; pdfJsReady: boolean
  isPending: boolean; startTransition: any
}) {
  const [activeTab, setActiveTab] = useState('tabel')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [detailRow, setDetailRow] = useState<HasilRow | null>(null)
  const [uploading, setUploading] = useState(false)
  const [matchRows, setMatchRows] = useState<MatchRow[]>([])
  const [showReview, setShowReview] = useState(false)

  const PER_PAGE = 25
  const filtered = hasilList.filter(r =>
    (r.nama_siswa ?? r.raw_nama_pdf).toLowerCase().includes(search.toLowerCase())
  )
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const unlinkedCount = hasilList.filter(r => r.match_confidence < CONFIDENCE_THRESHOLD).length

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!pdfJsReady) { alert('PDF.js masih dimuat, tunggu sebentar lalu coba lagi.'); return }
    setUploading(true)
    try {
      const { rows: pdfRows, errors } = await parseTkaPdf(file)
      if (errors.length) console.warn('PDF parse warnings:', errors)
      const matched: MatchRow[] = pdfRows.map((r, idx) => {
        const m = matchName(r.nama, allSiswa)
        return { idx, nomor_peserta: r.nomor_peserta, raw_nama: r.nama, siswa_id: m.siswa_id, nama_siswa: m.nama_matched, confidence: m.confidence, needs_review: m.needs_review, candidates: m.candidates, nilai_bind: r.nilai_bind, nilai_mat: r.nilai_mat, nilai_bing: r.nilai_bing, mapel_p1: r.mapel_p1, nilai_p1: r.nilai_p1, mapel_p2: r.mapel_p2, nilai_p2: r.nilai_p2 }
      })
      setMatchRows(matched)
      setShowReview(true)
    } catch (err) {
      alert('Gagal membaca PDF: ' + String(err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function updateMatch(idx: number, siswa_id: string | null) {
    const siswa = siswa_id ? allSiswa.find(s => s.id === siswa_id) : null
    setMatchRows(prev => prev.map((r, i) => i === idx ? { ...r, siswa_id, nama_siswa: siswa?.nama_lengkap ?? null, needs_review: false, confidence: 100 } : r))
  }

  function handleSaveAll() {
    startTransition(async () => {
      const rows = matchRows.map(r => ({
        nomor_peserta: r.nomor_peserta, raw_nama_pdf: r.raw_nama, siswa_id: r.siswa_id,
        match_confidence: r.confidence, nilai_bind: r.nilai_bind, nilai_mat: r.nilai_mat, nilai_bing: r.nilai_bing,
        mapel_p1: r.mapel_p1 || null, nilai_p1: r.nilai_p1, mapel_p2: r.mapel_p2 || null, nilai_p2: r.nilai_p2,
      }))
      const res = await saveHasilTka(tahunAjaranId, rows)
      if (res.ok) { alert(`${res.saved} data berhasil disimpan.`); setShowReview(false); setMatchRows([]) }
      else alert('Gagal: ' + res.error)
    })
  }

  const needsReview = matchRows.filter(r => r.needs_review)
  const COLORS = ['#16a34a', '#2563eb', '#d97706', '#dc2626']
  const LABELS = ['Istimewa', 'Baik', 'Memadai', 'Kurang']

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center space-y-3">
        <Upload className="h-8 w-8 text-slate-300 mx-auto" />
        <div>
          <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">Upload File PDF Hasil TKA</p>
          <p className="text-xs text-slate-400 mt-0.5">File DKHTKA resmi dari kemendikdasmen.go.id</p>
        </div>
        <label className="cursor-pointer inline-block">
          <Button variant="outline" size="sm" disabled={uploading} asChild>
            <span className="flex items-center gap-2">
              {uploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Memproses...</> : <><Upload className="h-3.5 w-3.5" />{hasilList.length > 0 ? 'Upload Ulang (Replace)' : 'Pilih File PDF'}</>}
            </span>
          </Button>
          <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={uploading} />
        </label>
        {!pdfJsReady && <p className="text-xs text-slate-400 animate-pulse">Memuat PDF.js...</p>}
        {hasilList.length > 0 && <p className="text-xs text-emerald-600 flex items-center justify-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{hasilList.length} data tersimpan</p>}
      </div>

      {hasilList.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="tabel">Tabel Hasil</TabsTrigger>
            <TabsTrigger value="analitik">Analitik</TabsTrigger>
          </TabsList>

          <TabsContent value="tabel" className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Cari nama..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
              </div>
              <span className="text-xs text-slate-400">{filtered.length} peserta</span>
              {unlinkedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                  <AlertCircle className="h-3 w-3" />{unlinkedCount} belum terlink
                </span>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                      <th className="text-left px-4 py-2.5 font-medium">Nama Siswa</th>
                      <th className="text-left px-3 py-2.5 font-medium">Kelas</th>
                      <th className="text-center px-3 py-2.5 font-medium">B.Indo</th>
                      <th className="text-center px-3 py-2.5 font-medium">Mat</th>
                      <th className="text-center px-3 py-2.5 font-medium">B.Ing</th>
                      <th className="text-left px-3 py-2.5 font-medium hidden lg:table-cell">Pilihan 1</th>
                      <th className="text-left px-3 py-2.5 font-medium hidden lg:table-cell">Pilihan 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(r => (
                      <tr key={r.id} onClick={() => setDetailRow(r)}
                        className={cn('border-b border-slate-50 dark:border-slate-800 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors',
                          r.match_confidence < CONFIDENCE_THRESHOLD && 'bg-amber-50/50 dark:bg-amber-950/10'
                        )}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-slate-800 dark:text-slate-100">{r.nama_siswa ?? r.raw_nama_pdf}</p>
                          {r.match_confidence < CONFIDENCE_THRESHOLD && (
                            <span className="text-xs text-amber-600 bg-amber-100 rounded px-1">unlinked</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-400">{r.kelas_nama ?? '-'}</td>
                        <td className="px-3 py-2.5 text-center"><NilaiBadge nilai={r.nilai_bind} /></td>
                        <td className="px-3 py-2.5 text-center"><NilaiBadge nilai={r.nilai_mat} /></td>
                        <td className="px-3 py-2.5 text-center"><NilaiBadge nilai={r.nilai_bing} /></td>
                        <td className="px-3 py-2.5 text-xs text-slate-500 truncate max-w-[130px] hidden lg:table-cell">{r.mapel_p1 ?? '-'}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500 truncate max-w-[130px] hidden lg:table-cell">{r.mapel_p2 ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile card */}
              <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {paged.map(r => (
                  <div key={r.id} onClick={() => setDetailRow(r)}
                    className={cn('p-3 cursor-pointer active:bg-slate-50', r.match_confidence < CONFIDENCE_THRESHOLD && 'bg-amber-50/50')}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm text-slate-800 dark:text-slate-100">{r.nama_siswa ?? r.raw_nama_pdf}</p>
                        <p className="text-xs text-slate-400">{r.kelas_nama ?? '-'}</p>
                      </div>
                      {r.match_confidence < CONFIDENCE_THRESHOLD && <span className="text-xs text-amber-600 bg-amber-100 rounded px-1.5">unlinked</span>}
                    </div>
                    <div className="flex gap-3">
                      {[['B.Indo', r.nilai_bind], ['Mat', r.nilai_mat], ['B.Ing', r.nilai_bing]].map(([l, v]) => (
                        <div key={l as string} className="text-center">
                          <p className="text-xs text-slate-400">{l}</p>
                          <NilaiBadge nilai={v as number | null} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <span className="text-xs text-slate-400">{page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analitik" className="mt-3 space-y-4">
            {!analitik.avg?.total_peserta
              ? <p className="text-sm text-slate-400 text-center py-8">Belum ada data.</p>
              : <>
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Peserta', value: analitik.avg.total_peserta, sub: '' },
                    { label: 'Rata-rata B.Indo', value: analitik.avg.avg_bind?.toFixed(1) ?? '-', sub: '' },
                    { label: 'Rata-rata Mat', value: analitik.avg.avg_mat?.toFixed(1) ?? '-', sub: '' },
                    { label: 'Rata-rata B.Ing', value: analitik.avg.avg_bing?.toFixed(1) ?? '-', sub: '' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                      <p className="text-xs text-slate-500">{s.label}</p>
                      <p className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Distribusi */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                  <p className="text-sm font-semibold mb-4 text-slate-700 dark:text-slate-200">Distribusi Kategori Nilai</p>
                  <div className="space-y-4">
                    {[
                      { key: 'bind', label: 'Bahasa Indonesia' },
                      { key: 'mat',  label: 'Matematika' },
                      { key: 'bing', label: 'Bahasa Inggris' },
                    ].map(m => {
                      const d = analitik.dist ?? {}
                      const counts = [d[`${m.key}_istimewa`]??0, d[`${m.key}_baik`]??0, d[`${m.key}_memadai`]??0, d[`${m.key}_kurang`]??0]
                      const tot = counts.reduce((a, b) => a + b, 0) || 1
                      return (
                        <div key={m.key}>
                          <p className="text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">{m.label}</p>
                          <div className="flex h-5 rounded-lg overflow-hidden gap-px">
                            {counts.map((c, i) => c > 0 && (
                              <div key={i} style={{ width: `${(c / tot) * 100}%`, backgroundColor: COLORS[i] }}
                                title={`${LABELS[i]}: ${c}`} />
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                            {counts.map((c, i) => (
                              <span key={i} className="text-xs" style={{ color: COLORS[i] }}>
                                {LABELS[i]}: <strong>{c}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Top 10 */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                  <p className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-200">Top 10 Peserta</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-xs text-slate-500">
                        <th className="text-left py-1.5 w-6 font-medium">#</th>
                        <th className="text-left py-1.5 font-medium">Nama</th>
                        <th className="text-center py-1.5 font-medium">B.Indo</th>
                        <th className="text-center py-1.5 font-medium">Mat</th>
                        <th className="text-center py-1.5 font-medium">B.Ing</th>
                        <th className="text-right py-1.5 font-medium">Avg</th>
                      </tr></thead>
                      <tbody>
                        {analitik.top10.map((r: any, i: number) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-2 text-slate-400 font-bold text-xs">{i + 1}</td>
                            <td className="py-2 font-medium text-slate-800 dark:text-slate-100">{r.nama_lengkap ?? r.raw_nama_pdf}</td>
                            <td className="py-2 text-center"><NilaiBadge nilai={r.nilai_bind} /></td>
                            <td className="py-2 text-center"><NilaiBadge nilai={r.nilai_mat} /></td>
                            <td className="py-2 text-center"><NilaiBadge nilai={r.nilai_bing} /></td>
                            <td className="py-2 text-right font-bold text-slate-800 dark:text-slate-100">{r.rata_rata}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mapel populer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: 'Mapel Pilihan 1 Terpopuler', data: analitik.popularP1 },
                    { label: 'Mapel Pilihan 2 Terpopuler', data: analitik.popularP2 },
                  ].map(({ label, data }) => (
                    <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                      <p className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-200">{label}</p>
                      <div className="space-y-2">
                        {data.map((r: any, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 w-4 shrink-0">{i + 1}</span>
                            <span className="text-xs flex-1 truncate text-slate-600 dark:text-slate-300">{r.mapel}</span>
                            <span className="text-xs font-semibold text-sky-600 shrink-0">{r.count}</span>
                            <div className="w-14 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shrink-0">
                              <div className="h-full bg-sky-500" style={{ width: `${(r.count / (data[0]?.count || 1)) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            }
          </TabsContent>
        </Tabs>
      )}

      {/* Detail modal */}
      <Dialog open={!!detailRow} onOpenChange={() => setDetailRow(null)}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base leading-snug">{detailRow?.nama_siswa ?? detailRow?.raw_nama_pdf}</DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-4 text-sm">
              <p className="text-xs text-slate-400">No. Peserta: {detailRow.nomor_peserta ?? '-'} · {detailRow.kelas_nama ?? '-'}</p>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mapel Wajib</p>
                {[['Bahasa Indonesia', detailRow.nilai_bind], ['Matematika', detailRow.nilai_mat], ['Bahasa Inggris', detailRow.nilai_bing]].map(([l, v]) => (
                  <div key={l as string} className="flex items-center justify-between">
                    <span className="text-slate-700 dark:text-slate-300">{l}</span>
                    <div className="flex items-center gap-2">
                      <NilaiBadge nilai={v as number | null} />
                      <span className="text-xs text-slate-400 w-14 text-right">{getKategori(v as number | null)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mapel Pilihan</p>
                {[['Pilihan 1', detailRow.mapel_p1, detailRow.nilai_p1], ['Pilihan 2', detailRow.mapel_p2, detailRow.nilai_p2]].map(([l, m, v]) => (
                  <div key={l as string} className="flex items-center justify-between">
                    <span className="text-slate-500">{l}: <span className="text-slate-700 dark:text-slate-300">{(m as string) ?? '-'}</span></span>
                    {v != null && <div className="flex items-center gap-2"><NilaiBadge nilai={v as number} /><span className="text-xs text-slate-400 w-14 text-right">{getKategori(v as number)}</span></div>}
                  </div>
                ))}
              </div>
              {detailRow.match_confidence < CONFIDENCE_THRESHOLD && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-700">Link manual ke siswa</p>
                  <p className="text-xs text-slate-500">Nama PDF: <strong>{detailRow.raw_nama_pdf}</strong></p>
                  <Select onValueChange={v => {
                    startTransition(async () => {
                      const res = await updateHasilMatch(detailRow.id, v, tahunAjaranId)
                      if (res.ok) { alert('Berhasil di-link.'); setDetailRow(null) }
                      else alert('Gagal: ' + res.error)
                    })
                  }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih siswa..." /></SelectTrigger>
                    <SelectContent>
                      {allSiswa.map(s => <SelectItem key={s.id} value={s.id}>{s.nama_lengkap}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Match review dialog */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Review Hasil Parsing PDF</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4 text-sm shrink-0">
            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-4 w-4" />{matchRows.filter(r => !r.needs_review).length} auto-match</span>
            <span className="flex items-center gap-1 text-amber-600"><AlertCircle className="h-4 w-4" />{needsReview.length} perlu konfirmasi</span>
          </div>
          <ScrollArea className="flex-1 pr-3">
            <div className="space-y-3">
              {needsReview.length === 0
                ? <p className="text-sm text-emerald-600 text-center py-6">✓ Semua nama berhasil di-match otomatis!</p>
                : matchRows.map((r, i) => !r.needs_review ? null : (
                  <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.raw_nama}</p>
                    {r.candidates[0] && <p className="text-xs text-slate-500">Kandidat terbaik: {r.candidates[0].nama} ({r.candidates[0].score}%)</p>}
                    <Select onValueChange={v => updateMatch(i, v === '__none__' ? null : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih siswa yang sesuai..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Tidak ada yang cocok —</SelectItem>
                        {r.candidates.map(c => <SelectItem key={c.siswa_id} value={c.siswa_id}>{c.nama} ({c.score}%)</SelectItem>)}
                        <SelectItem value="__sep__" disabled>── Semua siswa ──</SelectItem>
                        {allSiswa.filter(s => !r.candidates.find(c => c.siswa_id === s.id)).map(s => <SelectItem key={s.id} value={s.id}>{s.nama_lengkap}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))
              }
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-3 pt-3 border-t shrink-0">
            <Button variant="outline" onClick={() => setShowReview(false)}>Batal</Button>
            <Button onClick={handleSaveAll} disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Menyimpan...</> : `Simpan ${matchRows.length} Data`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
