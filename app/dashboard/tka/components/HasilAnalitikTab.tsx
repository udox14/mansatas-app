'use client'
// app/dashboard/tka/components/HasilAnalitikTab.tsx

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { saveHasilTka, updateHasilMatch } from '../actions'
import { parseTkaPdf, initPdfJs } from '@/lib/tka/pdf-parser'
import { matchName, CONFIDENCE_THRESHOLD } from '@/lib/tka/fuzzy'
import { getKategori, KATEGORI_COLOR } from '@/lib/tka/types'

type HasilRow = {
  id: string; siswa_id: string | null; raw_nama_pdf: string; nomor_peserta: string | null
  nilai_bind: number | null; nilai_mat: number | null; nilai_bing: number | null
  mapel_p1: string | null; nilai_p1: number | null; mapel_p2: string | null; nilai_p2: number | null
  match_confidence: number; nama_siswa: string | null; kelas_nama: string | null
}

type MatchRow = {
  idx: number
  nomor_peserta: string
  raw_nama: string
  siswa_id: string | null
  nama_siswa: string | null
  confidence: number
  needs_review: boolean
  candidates: { siswa_id: string; nama: string; score: number }[]
  nilai_bind: number | null; nilai_mat: number | null; nilai_bing: number | null
  mapel_p1: string; nilai_p1: number | null
  mapel_p2: string; nilai_p2: number | null
}

type Props = {
  hasilList: HasilRow[]
  analitik: { avg: any; dist: any; top10: any[]; popularP1: any[]; popularP2: any[] }
  allSiswa: { id: string; nama_lengkap: string }[]
  tahunAjaranId: string
}

function NilaiBadge({ nilai }: { nilai: number | null }) {
  if (nilai === null) return <span className="text-muted-foreground text-xs">-</span>
  const kat = getKategori(nilai)
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${KATEGORI_COLOR[kat]}`}>
      {nilai.toFixed(2)}
    </span>
  )
}

function AnalitikView({ analitik, total }: { analitik: Props['analitik']; total: number }) {
  const avg = analitik.avg
  if (!avg?.total_peserta) return <p className="text-sm text-muted-foreground py-8 text-center">Belum ada data hasil TKA.</p>

  const mapelWajib = [
    { key: 'bind', label: 'Bahasa Indonesia', avg: avg.avg_bind },
    { key: 'mat',  label: 'Matematika',        avg: avg.avg_mat },
    { key: 'bing', label: 'Bahasa Inggris',    avg: avg.avg_bing },
  ]
  const d = analitik.dist ?? {}
  const COLORS = ['#16a34a', '#2563eb', '#d97706', '#dc2626']
  const LABELS = ['Istimewa', 'Baik', 'Memadai', 'Kurang']

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="border rounded-lg p-4 bg-white dark:bg-slate-900">
          <p className="text-xs text-muted-foreground">Total Peserta</p>
          <p className="text-2xl font-bold mt-1">{avg.total_peserta}</p>
        </div>
        {mapelWajib.map(m => (
          <div key={m.key} className="border rounded-lg p-4 bg-white dark:bg-slate-900">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="text-2xl font-bold mt-1">{m.avg?.toFixed(1) ?? '-'}</p>
            <p className="text-xs text-muted-foreground">rata-rata</p>
          </div>
        ))}
      </div>

      {/* Distribusi kategori */}
      <div className="border rounded-lg p-4 bg-white dark:bg-slate-900">
        <p className="text-sm font-medium mb-4">Distribusi Kategori Nilai</p>
        <div className="space-y-5">
          {mapelWajib.map(m => {
            const counts = [d[`${m.key}_istimewa`]??0, d[`${m.key}_baik`]??0, d[`${m.key}_memadai`]??0, d[`${m.key}_kurang`]??0]
            const tot = counts.reduce((a, b) => a + b, 0) || 1
            return (
              <div key={m.key}>
                <p className="text-sm font-medium mb-1.5">{m.label}</p>
                <div className="flex h-5 rounded-full overflow-hidden gap-px">
                  {counts.map((c, i) => c > 0 && (
                    <div key={i} style={{ width: `${(c / tot) * 100}%`, backgroundColor: COLORS[i] }}
                      title={`${LABELS[i]}: ${c} siswa`} />
                  ))}
                </div>
                <div className="flex gap-4 mt-1.5 flex-wrap">
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
      <div className="border rounded-lg p-4 bg-white dark:bg-slate-900">
        <p className="text-sm font-medium mb-3">Top 10 Peserta</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left py-1.5 font-medium w-6">#</th>
              <th className="text-left py-1.5 font-medium">Nama</th>
              <th className="text-right py-1.5 font-medium">B.Indo</th>
              <th className="text-right py-1.5 font-medium">Mat</th>
              <th className="text-right py-1.5 font-medium">B.Ing</th>
              <th className="text-right py-1.5 font-medium">Rata-rata</th>
            </tr>
          </thead>
          <tbody>
            {analitik.top10.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-1.5 text-muted-foreground font-bold text-xs">{i + 1}</td>
                <td className="py-1.5 font-medium">{r.nama_lengkap ?? r.raw_nama_pdf}</td>
                <td className="py-1.5 text-right"><NilaiBadge nilai={r.nilai_bind} /></td>
                <td className="py-1.5 text-right"><NilaiBadge nilai={r.nilai_mat} /></td>
                <td className="py-1.5 text-right"><NilaiBadge nilai={r.nilai_bing} /></td>
                <td className="py-1.5 text-right font-bold text-sm">{r.rata_rata}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mapel populer */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Mapel Pilihan 1 Terpopuler', data: analitik.popularP1 },
          { label: 'Mapel Pilihan 2 Terpopuler', data: analitik.popularP2 },
        ].map(({ label, data }) => (
          <div key={label} className="border rounded-lg p-4 bg-white dark:bg-slate-900">
            <p className="text-sm font-medium mb-3">{label}</p>
            <div className="space-y-2">
              {data.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <span className="text-xs flex-1 truncate">{r.mapel}</span>
                  <span className="text-xs font-semibold text-sky-600 shrink-0">{r.count}</span>
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                    <div className="h-full bg-sky-500"
                      style={{ width: `${(r.count / (data[0]?.count || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HasilAnalitikTab({ hasilList, analitik, allSiswa, tahunAjaranId }: Props) {
  const [isPending, startTransition] = useTransition()
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
    setUploading(true)
    try {
      initPdfJs()
      // Tunggu PDF.js CDN ter-load
      await new Promise(r => setTimeout(r, 500))
      const { rows: pdfRows, errors } = await parseTkaPdf(file)
      if (errors.length) console.warn('PDF parse warnings:', errors)

      const matched: MatchRow[] = pdfRows.map((r, idx) => {
        const m = matchName(r.nama, allSiswa)
        return {
          idx,
          nomor_peserta: r.nomor_peserta,
          raw_nama: r.nama,
          siswa_id: m.siswa_id,
          nama_siswa: m.nama_matched,
          confidence: m.confidence,
          needs_review: m.needs_review,
          candidates: m.candidates,
          nilai_bind: r.nilai_bind,
          nilai_mat: r.nilai_mat,
          nilai_bing: r.nilai_bing,
          mapel_p1: r.mapel_p1,
          nilai_p1: r.nilai_p1,
          mapel_p2: r.mapel_p2,
          nilai_p2: r.nilai_p2,
        }
      })

      setMatchRows(matched)
      setShowReview(true)
    } catch (err) {
      toast.error('Gagal membaca PDF: ' + String(err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function updateMatch(idx: number, siswa_id: string | null) {
    const siswa = siswa_id ? allSiswa.find(s => s.id === siswa_id) : null
    setMatchRows(prev => prev.map((r, i) => i === idx
      ? { ...r, siswa_id, nama_siswa: siswa?.nama_lengkap ?? null, needs_review: false, confidence: 100 }
      : r
    ))
  }

  function handleSaveAll() {
    startTransition(async () => {
      const rows = matchRows.map(r => ({
        nomor_peserta: r.nomor_peserta,
        raw_nama_pdf: r.raw_nama,
        siswa_id: r.siswa_id,
        match_confidence: r.confidence,
        nilai_bind: r.nilai_bind,
        nilai_mat: r.nilai_mat,
        nilai_bing: r.nilai_bing,
        mapel_p1: r.mapel_p1 || null,
        nilai_p1: r.nilai_p1,
        mapel_p2: r.mapel_p2 || null,
        nilai_p2: r.nilai_p2,
      }))
      const res = await saveHasilTka(tahunAjaranId, rows)
      if (res.ok) {
        toast.success(`${res.saved} data berhasil disimpan`)
        setShowReview(false)
        setMatchRows([])
      } else {
        toast.error('Gagal menyimpan: ' + res.error)
      }
    })
  }

  const needsReview = matchRows.filter(r => r.needs_review)
  const autoMatched = matchRows.filter(r => !r.needs_review)

  return (
    <div className="space-y-4">
      {/* PDF.js CDN — load sekali */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" />

      {/* Upload area */}
      <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3 bg-white dark:bg-slate-900">
        <div className="text-3xl">📄</div>
        <p className="font-medium text-sm">Upload File PDF Hasil TKA</p>
        <p className="text-xs text-muted-foreground">File resmi DKHTKA dari kemendikdasmen.go.id</p>
        <label className="cursor-pointer inline-block">
          <Button variant="outline" size="sm" disabled={uploading} asChild>
            <span>{uploading ? '⏳ Memproses...' : hasilList.length > 0 ? '🔄 Upload Ulang (Replace)' : '📂 Pilih File PDF'}</span>
          </Button>
          <input type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} disabled={uploading} />
        </label>
        {hasilList.length > 0 && (
          <p className="text-xs text-green-600">✓ {hasilList.length} data tersimpan</p>
        )}
      </div>

      {hasilList.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="tabel">Tabel Hasil</TabsTrigger>
            <TabsTrigger value="analitik">Analitik</TabsTrigger>
          </TabsList>

          <TabsContent value="tabel" className="space-y-3 mt-3">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Cari nama siswa..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="max-w-xs"
              />
              <span className="text-xs text-muted-foreground">{filtered.length} peserta</span>
              {unlinkedCount > 0 && (
                <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-medium">
                  ⚠ {unlinkedCount} belum terlink
                </span>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b text-xs text-muted-foreground">
                    <th className="text-left px-3 py-2.5 font-medium">Nama Siswa</th>
                    <th className="text-left px-3 py-2.5 font-medium">Kelas</th>
                    <th className="text-center px-3 py-2.5 font-medium">B.Indo</th>
                    <th className="text-center px-3 py-2.5 font-medium">Mat</th>
                    <th className="text-center px-3 py-2.5 font-medium">B.Ing</th>
                    <th className="text-left px-3 py-2.5 font-medium">Pilihan 1</th>
                    <th className="text-left px-3 py-2.5 font-medium">Pilihan 2</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(r => (
                    <tr key={r.id}
                      onClick={() => setDetailRow(r)}
                      className={`border-b last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        r.match_confidence < CONFIDENCE_THRESHOLD ? 'bg-orange-50 dark:bg-orange-950/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium">{r.nama_siswa ?? r.raw_nama_pdf}</span>
                        {r.match_confidence < CONFIDENCE_THRESHOLD && (
                          <span className="ml-2 text-xs bg-orange-100 text-orange-600 rounded px-1">unlinked</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.kelas_nama ?? '-'}</td>
                      <td className="px-3 py-2 text-center"><NilaiBadge nilai={r.nilai_bind} /></td>
                      <td className="px-3 py-2 text-center"><NilaiBadge nilai={r.nilai_mat} /></td>
                      <td className="px-3 py-2 text-center"><NilaiBadge nilai={r.nilai_bing} /></td>
                      <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[140px]">{r.mapel_p1 ?? '-'}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[140px]">{r.mapel_p2 ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analitik" className="mt-3">
            <AnalitikView analitik={analitik} total={hasilList.length} />
          </TabsContent>
        </Tabs>
      )}

      {/* Detail modal */}
      <Dialog open={!!detailRow} onOpenChange={() => setDetailRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detailRow?.nama_siswa ?? detailRow?.raw_nama_pdf}</DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-4 text-sm">
              <p className="text-xs text-muted-foreground">
                No. Peserta: {detailRow.nomor_peserta ?? '-'} · Kelas: {detailRow.kelas_nama ?? '-'}
              </p>

              <div className="space-y-2">
                <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Mapel Wajib</p>
                {[
                  { label: 'Bahasa Indonesia', nilai: detailRow.nilai_bind },
                  { label: 'Matematika',        nilai: detailRow.nilai_mat },
                  { label: 'Bahasa Inggris',    nilai: detailRow.nilai_bing },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between">
                    <span>{m.label}</span>
                    <div className="flex items-center gap-2">
                      <NilaiBadge nilai={m.nilai} />
                      <span className="text-xs text-muted-foreground w-16 text-right">{getKategori(m.nilai)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Mapel Pilihan</p>
                {[
                  { label: 'Pilihan 1', mapel: detailRow.mapel_p1, nilai: detailRow.nilai_p1 },
                  { label: 'Pilihan 2', mapel: detailRow.mapel_p2, nilai: detailRow.nilai_p2 },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {m.label}: <span className="text-foreground">{m.mapel ?? '-'}</span>
                    </span>
                    {m.nilai != null && (
                      <div className="flex items-center gap-2">
                        <NilaiBadge nilai={m.nilai} />
                        <span className="text-xs text-muted-foreground w-16 text-right">{getKategori(m.nilai)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {detailRow.match_confidence < CONFIDENCE_THRESHOLD && (
                <div className="border border-orange-200 rounded-lg p-3 bg-orange-50 dark:bg-orange-950/20 space-y-2">
                  <p className="text-xs font-medium text-orange-700">Link manual ke siswa</p>
                  <p className="text-xs text-muted-foreground">Nama di PDF: <strong>{detailRow.raw_nama_pdf}</strong></p>
                  <Select onValueChange={v => {
                    startTransition(async () => {
                      const res = await updateHasilMatch(detailRow.id, v, tahunAjaranId)
                      if (res.ok) { toast.success('Berhasil di-link'); setDetailRow(null) }
                      else toast.error('Gagal: ' + res.error)
                    })
                  }}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Pilih siswa yang sesuai..." />
                    </SelectTrigger>
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
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Review Hasil Parsing PDF</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-4 text-sm shrink-0">
            <span className="text-green-600">✓ {autoMatched.length} auto-match</span>
            <span className="text-orange-600">⚠ {needsReview.length} perlu konfirmasi</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {needsReview.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-orange-700 sticky top-0 bg-white dark:bg-slate-900 py-1">
                  Konfirmasi nama berikut:
                </p>
                {matchRows.map((r, i) => !r.needs_review ? null : (
                  <div key={i} className="border border-orange-200 rounded-lg p-3 bg-orange-50 dark:bg-orange-950/20 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{r.raw_nama}</p>
                        {r.candidates[0] && (
                          <p className="text-xs text-muted-foreground">
                            Kandidat terbaik: {r.candidates[0].nama} ({r.candidates[0].score}%)
                          </p>
                        )}
                      </div>
                    </div>
                    <Select onValueChange={v => updateMatch(i, v === '__none__' ? null : v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Pilih siswa yang sesuai..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Tidak ada yang cocok —</SelectItem>
                        {r.candidates.map(c => (
                          <SelectItem key={c.siswa_id} value={c.siswa_id}>
                            {c.nama} ({c.score}%)
                          </SelectItem>
                        ))}
                        <SelectItem value="__sep__" disabled>── Semua siswa ──</SelectItem>
                        {allSiswa
                          .filter(s => !r.candidates.find(c => c.siswa_id === s.id))
                          .map(s => <SelectItem key={s.id} value={s.id}>{s.nama_lengkap}</SelectItem>)
                        }
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
            {needsReview.length === 0 && (
              <p className="text-sm text-green-600 text-center py-4">✓ Semua nama berhasil di-match otomatis!</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t shrink-0">
            <Button variant="outline" onClick={() => setShowReview(false)}>Batal</Button>
            <Button onClick={handleSaveAll} disabled={isPending}>
              {isPending ? 'Menyimpan...' : `Simpan ${matchRows.length} Data`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
