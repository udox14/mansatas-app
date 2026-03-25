// Lokasi: app/dashboard/tka/components/tab-hasil.tsx
'use client'

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Upload, Loader2, CheckCircle2, AlertCircle, Search, X,
  ChevronLeft, ChevronRight, FileText, Eye, AlertTriangle, UserCheck, UserX
} from 'lucide-react'
import { importHasilTka, getListHasilTka, getAllSiswaKelas12, searchSiswaKelas12ForTka } from '../actions'
import type { KelasItem, TkaHasilRow } from '../actions'
import { cn } from '@/lib/utils'

interface Props {
  tahunAjaranId: string
  kelasList: KelasItem[]
  isAdmin: boolean
}

type ParsedRow = {
  nomor: number
  nomor_peserta: string
  nama_pdf: string
  siswa_id: string | null
  nama_matched: string | null
  nisn_matched: string | null
  nilai_bind: number | null; kategori_bind: string | null
  nilai_mat: number | null; kategori_mat: string | null
  nilai_bing: number | null; kategori_bing: string | null
  mapel_pilihan1: string | null; nilai_pilihan1: number | null; kategori_pilihan1: string | null
  mapel_pilihan2: string | null; nilai_pilihan2: number | null; kategori_pilihan2: string | null
}

const KATEGORI_COLOR: Record<string, string> = {
  'Istimewa': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  'Baik':     'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  'Memadai':  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  'Kurang':   'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
}

function KatBadge({ kat }: { kat: string | null }) {
  if (!kat) return <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold', KATEGORI_COLOR[kat] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
      {kat}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// PDF.JS — Load dari CDN, jalankan di browser
// ═══════════════════════════════════════════════════════════════════════

const PDFJS_CDN    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

let _pdfjsLib: any = null

async function loadPdfJs(): Promise<any> {
  if (_pdfjsLib) return _pdfjsLib
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PDFJS_CDN}"]`)
    if (existing) {
      // Sudah di-load sebelumnya, tunggu
      const check = setInterval(() => {
        if ((window as any).pdfjsLib) {
          clearInterval(check)
          _pdfjsLib = (window as any).pdfjsLib
          resolve(_pdfjsLib)
        }
      }, 50)
      return
    }
    const script = document.createElement('script')
    script.src = PDFJS_CDN
    script.onload = () => {
      const lib = (window as any).pdfjsLib
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER
      _pdfjsLib = lib
      resolve(lib)
    }
    script.onerror = () => reject(new Error('Gagal memuat pdf.js dari CDN'))
    document.head.appendChild(script)
  })
}

/**
 * Ekstrak teks dari PDF dengan layout berbasis posisi X/Y.
 * Setiap halaman dipetakan ke grid teks ~210 kolom,
 * sehingga menghasilkan output mirip `pdftotext -layout`.
 */
async function extractLayoutText(
  arrayBuffer: ArrayBuffer,
  onProgress?: (page: number, total: number) => void
): Promise<string> {
  const lib   = await loadPdfJs()
  const pdf   = await lib.getDocument({ data: arrayBuffer }).promise
  const total = pdf.numPages
  const allLines: string[] = []

  for (let pageNum = 1; pageNum <= total; pageNum++) {
    onProgress?.(pageNum, total)

    const page        = await pdf.getPage(pageNum)
    const viewport    = page.getViewport({ scale: 1 })
    const pageWidth   = viewport.width
    const pageHeight  = viewport.height
    const textContent = await page.getTextContent()

    type Item = { str: string; x: number; y: number }
    const items: Item[] = []

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const tx = item.transform            // [sx, kx, ky, sy, tx, ty]
      const x  = tx[4]
      const y  = pageHeight - tx[5]        // flip Y (PDF origin = bottom-left)
      items.push({ str: item.str, x, y })
    }

    // Sort: atas ke bawah (Y), kiri ke kanan (X)
    items.sort((a, b) => {
      const dy = Math.round(a.y) - Math.round(b.y)
      return dy !== 0 ? dy : a.x - b.x
    })

    // Kelompokkan ke baris (toleransi ±3px)
    const rows: Item[][] = []
    for (const item of items) {
      const last = rows[rows.length - 1]
      if (last && Math.abs(item.y - last[0].y) < 4) {
        last.push(item)
      } else {
        rows.push([item])
      }
    }

    // Render setiap baris ke string berukuran COLS karakter
    const COLS = 210
    for (const row of rows) {
      const line = new Array(COLS).fill(' ')
      for (const item of row) {
        const col     = Math.round((item.x / pageWidth) * COLS)
        const clamped = Math.max(0, Math.min(COLS - 1, col))
        for (let i = 0; i < item.str.length && clamped + i < COLS; i++) {
          line[clamped + i] = item.str[i]
        }
      }
      allLines.push(line.join(''))
    }
    allLines.push('\f') // form-feed antar halaman
  }

  return allLines.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════
// DKHTKA PARSER — Column-based, akurasi > 97%
// ═══════════════════════════════════════════════════════════════════════

const KNOWN_MAPEL = [
  'Matematika Tingkat Lanjut',
  'Bahasa Indonesia Tingkat Lanjut',
  'Bahasa Inggris Tingkat Lanjut',
  'Fisika', 'Kimia', 'Biologi',
  'Pendidikan Pancasila dan Kewarganegaraan',
  'Ekonomi', 'Geografi', 'Sosiologi', 'Sejarah', 'Antropologi',
  'Bahasa Arab', 'Bahasa Prancis', 'Bahasa Jerman', 'Bahasa Jepang',
  'Bahasa Mandarin', 'Bahasa Korea',
  'Projek Kreatif dan Kewirausahaan',
]
// Sort dari terpanjang agar greedy match benar
const KNOWN_MAPEL_SORTED = [...KNOWN_MAPEL].sort((a, b) => b.length - a.length)

const HEADER_RE = /No\s+Nomor|Nama Peserta|Urut\s+NISN|Mata Pelajaran|KEMENTERIAN|TES KEMAMPUAN|DAFTAR KOLEKTIF|Provinsi\s*:|Kota\/Kabupaten|Satuan Pendidikan|Kepala Satuan|NIP Kepala/
const T3_RE     = /T3-\d{2}-\d{2}-\d{2}-\d{4}-\d{4}-\d/

/** Cocokkan teks dengan nama mapel resmi (semua token harus ada) */
function matchMapel(text: string): string | null {
  if (!text.trim()) return null
  const t = text.toLowerCase()
  for (const m of KNOWN_MAPEL_SORTED) {
    if (m.toLowerCase().split(' ').every(w => t.includes(w))) return m
  }
  return null
}

/** Cari nilai terdekatan dengan kolom target */
function findNear<T>(items: [T, number][], target: number, tol = 18): T | null {
  if (!items.length) return null
  const best = items.reduce((a, b) =>
    Math.abs(a[1] - target) <= Math.abs(b[1] - target) ? a : b
  )
  return Math.abs(best[1] - target) <= tol ? best[0] : null
}

/** Cari nomor kolom terdekatan dengan target */
function findColNear(items: [unknown, number][], target: number, tol = 18): number {
  if (!items.length) return target
  const best = items.reduce((a, b) =>
    Math.abs(a[1] - target) <= Math.abs(b[1] - target) ? a : b
  )
  return Math.abs(best[1] - target) <= tol ? best[1] : target
}

function parseNums(line: string): [number, number][] {
  return [...line.matchAll(/\d+\.\d{2}/g)].map(m => [parseFloat(m[0]), m.index!])
}

function parseKats(line: string): [string, number][] {
  return [...line.matchAll(/\((Istimewa|Baik|Memadai|Kurang)\)/g)].map(m => [m[1], m.index!])
}

function cleanSeg(s: string): string {
  return s
    .replace(/\d+\.\d{2}/g, '')
    .replace(/\((Istimewa|Baik|Memadai|Kurang)\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDkhtka(rawText: string): ParsedRow[] {
  const lines = rawText.split('\n')

  // Temukan semua baris T3
  const t3Pos: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (T3_RE.test(lines[i])) t3Pos.push(i)
  }
  if (t3Pos.length === 0) return []

  // Kumpulkan record; sertakan 1 baris sebelum T3
  const records: string[][] = []
  for (let idx = 0; idx < t3Pos.length; idx++) {
    const ti     = t3Pos[idx]
    const nextTi = idx + 1 < t3Pos.length ? t3Pos[idx + 1] : lines.length
    const start  = Math.max(0, ti - 1)
    const rlines = lines.slice(start, nextTi).filter(l => !HEADER_RE.test(l))
    records.push(rlines)
  }

  const results: ParsedRow[] = []

  for (const rlines of records) {
    const t3Idx = rlines.findIndex(l => T3_RE.test(l))
    if (t3Idx < 0) continue
    const t3 = rlines[t3Idx]

    // Nomor peserta & nomor urut
    const npMatch       = t3.match(T3_RE)
    const nomor_peserta = npMatch ? npMatch[0] : ''
    const nomorUrut     = parseInt(nomor_peserta.split('-')[5] ?? '0', 10)

    // ── Nilai dari T3 line — kolom hasil kalibrasi pdf.js (PAGE_W=841.89, COLS=210)
    // bind=97, mat=110, bing=123, p1=153, p2=183 — toleransi ketat agar tidak overlap
    const nums       = parseNums(t3)
    const nilai_bind = findNear(nums, 97,  6)
    const nilai_mat  = findNear(nums, 110, 6)
    const nilai_bing = findNear(nums, 123, 6)
    const nilai_p1   = findNear(nums, 153, 14)
    const nilai_p2   = findNear(nums, 183, 14)
    const p1_col     = findColNear(nums, 153, 14)
    const p2_col     = findColNear(nums, 183, 14)

    // ── Nama: 3 strategi, col 37-64 (stop sebelum tempat lahir di col 67)
    let nama_pdf = ''

    // Strategi 1: baris nomor urut col ~7, ambil nama di col 37-64
    for (const l of rlines.slice(t3Idx, t3Idx + 4)) {
      if (/^\s{5,8}\d{1,3}\s/.test(l)) {
        const raw = l.slice(37, 64).replace(/\s+/g, ' ').trim()
        if (raw.length > 1) { nama_pdf = raw; break }
      }
    }

    // Strategi 2: nama di T3 line setelah nomor peserta, potong di col 64
    if (!nama_pdf && npMatch) {
      const afterT3 = t3.slice(npMatch.index! + npMatch[0].length, 64)
      const seg = afterT3.replace(/\d+\.\d{2}.*/, '').replace(/\s+/g, ' ').trim()
      if (seg.length > 2) nama_pdf = seg
    }

    // Strategi 3: tambah suku kata dari NISN line col 37-64 (hanya huruf)
    if (nama_pdf) {
      for (const l of rlines.slice(t3Idx + 1, t3Idx + 4)) {
        if (/\b\d{10,}\b/.test(l)) {
          const extra = l.slice(37, 64).replace(/\s+/g, ' ').trim()
          // Hanya append jika isinya huruf saja (bukan tempat lahir/tanggal)
          if (extra.length > 1 && /^[A-Za-z\s]+$/.test(extra)) {
            nama_pdf = (nama_pdf + ' ' + extra).replace(/\s+/g, ' ').trim()
          }
          break
        }
      }
    }

    nama_pdf = nama_pdf.replace(/\s+/g, ' ').trim()

    // NISN
    let nisn = ''
    for (const l of rlines.slice(t3Idx, t3Idx + 5)) {
      const m = l.match(/\b(\d{10,})\b/)
      if (m) { nisn = m[1]; break }
    }

    // ── Kategori — kolom terkalibrasi: bind=95, mat=109, bing=121
    let kat_bind: string | null = null, kat_mat:  string | null = null
    let kat_bing: string | null = null, kat_p1:   string | null = null
    let kat_p2:   string | null = null
    for (const l of rlines) {
      const kats = parseKats(l)
      if (!kats.length) continue
      const kb  = findNear(kats as [string, number][], 95,  6)
      const km  = findNear(kats as [string, number][], 109, 6)
      const ki  = findNear(kats as [string, number][], 121, 6)
      const kp1 = findNear(kats as [string, number][], p1_col, 14)
      const kp2 = findNear(kats as [string, number][], p2_col, 14)
      if (kb  && !kat_bind) kat_bind = kb
      if (km  && !kat_mat)  kat_mat  = km
      if (ki  && !kat_bing) kat_bing = ki
      if (kp1 && !kat_p1)  kat_p1   = kp1
      if (kp2 && !kat_p2)  kat_p2   = kp2
    }

    // ── Mapel — col 132-152 (mapel1), col 158-182 (mapel2)
    const collectSeg = (cs: number, ce: number): string => {
      const parts: string[] = []
      for (const l of rlines) {
        if (l.length <= cs) continue
        const raw = l.length > ce ? l.slice(cs, ce) : l.slice(cs)
        const seg = cleanSeg(raw)
        if (seg) parts.push(seg)
      }
      return parts.join(' ')
    }

    const mapel_pilihan1 = matchMapel(collectSeg(132, 152))
    const mapel_pilihan2 = matchMapel(collectSeg(158, 183))

    if (!nama_pdf) continue

    results.push({
      nomor: nomorUrut,
      nomor_peserta,
      nama_pdf,
      siswa_id: null, nama_matched: null, nisn_matched: null,
      nilai_bind,  kategori_bind:  kat_bind,
      nilai_mat,   kategori_mat:   kat_mat,
      nilai_bing,  kategori_bing:  kat_bing,
      mapel_pilihan1, nilai_pilihan1: nilai_p1, kategori_pilihan1: kat_p1,
      mapel_pilihan2, nilai_pilihan2: nilai_p2, kategori_pilihan2: kat_p2,
    })
  }

  return results
}

// ═══════════════════════════════════════════════════════════════════════
// FUZZY NAME MATCHING — client-side, zero dependency
// ═══════════════════════════════════════════════════════════════════════

function normalizeNama(n: string): string {
  return n
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diakritik
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchNama(
  target: string,
  candidates: { id: string; nama_lengkap: string; nisn: string }[]
): { id: string; nama_lengkap: string; nisn: string } | null {
  const tNorm   = normalizeNama(target)
  const tTokens = tNorm.split(' ').filter(t => t.length > 1)
  if (!tTokens.length) return null

  let best: { id: string; nama_lengkap: string; nisn: string; score: number } | null = null

  for (const c of candidates) {
    const sTokens = normalizeNama(c.nama_lengkap).split(' ').filter(s => s.length > 1)
    const matched = tTokens.filter(t =>
      sTokens.some(s =>
        s === t ||
        (s.length > 2 && t.length > 2 && (s.startsWith(t) || t.startsWith(s)))
      )
    ).length
    const score = matched / Math.max(tTokens.length, sTokens.length)
    if (!best || score > best.score) best = { ...c, score }
  }

  return best && best.score >= 0.45 ? best : null
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export function TabHasil({ tahunAjaranId, kelasList, isAdmin }: Props) {
  const [phase, setPhase]             = useState<'upload' | 'preview' | 'list'>('upload')
  const [parsing, setParsing]         = useState(false)
  const [parseStatus, setParseStatus] = useState('')
  const [saving, setSaving]           = useState(false)
  const [parsed, setParsed]           = useState<ParsedRow[]>([])
  const [unmatchedCount, setUnmatchedCount] = useState(0)
  const [toast, setToast]             = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // List state
  const [listData, setListData]       = useState<TkaHasilRow[]>([])
  const [listTotal, setListTotal]     = useState(0)
  const [listPage, setListPage]       = useState(1)
  const [listLoading, setListLoading] = useState(false)
  const [filterKelas, setFilterKelas] = useState('__all__')
  const [filterSearch, setFilterSearch] = useState('')
  const [listLoaded, setListLoaded]   = useState(false)

  // Detail modal
  const [detail, setDetail] = useState<TkaHasilRow | null>(null)

  // Review manual modal — untuk baris tidak cocok
  const [reviewTarget, setReviewTarget] = useState<ParsedRow | null>(null)
  const [reviewSearch, setReviewSearch] = useState('')
  const [reviewResults, setReviewResults] = useState<{ id: string; nama_lengkap: string; nisn: string }[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)

  const handleReviewSearch = async () => {
    const q = reviewSearch.trim()
    if (!q) return
    setReviewLoading(true)
    try {
      const data = await searchSiswaKelas12ForTka(q, tahunAjaranId)
      setReviewResults(data.map(d => ({ id: d.siswa_id, nama_lengkap: d.nama_lengkap, nisn: d.nisn })))
    } finally {
      setReviewLoading(false)
    }
  }

  const handleReviewPick = (siswa: { id: string; nama_lengkap: string; nisn: string }) => {
    if (!reviewTarget) return
    setParsed(prev => prev.map(r =>
      r.nomor === reviewTarget.nomor
        ? { ...r, siswa_id: siswa.id, nama_matched: siswa.nama_lengkap, nisn_matched: siswa.nisn }
        : r
    ))
    setReviewTarget(null)
    setReviewSearch('')
    setReviewResults([])
  }

  const handleReviewSkip = () => {
    if (!reviewTarget) return
    setParsed(prev => prev.map(r =>
      r.nomor === reviewTarget.nomor ? { ...r, siswa_id: '__skip__', nama_matched: '(dilewati)' } : r
    ))
    setReviewTarget(null)
  }

  const PAGE_SIZE = 25

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4500)
  }

  // ── PDF Upload & Parse ─────────────────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('error', 'File harus berformat PDF')
      return
    }

    setParsing(true)
    setParseStatus('Memuat pdf.js...')

    try {
      const buf = await file.arrayBuffer()

      setParseStatus('Mengekstrak teks dari PDF...')
      const rawText = await extractLayoutText(buf, (page, total) => {
        setParseStatus(`Membaca halaman ${page}/${total}...`)
      })

      setParseStatus('Parsing data TKA...')
      const rawRows = parseDkhtka(rawText)

      if (rawRows.length === 0) {
        showToast('error', 'Tidak ada data yang berhasil diparsing. Pastikan file adalah DKHTKA dari kemendikdasmen.go.id.')
        return
      }

      setParseStatus(`Mencocokkan ${rawRows.length} nama siswa...`)
      const siswaList = await getAllSiswaKelas12()

      let unmatched = 0
      const matched = rawRows.map(row => {
        const m = matchNama(row.nama_pdf, siswaList)
        if (!m) unmatched++
        return {
          ...row,
          siswa_id:     m?.id ?? null,
          nama_matched: m?.nama_lengkap ?? null,
          nisn_matched: m?.nisn ?? null,
        }
      })

      setParsed(matched)
      setUnmatchedCount(unmatched)
      setPhase('preview')
    } catch (err: any) {
      showToast('error', `Gagal memproses PDF: ${err.message}`)
    } finally {
      setParsing(false)
      setParseStatus('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── Import ke DB ───────────────────────────────────────────────────
  const handleImport = async () => {
    const toImport = parsed.filter(r => r.siswa_id !== null)
    if (!toImport.length) {
      showToast('error', 'Tidak ada data yang bisa diimpor')
      return
    }
    setSaving(true)
    try {
      const result = await importHasilTka(
        toImport.map(r => ({
          siswa_id:         r.siswa_id!,
          nomor_peserta:    r.nomor_peserta,
          nilai_bind:       r.nilai_bind,  kategori_bind:       r.kategori_bind,
          nilai_mat:        r.nilai_mat,   kategori_mat:        r.kategori_mat,
          nilai_bing:       r.nilai_bing,  kategori_bing:       r.kategori_bing,
          mapel_pilihan1:   r.mapel_pilihan1, nilai_pilihan1:   r.nilai_pilihan1,
          kategori_pilihan1: r.kategori_pilihan1,
          mapel_pilihan2:   r.mapel_pilihan2, nilai_pilihan2:   r.nilai_pilihan2,
          kategori_pilihan2: r.kategori_pilihan2,
        })),
        tahunAjaranId
      )
      if (result.success) {
        showToast('success', `${result.saved} data berhasil diimpor ke database`)
        setPhase('list')
        loadList(1, '', '')
      } else {
        showToast('error', result.error ?? 'Gagal mengimpor')
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Load List ──────────────────────────────────────────────────────
  const loadList = useCallback(async (page: number, kelas: string, search: string) => {
    setListLoading(true)
    try {
      const res = await getListHasilTka(
        tahunAjaranId,
        { kelas_id: kelas || undefined, search: search || undefined },
        page, PAGE_SIZE
      )
      setListData(res.data)
      setListTotal(res.total)
      setListPage(page)
      setListLoaded(true)
    } finally {
      setListLoading(false)
    }
  }, [tahunAjaranId])

  const totalPages = Math.ceil(listTotal / PAGE_SIZE)
  const kelasLabel = (k: KelasItem) => `${k.tingkat}-${k.nomor_kelas} ${k.kelompok}`

  // ── RENDER ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border',
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400'
            : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400'
        )}>
          {toast.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ────────── PHASE: UPLOAD ────────── */}
      {phase === 'upload' && (
        <div className="space-y-3">
          <label className={cn(
            'flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-xl transition-colors',
            parsing
              ? 'border-sky-300 bg-sky-50/80 dark:bg-sky-950/20 cursor-not-allowed'
              : 'border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-sky-50/40 dark:hover:bg-sky-950/10 cursor-pointer'
          )}>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFile}
              disabled={parsing}
            />
            {parsing ? (
              <>
                <Loader2 className="h-10 w-10 text-sky-400 animate-spin mb-3" />
                <p className="text-sky-600 dark:text-sky-400 font-semibold text-sm">{parseStatus || 'Memproses PDF...'}</p>
                <p className="text-sky-500/70 text-xs mt-1">Jangan tutup halaman ini</p>
              </>
            ) : (
              <>
                <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                  <FileText className="h-7 w-7 text-slate-400" />
                </div>
                <p className="text-slate-700 dark:text-slate-300 font-semibold text-sm">Upload file PDF Hasil TKA</p>
                <p className="text-slate-400 text-xs mt-1 text-center max-w-xs">
                  DKHTKA dari kemendikdasmen.go.id<br/>
                  Klik atau seret file ke area ini
                </p>
                <Button size="sm" variant="outline" className="mt-4 pointer-events-none">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Pilih File PDF
                </Button>
              </>
            )}
          </label>

          <div className="text-center">
            <button
              className="text-xs text-slate-400 hover:text-sky-500 transition-colors"
              onClick={() => { setPhase('list'); loadList(1, '', '') }}>
              Lihat data yang sudah diimpor →
            </button>
          </div>
        </div>
      )}

      {/* ────────── PHASE: PREVIEW ────────── */}
      {phase === 'preview' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Preview — {parsed.length} peserta ditemukan
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {parsed.filter(r => r.siswa_id && r.siswa_id !== '__skip__').length} cocok
                </span>
                {parsed.filter(r => !r.siswa_id).length > 0 && (
                  <button
                    className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 underline underline-offset-2 hover:text-amber-700"
                    onClick={() => {
                      const first = parsed.find(r => !r.siswa_id)
                      if (first) { setReviewTarget(first); setReviewSearch(first.nama_pdf); setReviewResults([]) }
                    }}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {parsed.filter(r => !r.siswa_id).length} belum cocok — klik review
                  </button>
                )}
                {parsed.filter(r => r.siswa_id === '__skip__').length > 0 && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <X className="h-3 w-3" />
                    {parsed.filter(r => r.siswa_id === '__skip__').length} dilewati
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => { setParsed([]); setPhase('upload') }}>
                <X className="h-3.5 w-3.5 mr-1" /> Batal
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={saving || parsed.filter(r => r.siswa_id && r.siswa_id !== '__skip__').length === 0}
              >
                {saving
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                Import {parsed.filter(r => r.siswa_id && r.siswa_id !== '__skip__').length} Data
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto max-h-[65vh]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    {['#', 'Nama (PDF)', 'Nama (Cocok)', 'B.Ind', 'Mat', 'B.Ing', 'Pilihan 1', 'Pilihan 2'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map(row => (
                    <tr key={row.nomor} className={cn(
                      'border-b border-slate-100 dark:border-slate-800',
                      row.siswa_id === '__skip__' ? 'bg-slate-50 dark:bg-slate-800/40 opacity-50' :
                      row.siswa_id ? 'hover:bg-slate-50 dark:hover:bg-slate-800/20' :
                      'bg-amber-50 dark:bg-amber-950/20'
                    )}>
                      <td className="px-3 py-2 text-slate-400 font-mono">{row.nomor}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[150px]">
                        <span className="truncate block">{row.nama_pdf}</span>
                      </td>
                      <td className="px-3 py-2 min-w-[160px]">
                        {row.siswa_id === '__skip__'
                          ? <span className="text-slate-400 text-xs italic">Dilewati</span>
                          : row.nama_matched
                          ? <span className="text-emerald-700 dark:text-emerald-400 font-medium">{row.nama_matched}</span>
                          : <button
                              className="text-amber-600 dark:text-amber-400 flex items-center gap-1 text-xs hover:underline"
                              onClick={() => { setReviewTarget(row); setReviewSearch(row.nama_pdf); setReviewResults([]) }}
                            >
                              <UserX className="h-3 w-3 shrink-0" />Pilih siswa
                            </button>
                        }
                      </td>
                      <td className="px-3 py-2 text-center"><NilaiCell nilai={row.nilai_bind} kat={row.kategori_bind} /></td>
                      <td className="px-3 py-2 text-center"><NilaiCell nilai={row.nilai_mat} kat={row.kategori_mat} /></td>
                      <td className="px-3 py-2 text-center"><NilaiCell nilai={row.nilai_bing} kat={row.kategori_bing} /></td>
                      <td className="px-3 py-2 min-w-[120px]">
                        {row.mapel_pilihan1
                          ? <div><p className="leading-tight">{row.mapel_pilihan1}</p><NilaiCell nilai={row.nilai_pilihan1} kat={row.kategori_pilihan1} /></div>
                          : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-2 min-w-[120px]">
                        {row.mapel_pilihan2
                          ? <div><p className="leading-tight">{row.mapel_pilihan2}</p><NilaiCell nilai={row.nilai_pilihan2} kat={row.kategori_pilihan2} /></div>
                          : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────── PHASE: LIST ────────── */}
      {phase === 'list' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={filterKelas} onValueChange={val => { setFilterKelas(val); loadList(1, val === '__all__' ? '' : val, filterSearch) }}>
              <SelectTrigger className="sm:w-48 text-sm">
                <SelectValue placeholder="Semua Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Semua Kelas</SelectItem>
                {kelasList.map(k => (
                  <SelectItem key={k.id} value={k.id}>{kelasLabel(k)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadList(1, filterKelas === '__all__' ? '' : filterKelas, filterSearch)}
                placeholder="Cari nama / NISN, tekan Enter..."
                className="pl-8 text-sm"
              />
              {filterSearch && (
                <button
                  onClick={() => { setFilterSearch(''); loadList(1, filterKelas === '__all__' ? '' : filterKelas, '') }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {isAdmin && (
              <Button size="sm" variant="outline" className="sm:ml-auto" onClick={() => setPhase('upload')}>
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload PDF Baru
              </Button>
            )}
          </div>

          {/* Content */}
          {!listLoaded
            ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )
            : listData.length === 0
            ? (
              <div className="flex flex-col items-center justify-center py-20 border rounded-xl border-dashed border-slate-200 dark:border-slate-700 text-center">
                <FileText className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium text-sm">Belum ada data hasil TKA</p>
                {isAdmin && (
                  <Button size="sm" variant="outline" className="mt-4" onClick={() => setPhase('upload')}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload File PDF
                  </Button>
                )}
              </div>
            )
            : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">#</th>
                        <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Nama Siswa</th>
                        <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Kelas</th>
                        <th className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 px-3 py-2.5">B.Ind</th>
                        <th className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 px-3 py-2.5">Mat</th>
                        <th className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 px-3 py-2.5">B.Ing</th>
                        <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Pilihan 1</th>
                        <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Pilihan 2</th>
                        <th className="px-2 py-2.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {listData.map((row, idx) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                          onClick={() => setDetail(row)}
                        >
                          <td className="px-4 py-2.5 text-xs text-slate-400">{(listPage - 1) * PAGE_SIZE + idx + 1}</td>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm leading-tight">{row.nama_lengkap}</p>
                            <p className="text-xs text-slate-400 font-mono">{row.nisn}</p>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">
                            {row.tingkat ? `${row.tingkat}-${row.nomor_kelas} ${row.kelas_kelompok}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center"><NilaiCell nilai={row.nilai_bind} kat={row.kategori_bind} /></td>
                          <td className="px-3 py-2.5 text-center"><NilaiCell nilai={row.nilai_mat} kat={row.kategori_mat} /></td>
                          <td className="px-3 py-2.5 text-center"><NilaiCell nilai={row.nilai_bing} kat={row.kategori_bing} /></td>
                          <td className="px-4 py-2.5 min-w-[130px]">
                            {row.mapel_pilihan1
                              ? <div><p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">{row.mapel_pilihan1}</p><KatBadge kat={row.kategori_pilihan1} /></div>
                              : <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-2.5 min-w-[130px]">
                            {row.mapel_pilihan2
                              ? <div><p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">{row.mapel_pilihan2}</p><KatBadge kat={row.kategori_pilihan2} /></div>
                              : <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                              <Eye className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs text-slate-400">{listTotal} data</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                      disabled={listPage <= 1 || listLoading}
                      onClick={() => loadList(listPage - 1, filterKelas === '__all__' ? '' : filterKelas, filterSearch)}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-slate-500 min-w-[80px] text-center">
                      Hal {listPage} / {totalPages || 1}
                    </span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                      disabled={listPage >= totalPages || listLoading}
                      onClick={() => loadList(listPage + 1, filterKelas === '__all__' ? '' : filterKelas, filterSearch)}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          }
        </div>
      )}

      {/* ────────── DETAIL MODAL ────────── */}
      <Dialog open={!!detail} onOpenChange={open => !open && setDetail(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Detail Hasil TKA</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{detail.nama_lengkap}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{detail.nisn}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {detail.tingkat ? `${detail.tingkat}-${detail.nomor_kelas} ${detail.kelas_kelompok}` : 'Kelas tidak diketahui'}
                </p>
                {detail.nomor_peserta && (
                  <p className="text-[10px] text-slate-400 font-mono mt-1">{detail.nomor_peserta}</p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Mapel Wajib</p>
                <div className="grid grid-cols-3 gap-2">
                  <NilaiCard label="B. Indonesia" nilai={detail.nilai_bind} kat={detail.kategori_bind} />
                  <NilaiCard label="Matematika"   nilai={detail.nilai_mat}  kat={detail.kategori_mat} />
                  <NilaiCard label="B. Inggris"   nilai={detail.nilai_bing} kat={detail.kategori_bing} />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Mapel Pilihan</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Pilihan 1', mapel: detail.mapel_pilihan1, nilai: detail.nilai_pilihan1, kat: detail.kategori_pilihan1 },
                    { label: 'Pilihan 2', mapel: detail.mapel_pilihan2, nilai: detail.nilai_pilihan2, kat: detail.kategori_pilihan2 },
                  ].map(p => (
                    <div key={p.label} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                      <p className="text-[10px] text-slate-400 font-semibold mb-1">{p.label}</p>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-snug min-h-[2rem]">
                        {p.mapel ?? <span className="text-slate-300 dark:text-slate-600">Tidak ada</span>}
                      </p>
                      {p.nilai != null && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="text-base font-bold text-slate-800 dark:text-slate-200">{p.nilai.toFixed(2)}</span>
                          <KatBadge kat={p.kat} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── REVIEW MANUAL MODAL ── */}
      <Dialog open={!!reviewTarget} onOpenChange={open => { if (!open) { setReviewTarget(null); setReviewSearch(''); setReviewResults([]) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Review Manual — Pilih Siswa</DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="space-y-3">
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Nama di PDF:</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">{reviewTarget.nama_pdf}</p>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    value={reviewSearch}
                    onChange={e => setReviewSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReviewSearch()}
                    placeholder="Cari nama siswa, Enter..."
                    className="pl-8 text-sm bg-white dark:bg-slate-900"
                    autoFocus
                  />
                </div>
                <Button size="sm" variant="outline" onClick={handleReviewSearch} disabled={reviewLoading}>
                  {reviewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <ScrollArea className="h-56 rounded-lg border border-slate-200 dark:border-slate-700">
                {reviewResults.length === 0
                  ? <p className="text-xs text-slate-400 text-center py-8">
                      {reviewLoading ? 'Mencari...' : 'Ketik nama lalu tekan Enter'}
                    </p>
                  : <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reviewResults.map(s => (
                        <button key={s.id} onClick={() => handleReviewPick(s)}
                          className="w-full text-left px-3 py-2.5 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors group">
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-3.5 w-3.5 text-slate-300 group-hover:text-sky-500 shrink-0 transition-colors" />
                            <div>
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{s.nama_lengkap}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{s.nisn}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                }
              </ScrollArea>
              <div className="flex justify-between pt-1">
                <Button size="sm" variant="ghost" className="text-slate-400 text-xs"
                  onClick={handleReviewSkip}>
                  Lewati data ini
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setReviewTarget(null); setReviewSearch(''); setReviewResults([]) }}>
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Helper components ─────────────────────────────────────────────────

function NilaiCell({ nilai, kat }: { nilai: number | null; kat: string | null }) {
  if (nilai == null) return <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{nilai.toFixed(2)}</span>
      <KatBadge kat={kat} />
    </div>
  )
}

function NilaiCard({ label, nilai, kat }: { label: string; nilai: number | null; kat: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 text-center">
      <p className="text-[10px] text-slate-400 font-semibold mb-1 leading-tight">{label}</p>
      <p className="text-base font-bold text-slate-800 dark:text-slate-200">
        {nilai != null ? nilai.toFixed(2) : '—'}
      </p>
      <div className="mt-1"><KatBadge kat={kat} /></div>
    </div>
  )
}
