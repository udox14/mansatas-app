// Lokasi: app/dashboard/akademik/components/jadwal-tab.tsx
'use client'

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Calendar, Upload, Loader2, AlertCircle, CheckCircle2, RefreshCw,
  ChevronRight, BookOpen, User, Clock, Trash2, X, FileText, Info
} from 'lucide-react'
import {
  importJadwalASC, getJadwalByKelas, getJadwalByGuru,
  hapusSlotJadwal, resetJadwalKelas
} from '../actions'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────
type JamPelajaran = { id: number; nama: string; mulai: string; selesai: string }
type KelasItem = { id: string; tingkat: number; nomor_kelas: string; kelompok: string }
type GuruItem = { id: string; nama_lengkap: string }

type JadwalByKelasRow = {
  id: string; hari: number; jam_ke: number
  penugasan_id: string; guru_nama: string
  nama_mapel: string; mapel_id: string; guru_id: string
}
type JadwalByGuruRow = {
  id: string; hari: number; jam_ke: number
  penugasan_id: string; nama_mapel: string; mapel_id: string
  tingkat: number; nomor_kelas: string; kelas_kelompok: string; kelas_id: string
}

const HARI_LABELS = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const HARI_COLORS = [
  '', 'bg-blue-50 border-blue-100 text-blue-700',
  'bg-emerald-50 border-emerald-100 text-emerald-700',
  'bg-amber-50 border-amber-100 text-amber-700',
  'bg-violet-50 border-violet-100 text-violet-700',
  'bg-rose-50 border-rose-100 text-rose-700',
  'bg-slate-50 border-slate-100 text-slate-600',
]

// ── Sub: Cell Jadwal ───────────────────────────────────────────────────
function JadwalCell({
  row, mode, onHapus, isDeleting
}: {
  row: JadwalByKelasRow | JadwalByGuruRow
  mode: 'kelas' | 'guru'
  onHapus: (id: string) => void
  isDeleting: boolean
}) {
  const [hover, setHover] = useState(false)
  const byKelas = row as JadwalByKelasRow
  const byGuru = row as JadwalByGuruRow

  return (
    <div
      className="relative group bg-surface border border-surface rounded-md px-2 py-1.5 min-h-[44px] flex flex-col gap-0.5"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate">
        {mode === 'kelas' ? byKelas.nama_mapel : byGuru.nama_mapel}
      </p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
        {mode === 'kelas'
          ? byKelas.guru_nama.split(',')[0]  // nama pendek tanpa gelar
          : `${byGuru.tingkat}-${byGuru.nomor_kelas} ${byGuru.kelas_kelompok}`
        }
      </p>
      {hover && (
        <button
          onClick={() => onHapus(row.id)}
          disabled={isDeleting}
          className="absolute top-0.5 right-0.5 p-0.5 rounded text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 transition-colors"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
}

// ── Sub: Grid Jadwal ───────────────────────────────────────────────────
function JadwalGrid({
  jadwal, jamList, mode, onHapusSlot, deletingId
}: {
  jadwal: (JadwalByKelasRow | JadwalByGuruRow)[]
  jamList: JamPelajaran[]
  mode: 'kelas' | 'guru'
  onHapusSlot: (id: string) => void
  deletingId: string | null
}) {
  // Hitung hari yang ada data
  const hariAktif = Array.from(new Set(jadwal.map(j => j.hari))).sort()
  if (hariAktif.length === 0) return null

  // Index: hari-jamKe → rows
  const index = new Map<string, typeof jadwal>()
  for (const j of jadwal) {
    const key = `${j.hari}-${j.jam_ke}`
    if (!index.has(key)) index.set(key, [])
    index.get(key)!.push(j)
  }

  // Jam yang ada data
  const jamAktif = jamList.length > 0 ? jamList : Array.from(new Set(jadwal.map(j => j.jam_ke))).sort((a, b) => a - b).map(id => ({ id, nama: `Jam ${id}`, mulai: '', selesai: '' }))

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-xs border-collapse" style={{ minWidth: `${hariAktif.length * 130 + 90}px` }}>
        <thead>
          <tr>
            <th className="w-[80px] text-left px-2 py-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase bg-surface-2 border-b border-surface sticky left-0 z-10">
              Jam
            </th>
            {hariAktif.map(hari => (
              <th key={hari} className={cn(
                'px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide border-b border-surface rounded-t-md',
                HARI_COLORS[hari]
              )}>
                {HARI_LABELS[hari]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jamAktif.map(jam => {
            const hasAnyData = hariAktif.some(hari => index.has(`${hari}-${jam.id}`))
            if (!hasAnyData) return null
            return (
              <tr key={jam.id} className="border-b border-surface-2 last:border-0 hover:bg-surface-2/40 transition-colors">
                <td className="px-2 py-1.5 sticky left-0 bg-white dark:bg-slate-800 z-10 border-r border-surface">
                  <div className="font-semibold text-slate-700 dark:text-slate-200 text-[11px]">{jam.nama}</div>
                  {jam.mulai && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{jam.mulai}</div>
                  )}
                </td>
                {hariAktif.map(hari => {
                  const cells = index.get(`${hari}-${jam.id}`) || []
                  return (
                    <td key={hari} className="px-1.5 py-1.5 align-top">
                      <div className="space-y-1">
                        {cells.length === 0 ? (
                          <div className="h-[44px] rounded-md border border-dashed border-surface flex items-center justify-center">
                            <span className="text-[10px] text-slate-200 dark:text-slate-700">—</span>
                          </div>
                        ) : cells.map(cell => (
                          <JadwalCell
                            key={cell.id}
                            row={cell}
                            mode={mode}
                            onHapus={onHapusSlot}
                            isDeleting={deletingId === cell.id}
                          />
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Sub: Import XML Panel ──────────────────────────────────────────────
function ImportXMLPanel({ onDone }: { onDone: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: string | null; error: string | null; logs: string[]; stats: { penugasan: number; jadwal: number } } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) { alert('Pilih file XML terlebih dahulu.'); return }
    if (!file.name.endsWith('.xml')) { alert('File harus berformat .xml'); return }
    if (!confirm(`Import jadwal dari "${file.name}"?\n\nSEMUA penugasan & jadwal semester aktif akan DIHAPUS dan diganti dengan data dari file ini.`)) return

    setIsLoading(true)
    setResult(null)
    try {
      const text = await file.text()
      const res = await importJadwalASC(text)
      setResult(res)
      if (res.success) onDone()
    } catch (e: any) {
      setResult({ success: null, error: e.message, logs: [], stats: { penugasan: 0, jadwal: 0 } })
    }
    setIsLoading(false)
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setIsOpen(true)}
        className="h-8 text-xs gap-1.5 border-surface text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 rounded-lg">
        <Upload className="h-3.5 w-3.5" /> Import XML ASC
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="border-b border-surface-2 pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-blue-600" /> Import Jadwal dari ASC Timetables
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Warning */}
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed space-y-1">
                <p className="font-semibold">Perhatian!</p>
                <p>Import akan <strong>menghapus semua penugasan & jadwal</strong> semester aktif dan menggantinya dengan data dari file XML.</p>
                <p>Pastikan file XML berasal dari aSc Timetables dengan format export XML database.</p>
              </div>
            </div>

            {/* File picker */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">File XML</label>
              <div className="flex gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xml"
                  className="flex-1 h-9 text-xs file:mr-2 file:h-full file:border-0 file:bg-slate-100 file:px-3 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200 rounded-lg border border-surface bg-surface-2 cursor-pointer"
                />
              </div>
            </div>

            {/* Result */}
            {result && (
              <div className={cn(
                'p-3 rounded-lg text-xs border space-y-2',
                result.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              )}>
                <div className="flex items-center gap-2 font-semibold">
                  {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {result.success || result.error}
                </div>
                {result.success && (
                  <div className="flex gap-3 text-[11px]">
                    <span>✅ {result.stats.penugasan} penugasan</span>
                    <span>📅 {result.stats.jadwal} slot jadwal</span>
                  </div>
                )}
                {result.logs.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] font-medium opacity-70">{result.logs.length} item tidak diproses (klik untuk lihat)</summary>
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-0.5">
                      {result.logs.slice(0, 30).map((l, i) => (
                        <p key={i} className="text-[10px] opacity-80 font-mono">• {l}</p>
                      ))}
                      {result.logs.length > 30 && <p className="text-[10px] opacity-60">...dan {result.logs.length - 30} lainnya</p>}
                    </div>
                  </details>
                )}
              </div>
            )}

            <Button onClick={handleImport} disabled={isLoading}
              className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium">
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses XML...</> : 'Mulai Import'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── MAIN: JadwalTab ────────────────────────────────────────────────────
export function JadwalTab({
  taAktif,
  kelasList,
  guruList,
  jamPelajaran,
}: {
  taAktif: { id: string; nama: string; semester: number } | null
  kelasList: KelasItem[]
  guruList: GuruItem[]
  jamPelajaran: JamPelajaran[]
}) {
  const [viewMode, setViewMode] = useState<'kelas' | 'guru'>('kelas')
  const [selectedKelas, setSelectedKelas] = useState<string>('')
  const [selectedGuru, setSelectedGuru] = useState<string>('')

  const [jadwalKelas, setJadwalKelas] = useState<JadwalByKelasRow[]>([])
  const [jadwalGuru, setJadwalGuru] = useState<JadwalByGuruRow[]>([])

  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [hasImported, setHasImported] = useState(false)

  // Lazy load jadwal saat pilih kelas/guru
  const loadJadwal = useCallback(async (id: string, mode: 'kelas' | 'guru') => {
    if (!taAktif || !id) return
    setIsLoading(true)
    setLoaded(false)
    try {
      if (mode === 'kelas') {
        const data = await getJadwalByKelas(id, taAktif.id)
        setJadwalKelas(data as JadwalByKelasRow[])
      } else {
        const data = await getJadwalByGuru(id, taAktif.id)
        setJadwalGuru(data as JadwalByGuruRow[])
      }
      setLoaded(true)
    } catch { setLoaded(true) }
    setIsLoading(false)
  }, [taAktif])

  const handleSelectKelas = (id: string) => {
    setSelectedKelas(id)
    setLoaded(false)
    loadJadwal(id, 'kelas')
  }

  const handleSelectGuru = (id: string) => {
    setSelectedGuru(id)
    setLoaded(false)
    loadJadwal(id, 'guru')
  }

  const handleHapusSlot = async (id: string) => {
    if (!confirm('Hapus slot jadwal ini?')) return
    setDeletingId(id)
    const res = await hapusSlotJadwal(id)
    if (res.error) { alert(res.error); setDeletingId(null); return }
    // Refresh
    if (viewMode === 'kelas' && selectedKelas) await loadJadwal(selectedKelas, 'kelas')
    else if (viewMode === 'guru' && selectedGuru) await loadJadwal(selectedGuru, 'guru')
    setDeletingId(null)
  }

  const handleHapusJadwalKelas = async () => {
    if (!selectedKelas || !taAktif) return
    const nama = kelasList.find(k => k.id === selectedKelas)
    if (!confirm(`Reset semua jadwal kelas ${nama?.tingkat}-${nama?.nomor_kelas}?`)) return
    const res = await resetJadwalKelas(selectedKelas, taAktif.id)
    if (res.error) { alert(res.error); return }
    setJadwalKelas([])
  }

  const handleImportDone = () => {
    setHasImported(true)
    setLoaded(false)
    setJadwalKelas([])
    setJadwalGuru([])
    setSelectedKelas('')
    setSelectedGuru('')
  }

  // Kelompokkan kelas untuk dropdown
  const kelasByTingkat = kelasList.reduce((acc, k) => {
    const t = String(k.tingkat)
    if (!acc[t]) acc[t] = []
    acc[t].push(k)
    return acc
  }, {} as Record<string, KelasItem[]>)

  const activeJadwal = viewMode === 'kelas' ? jadwalKelas : jadwalGuru

  return (
    <div className="space-y-3">
      {/* ── TOOLBAR ── */}
      <div className="bg-surface border border-surface rounded-xl p-3 flex flex-wrap gap-2 items-center">

        {/* View toggle */}
        <div className="flex rounded-lg border border-surface overflow-hidden shrink-0">
          <button
            onClick={() => { setViewMode('kelas'); setLoaded(false); setJadwalGuru([]) }}
            className={cn(
              'px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors',
              viewMode === 'kelas' ? 'bg-slate-900 text-white' : 'bg-surface text-slate-500 dark:text-slate-400 hover:bg-surface-2'
            )}
          >
            <BookOpen className="h-3 w-3" /> Per Kelas
          </button>
          <button
            onClick={() => { setViewMode('guru'); setLoaded(false); setJadwalKelas([]) }}
            className={cn(
              'px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors',
              viewMode === 'guru' ? 'bg-slate-900 text-white' : 'bg-surface text-slate-500 dark:text-slate-400 hover:bg-surface-2'
            )}
          >
            <User className="h-3 w-3" /> Per Guru
          </button>
        </div>

        {/* Dropdown pilih kelas/guru */}
        {viewMode === 'kelas' ? (
          <Select value={selectedKelas} onValueChange={handleSelectKelas}>
            <SelectTrigger className="h-8 w-48 text-xs rounded-lg border-surface">
              <SelectValue placeholder="Pilih kelas..." />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {[10, 11, 12].map(t => {
                const items = kelasByTingkat[String(t)] || []
                if (items.length === 0) return null
                return (
                  <div key={t}>
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Kelas {t}</div>
                    {items.map(k => (
                      <SelectItem key={k.id} value={k.id} className="text-xs">
                        {k.tingkat}-{k.nomor_kelas} <span className="text-slate-400 dark:text-slate-500 ml-1">{k.kelompok}</span>
                      </SelectItem>
                    ))}
                  </div>
                )
              })}
            </SelectContent>
          </Select>
        ) : (
          <Select value={selectedGuru} onValueChange={handleSelectGuru}>
            <SelectTrigger className="h-8 w-56 text-xs rounded-lg border-surface">
              <SelectValue placeholder="Pilih guru..." />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {guruList.map(g => (
                <SelectItem key={g.id} value={g.id} className="text-xs">{g.nama_lengkap}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Aksi kontekstual */}
        {loaded && activeJadwal.length > 0 && viewMode === 'kelas' && selectedKelas && (
          <Button variant="ghost" size="sm" onClick={handleHapusJadwalKelas}
            className="h-8 text-xs gap-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg ml-auto">
            <Trash2 className="h-3.5 w-3.5" /> Reset Jadwal Kelas
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {loaded && (viewMode === 'kelas' ? selectedKelas : selectedGuru) && (
            <button
              onClick={() => loadJadwal(viewMode === 'kelas' ? selectedKelas : selectedGuru, viewMode)}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-surface-2 hover:text-slate-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          {taAktif && <ImportXMLPanel onDone={handleImportDone} />}
        </div>
      </div>

      {/* ── KONTEN ── */}
      <div className="bg-surface border border-surface rounded-xl overflow-hidden">

        {/* State: belum pilih */}
        {!isLoading && !loaded && !hasImported && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
            <div className="p-4 rounded-full bg-surface-2 border border-surface">
              <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Jadwal Mengajar</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {viewMode === 'kelas' ? 'Pilih kelas untuk melihat jadwal' : 'Pilih guru untuk melihat jadwal'}
              </p>
              {taAktif && (
                <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-1">
                  atau import dari file XML ASC Timetables
                </p>
              )}
            </div>
            {!taAktif && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Tahun Ajaran aktif belum diatur di Pengaturan
              </div>
            )}
          </div>
        )}

        {/* State: setelah import, belum pilih kelas/guru */}
        {!isLoading && !loaded && hasImported && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="p-3 rounded-full bg-emerald-50 border border-emerald-100">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Import berhasil!</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Pilih kelas atau guru di atas untuk melihat jadwalnya</p>
            </div>
          </div>
        )}

        {/* State: loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Memuat jadwal...</span>
          </div>
        )}

        {/* State: sudah load, tidak ada data */}
        {!isLoading && loaded && activeJadwal.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-slate-400 dark:text-slate-500">
            <div className="p-3 rounded-full bg-surface-2 border border-surface">
              <FileText className="h-6 w-6 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {viewMode === 'kelas' ? 'Belum ada jadwal untuk kelas ini' : 'Belum ada jadwal untuk guru ini'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Import dari XML ASC atau tambah jadwal manual</p>
            </div>
          </div>
        )}

        {/* State: ada data → tampilkan grid */}
        {!isLoading && loaded && activeJadwal.length > 0 && (
          <div className="p-3">
            {/* Info header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {activeJadwal.length} slot jadwal
                {jamPelajaran.length > 0 && (
                  <span className="ml-1.5">· {jamPelajaran.length} jam pelajaran terdaftar</span>
                )}
              </span>
              {jamPelajaran.length === 0 && (
                <span className="text-[11px] text-amber-500 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Jam pelajaran belum dikonfigurasi di Pengaturan
                </span>
              )}
            </div>

            <JadwalGrid
              jadwal={activeJadwal}
              jamList={jamPelajaran}
              mode={viewMode}
              onHapusSlot={handleHapusSlot}
              deletingId={deletingId}
            />
          </div>
        )}
      </div>
    </div>
  )
}
