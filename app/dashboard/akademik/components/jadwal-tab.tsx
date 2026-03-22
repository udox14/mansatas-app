// Lokasi: app/dashboard/akademik/components/jadwal-tab.tsx
'use client'

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Calendar, Upload, Loader2, AlertCircle, CheckCircle2, RefreshCw,
  BookOpen, User, Clock, Trash2, X, FileText, Info
} from 'lucide-react'
import {
  importJadwalASC, getJadwalByKelas, getJadwalByGuru,
  hapusSlotJadwal, resetJadwalKelas
} from '../actions'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────
type SlotJam = { id: number; nama: string; mulai: string; selesai: string }
type PolaJam = { id: string; nama: string; hari: number[]; slots: SlotJam[] }
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
const HARI_SHORT  = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const HARI_COLORS = [
  '',
  'bg-blue-50 dark:bg-blue-950/40 border-blue-100 text-blue-700 dark:text-blue-400',
  'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 text-emerald-700 dark:text-emerald-400',
  'bg-teal-50 dark:bg-teal-950/40 border-teal-100 text-teal-700 dark:text-teal-400',
  'bg-violet-50 dark:bg-violet-950/40 border-violet-100 text-violet-700 dark:text-violet-400',
  'bg-rose-50 dark:bg-rose-950/40 border-rose-100 text-rose-700 dark:text-rose-400',
  'bg-amber-50 dark:bg-amber-950/40 border-amber-100 text-amber-700 dark:text-amber-400',
]

// Helper: cari slots untuk hari tertentu dari daftar pola
function getSlotsForHari(polaDaftar: PolaJam[], hari: number): SlotJam[] {
  const pola = polaDaftar.find(p => p.hari.includes(hari))
  return pola?.slots ?? []
}

// ── Cell Jadwal ────────────────────────────────────────────────────────
function JadwalCell({
  row, mode, onHapus, isDeleting,
}: {
  row: JadwalByKelasRow | JadwalByGuruRow
  mode: 'kelas' | 'guru'
  onHapus: (id: string) => void
  isDeleting: boolean
}) {
  const [hover, setHover] = useState(false)
  const byKelas = row as JadwalByKelasRow
  const byGuru  = row as JadwalByGuruRow

  return (
    <div
      className="relative bg-surface border border-surface rounded-md px-2 py-1.5 min-h-[44px] flex flex-col gap-0.5"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate pr-3">
        {mode === 'kelas' ? byKelas.nama_mapel : byGuru.nama_mapel}
      </p>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
        {mode === 'kelas'
          ? byKelas.guru_nama.split(',')[0]
          : `${byGuru.tingkat}-${byGuru.nomor_kelas} ${byGuru.kelas_kelompok}`}
      </p>
      {hover && (
        <button
          onClick={() => onHapus(row.id)}
          disabled={isDeleting}
          className="absolute top-0.5 right-0.5 p-0.5 rounded text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 transition-colors"
        >
          {isDeleting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-2.5 w-2.5" />}
        </button>
      )}
    </div>
  )
}

// ── Grid Jadwal (pola-aware) ───────────────────────────────────────────
function JadwalGrid({
  jadwal, polaDaftar, mode, onHapusSlot, deletingId,
}: {
  jadwal: (JadwalByKelasRow | JadwalByGuruRow)[]
  polaDaftar: PolaJam[]
  mode: 'kelas' | 'guru'
  onHapusSlot: (id: string) => void
  deletingId: string | null
}) {
  const hariAktif = Array.from(new Set(jadwal.map(j => j.hari))).sort()
  if (hariAktif.length === 0) return null

  // index: "hari-jamKe" → rows
  const index = new Map<string, (JadwalByKelasRow | JadwalByGuruRow)[]>()
  for (const j of jadwal) {
    const key = `${j.hari}-${j.jam_ke}`
    if (!index.has(key)) index.set(key, [])
    index.get(key)!.push(j)
  }

  // Kumpulkan semua nomor jam yang ada data, lalu untuk tiap hari
  // ambil label & waktu dari pola yang sesuai
  const allJamKe = Array.from(new Set(jadwal.map(j => j.jam_ke))).sort((a, b) => a - b)

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table
        className="w-full text-xs border-collapse"
        style={{ minWidth: `${hariAktif.length * 140 + 100}px` }}
      >
        <thead>
          <tr>
            {/* Kolom jam */}
            <th className="w-[96px] text-left px-2 py-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase bg-surface-2 border-b border-r border-surface sticky left-0 z-10">
              Jam
            </th>
            {hariAktif.map(hari => (
              <th key={hari} className={cn(
                'px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide border-b border-surface',
                HARI_COLORS[hari]
              )}>
                <span className="hidden sm:inline">{HARI_LABELS[hari]}</span>
                <span className="sm:hidden">{HARI_SHORT[hari]}</span>
                {/* Sub-label pola */}
                {polaDaftar.length > 0 && (() => {
                  const pola = polaDaftar.find(p => p.hari.includes(hari))
                  return pola ? (
                    <div className="text-[9px] font-normal opacity-70 mt-0.5 hidden sm:block">{pola.nama}</div>
                  ) : null
                })()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allJamKe.map(jamKe => {
            const hasAny = hariAktif.some(hari => index.has(`${hari}-${jamKe}`))
            if (!hasAny) return null

            return (
              <tr key={jamKe} className="border-b border-surface-2 last:border-0 hover:bg-surface-2/40 transition-colors">
                {/* Kolom jam — tampilkan info dari pola hari pertama yang punya data */}
                <td className="px-2 py-1.5 sticky left-0 bg-white dark:bg-slate-800 z-10 border-r border-surface align-top">
                  {(() => {
                    // Cari info jam dari hari pertama yang ada slot di pola
                    for (const hari of hariAktif) {
                      const slots = getSlotsForHari(polaDaftar, hari)
                      const slot  = slots.find(s => s.id === jamKe)
                      if (slot) return (
                        <>
                          <div className="font-semibold text-slate-700 dark:text-slate-200 text-[11px]">{slot.nama}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono leading-tight">
                            {slot.mulai}–{slot.selesai}
                          </div>
                        </>
                      )
                    }
                    // Fallback kalau pola belum dikonfigurasi
                    return <div className="font-semibold text-slate-500 dark:text-slate-400 text-[11px]">Jam {jamKe}</div>
                  })()}
                </td>

                {hariAktif.map(hari => {
                  const cells = index.get(`${hari}-${jamKe}`) ?? []
                  // Cek apakah jam ini ada di pola hari ini
                  const slots = getSlotsForHari(polaDaftar, hari)
                  const slotAda = polaDaftar.length === 0 || slots.some(s => s.id === jamKe)

                  return (
                    <td key={hari} className="px-1.5 py-1.5 align-top min-w-[130px]">
                      {!slotAda ? (
                        // Jam ini tidak ada di pola hari ini
                        <div className="h-[44px] rounded-md bg-surface-3/60 border border-dashed border-surface flex items-center justify-center">
                          <span className="text-[9px] text-slate-300 dark:text-slate-700">tidak ada</span>
                        </div>
                      ) : cells.length === 0 ? (
                        <div className="h-[44px] rounded-md border border-dashed border-surface flex items-center justify-center">
                          <span className="text-[10px] text-slate-200 dark:text-slate-700">—</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {cells.map(cell => (
                            <JadwalCell
                              key={cell.id}
                              row={cell}
                              mode={mode}
                              onHapus={onHapusSlot}
                              isDeleting={deletingId === cell.id}
                            />
                          ))}
                        </div>
                      )}
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

// ── Import XML Panel ───────────────────────────────────────────────────
function ImportXMLPanel({ onDone }: { onDone: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{
    success: string | null; error: string | null
    logs: string[]; stats: { penugasan: number; jadwal: number }
  } | null>(null)
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
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed space-y-1">
                <p className="font-semibold">Perhatian!</p>
                <p>Import akan <strong>menghapus semua penugasan & jadwal</strong> semester aktif dan menggantinya dengan data dari file XML.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">File XML (aSc Timetables format)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".xml"
                className="w-full h-9 text-xs file:mr-2 file:h-full file:border-0 file:bg-slate-100 file:px-3 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200 rounded-lg border border-surface bg-surface-2 cursor-pointer"
              />
            </div>

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
                    <summary className="cursor-pointer text-[11px] font-medium opacity-70">
                      {result.logs.length} item tidak diproses
                    </summary>
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-0.5">
                      {result.logs.slice(0, 30).map((l, i) => (
                        <p key={i} className="text-[10px] opacity-80 font-mono">• {l}</p>
                      ))}
                      {result.logs.length > 30 && (
                        <p className="text-[10px] opacity-60">...dan {result.logs.length - 30} lainnya</p>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}

            <Button onClick={handleImport} disabled={isLoading}
              className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium">
              {isLoading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses XML...</>
                : 'Mulai Import'}
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
  polaDaftar,
}: {
  taAktif: { id: string; nama: string; semester: number } | null
  kelasList: KelasItem[]
  guruList: GuruItem[]
  polaDaftar: PolaJam[]   // ← ganti dari jamPelajaran flat ke PolaJam[]
}) {
  const [viewMode, setViewMode]       = useState<'kelas' | 'guru'>('kelas')
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedGuru,  setSelectedGuru]  = useState('')

  const [jadwalKelas, setJadwalKelas] = useState<JadwalByKelasRow[]>([])
  const [jadwalGuru,  setJadwalGuru]  = useState<JadwalByGuruRow[]>([])

  const [isLoading,   setIsLoading]   = useState(false)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [loaded,      setLoaded]      = useState(false)
  const [hasImported, setHasImported] = useState(false)

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

  const handleSelectKelas = (id: string) => { setSelectedKelas(id); setLoaded(false); loadJadwal(id, 'kelas') }
  const handleSelectGuru  = (id: string) => { setSelectedGuru(id);  setLoaded(false); loadJadwal(id, 'guru') }

  const handleHapusSlot = async (id: string) => {
    if (!confirm('Hapus slot jadwal ini?')) return
    setDeletingId(id)
    const res = await hapusSlotJadwal(id)
    if (res.error) { alert(res.error); setDeletingId(null); return }
    if (viewMode === 'kelas' && selectedKelas) await loadJadwal(selectedKelas, 'kelas')
    else if (viewMode === 'guru' && selectedGuru)  await loadJadwal(selectedGuru,  'guru')
    setDeletingId(null)
  }

  const handleHapusJadwalKelas = async () => {
    if (!selectedKelas || !taAktif) return
    const kelas = kelasList.find(k => k.id === selectedKelas)
    if (!confirm(`Reset semua jadwal kelas ${kelas?.tingkat}-${kelas?.nomor_kelas}?`)) return
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

  // Kelompokkan kelas per tingkat
  const kelasByTingkat = kelasList.reduce((acc, k) => {
    const t = String(k.tingkat)
    if (!acc[t]) acc[t] = []
    acc[t].push(k)
    return acc
  }, {} as Record<string, KelasItem[]>)

  const activeJadwal = viewMode === 'kelas' ? jadwalKelas : jadwalGuru

  // Info pola aktif
  const polaHariInfo = polaDaftar.length > 0
    ? `${polaDaftar.length} pola · ${polaDaftar.map(p => p.nama).join(', ')}`
    : null

  return (
    <div className="space-y-3">

      {/* TOOLBAR */}
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

        {/* Dropdown */}
        {viewMode === 'kelas' ? (
          <Select value={selectedKelas} onValueChange={handleSelectKelas}>
            <SelectTrigger className="h-8 w-48 text-xs rounded-lg border-surface">
              <SelectValue placeholder="Pilih kelas..." />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {[10, 11, 12].map(t => {
                const items = kelasByTingkat[String(t)] || []
                if (!items.length) return null
                return (
                  <div key={t}>
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Kelas {t}</div>
                    {items.map(k => (
                      <SelectItem key={k.id} value={k.id} className="text-xs">
                        {k.tingkat}-{k.nomor_kelas}
                        <span className="text-slate-400 dark:text-slate-500 ml-1">{k.kelompok}</span>
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

        {/* Reset jadwal kelas */}
        {loaded && activeJadwal.length > 0 && viewMode === 'kelas' && selectedKelas && (
          <Button variant="ghost" size="sm" onClick={handleHapusJadwalKelas}
            className="h-8 text-xs gap-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg">
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

      {/* KONTEN */}
      <div className="bg-surface border border-surface rounded-xl overflow-hidden">

        {/* Empty: belum pilih */}
        {!isLoading && !loaded && !hasImported && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
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
            {taAktif && !polaHariInfo && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                <Info className="h-3.5 w-3.5 shrink-0" />
                Jam pelajaran belum dikonfigurasi — waktu jam tidak akan tampil di grid
              </div>
            )}
          </div>
        )}

        {/* Empty: setelah import */}
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

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Memuat jadwal...</span>
          </div>
        )}

        {/* Empty: sudah load, tidak ada data */}
        {!isLoading && loaded && activeJadwal.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
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

        {/* Ada data → grid */}
        {!isLoading && loaded && activeJadwal.length > 0 && (
          <div className="p-3">
            {/* Info bar */}
            <div className="flex flex-wrap items-center gap-3 mb-3 px-1">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                <span className="text-xs text-slate-400 dark:text-slate-500">{activeJadwal.length} slot jadwal</span>
              </div>
              {polaHariInfo ? (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">{polaHariInfo}</span>
              ) : (
                <span className="text-[11px] text-amber-500 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Jam pelajaran belum dikonfigurasi di Pengaturan
                </span>
              )}
            </div>

            <JadwalGrid
              jadwal={activeJadwal}
              polaDaftar={polaDaftar}
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
