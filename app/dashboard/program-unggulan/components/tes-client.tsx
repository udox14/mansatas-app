// Lokasi: app/dashboard/program-unggulan/components/tes-client.tsx
'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Star, ChevronLeft, Users, BookOpenCheck, Loader2, CheckCircle2,
  AlertCircle, Clock, RotateCcw, FileText, ChevronDown, ChevronUp, User
} from 'lucide-react'
import {
  getSiswaTesList, simpanNilaiTes, tandaiTidakHadir, resetStatusTes, getMateriTes
} from '../actions'
import { formatNamaKelas } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────
type KelasUnggulan = {
  pu_kelas_id: string
  kelas_id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
  jam_mengajar: number
  pu_guru_kelas_id: string
}
type SiswaTest = {
  hasil_id: string
  siswa_id: string
  nama_lengkap: string
  foto_url: string | null
  status: string
  nilai: string | null
}
type Materi = { id: string; judul: string; konten: string; urutan: number }
type Props = { kelasList: KelasUnggulan[]; currentUser: { id: string; nama_lengkap: string } }

const JAM_LABEL: Record<number, string> = { 1: '1 jam → 1 siswa', 2: '2 jam → 3 siswa', 3: '3 jam → 4 siswa', 4: '4 jam → 5 siswa' }
const NILAI_OPTIONS = ['Lancar', 'Kurang Lancar', 'Tidak Lancar'] as const
const ABSEN_OPTIONS = ['sakit', 'izin', 'alfa'] as const

const NILAI_COLORS: Record<string, string> = {
  'Lancar': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Kurang Lancar': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'Tidak Lancar': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}
const STATUS_COLORS: Record<string, string> = {
  'belum': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  'sudah': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'sakit': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'izin': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'alfa': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}
const STATUS_LABEL: Record<string, string> = {
  'belum': 'Belum Dites',
  'sudah': 'Sudah Dites',
  'sakit': 'Sakit',
  'izin': 'Izin',
  'alfa': 'Alfa',
}

// ── Main Component ───────────────────────────────────────────
export function TesClient({ kelasList, currentUser }: Props) {
  const [selectedKelas, setSelectedKelas] = useState<KelasUnggulan | null>(null)
  const [siswaList, setSiswaList] = useState<SiswaTest[]>([])
  const [materiList, setMateriList] = useState<Materi[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showMateri, setShowMateri] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadTes = useCallback(async (kelas: KelasUnggulan) => {
    setLoading(true)
    setError(null)
    setSiswaList([])
    setMateriList([])
    try {
      const [tesResult, materi] = await Promise.all([
        getSiswaTesList(kelas.pu_kelas_id, currentUser.id, kelas.jam_mengajar),
        getMateriTes(kelas.pu_kelas_id)
      ])
      if (tesResult.error) { setError(tesResult.error); return }
      setSiswaList(tesResult.data || [])
      setMateriList(materi)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [currentUser.id])

  const handleSelectKelas = (kelas: KelasUnggulan) => {
    setSelectedKelas(kelas)
    loadTes(kelas)
  }

  const handleNilai = async (hasilId: string, nilai: string) => {
    setSavingId(hasilId)
    const res = await simpanNilaiTes(hasilId, nilai)
    if (res.success) {
      setSiswaList(prev => prev.map(s => s.hasil_id === hasilId ? { ...s, nilai, status: 'sudah' } : s))
    }
    setSavingId(null)
  }

  const handleAbsen = async (hasilId: string, status: 'sakit' | 'izin' | 'alfa') => {
    setSavingId(hasilId)
    const res = await tandaiTidakHadir(hasilId, status)
    if (res.success) {
      setSiswaList(prev => prev.map(s => s.hasil_id === hasilId ? { ...s, status, nilai: null } : s))
    }
    setSavingId(null)
  }

  const handleReset = async (hasilId: string) => {
    setSavingId(hasilId)
    const res = await resetStatusTes(hasilId)
    if (res.success) {
      setSiswaList(prev => prev.map(s => s.hasil_id === hasilId ? { ...s, status: 'belum', nilai: null } : s))
    }
    setSavingId(null)
  }

  // ── Pilih Kelas View ──
  if (!selectedKelas) {
    return (
      <div className="space-y-3">
        {kelasList.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Belum ada kelas unggulan</p>
            <p className="text-sm mt-1">Anda belum di-assign ke kelas unggulan manapun.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 px-1">Pilih kelas untuk memulai pengetesan:</p>
            {kelasList.map(k => (
              <button
                key={k.pu_kelas_id}
                onClick={() => handleSelectKelas(k)}
                className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                    <Star className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    Kelas {formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {JAM_LABEL[k.jam_mengajar] || `${k.jam_mengajar} jam`}
                    </p>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
                </div>
              </button>
            ))}
          </>
        )}
      </div>
    )
  }

  // ── Detail Kelas + Tes View ──
  const completedCount = siswaList.filter(s => s.status === 'sudah').length
  const totalAssigned = siswaList.length

  return (
    <div className="space-y-4">
      {/* Header Kelas */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setSelectedKelas(null); setSiswaList([]); setMateriList([]); setShowMateri(false) }}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {formatNamaKelas(selectedKelas.tingkat, selectedKelas.nomor_kelas, selectedKelas.kelompok)}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {JAM_LABEL[selectedKelas.jam_mengajar]} • {completedCount}/{totalAssigned} selesai
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => loadTes(selectedKelas)}
          disabled={loading}
          className="flex-shrink-0"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Progress bar */}
      {totalAssigned > 0 && (
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / totalAssigned) * 100}%` }}
          />
        </div>
      )}

      {/* Tombol Lihat Materi */}
      {materiList.length > 0 && (
        <button
          onClick={() => setShowMateri(!showMateri)}
          className="w-full flex items-center gap-2 p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-sm font-medium transition active:scale-[0.98]"
        >
          <BookOpenCheck className="w-4 h-4" />
          <span className="flex-1 text-left">Lihat Materi Tes ({materiList.length})</span>
          {showMateri ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      )}

      {/* Panel Materi */}
      {showMateri && materiList.length > 0 && (
        <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
          {materiList.map((m, i) => (
            <div
              key={m.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden"
            >
              <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-200">
                  {i + 1}. {m.judul}
                </h3>
              </div>
              <div
                className="p-4 prose prose-sm dark:prose-invert max-w-none prose-headings:text-base prose-headings:font-semibold prose-img:rounded-lg prose-img:max-h-60 prose-table:text-xs prose-td:border prose-td:px-2 prose-td:py-1 prose-th:border prose-th:px-2 prose-th:py-1 prose-th:bg-gray-50 dark:prose-th:bg-gray-800"
                dangerouslySetInnerHTML={{ __html: m.konten }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-emerald-500" />
          <p className="text-sm text-gray-500 mt-2">Memuat daftar tes...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Daftar Siswa Cards */}
      {!loading && siswaList.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
            <Users className="w-3.5 h-3.5" />
            <span>Daftar Siswa Tes Hari Ini</span>
          </div>

          {siswaList.map(siswa => (
            <SiswaCard
              key={siswa.hasil_id}
              siswa={siswa}
              isSaving={savingId === siswa.hasil_id}
              onNilai={handleNilai}
              onAbsen={handleAbsen}
              onReset={handleReset}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && siswaList.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Semua siswa sudah dites hari ini</p>
        </div>
      )}
    </div>
  )
}

// ── Siswa Card ───────────────────────────────────────────────
function SiswaCard({
  siswa, isSaving, onNilai, onAbsen, onReset
}: {
  siswa: SiswaTest
  isSaving: boolean
  onNilai: (id: string, nilai: string) => void
  onAbsen: (id: string, status: 'sakit' | 'izin' | 'alfa') => void
  onReset: (id: string) => void
}) {
  const [showAbsen, setShowAbsen] = useState(false)
  const isDone = siswa.status === 'sudah'
  const isAbsen = ['sakit', 'izin', 'alfa'].includes(siswa.status)

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isDone
        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
        : isAbsen
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 opacity-75'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
    }`}>
      <div className="p-4">
        {/* Top: Foto + Nama + Status */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ring-white dark:ring-gray-800">
            {siswa.foto_url ? (
              <img src={siswa.foto_url} alt={siswa.nama_lengkap} className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{siswa.nama_lengkap}</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${STATUS_COLORS[siswa.status] || STATUS_COLORS['belum']}`}>
              {isDone && <CheckCircle2 className="w-3 h-3" />}
              {isAbsen && <Clock className="w-3 h-3" />}
              {STATUS_LABEL[siswa.status] || siswa.status}
            </span>
          </div>
          {isSaving && <Loader2 className="w-5 h-5 animate-spin text-gray-400 flex-shrink-0" />}
        </div>

        {/* Nilai badge jika sudah */}
        {isDone && siswa.nilai && (
          <div className={`mb-3 px-3 py-2 rounded-lg text-sm font-semibold text-center ${NILAI_COLORS[siswa.nilai] || ''}`}>
            {siswa.nilai}
          </div>
        )}

        {/* Actions berdasarkan status */}
        {siswa.status === 'belum' && (
          <div className="space-y-2">
            {/* Dropdown Nilai */}
            <Select onValueChange={(v) => onNilai(siswa.hasil_id, v)} disabled={isSaving}>
              <SelectTrigger className="w-full h-11 text-sm">
                <SelectValue placeholder="Pilih Nilai..." />
              </SelectTrigger>
              <SelectContent>
                {NILAI_OPTIONS.map(n => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Toggle absen */}
            <button
              onClick={() => setShowAbsen(!showAbsen)}
              className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 py-1 transition"
            >
              {showAbsen ? 'Tutup' : 'Siswa tidak hadir?'}
            </button>

            {showAbsen && (
              <div className="flex gap-2 animate-in slide-in-from-top-1 duration-150">
                {ABSEN_OPTIONS.map(opt => (
                  <Button
                    key={opt}
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs capitalize"
                    disabled={isSaving}
                    onClick={() => onAbsen(siswa.hasil_id, opt)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reset button jika sudah dinilai atau absen */}
        {(isDone || isAbsen) && (
          <button
            onClick={() => onReset(siswa.hasil_id)}
            disabled={isSaving}
            className="w-full text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 py-1 mt-1 transition flex items-center justify-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Ubah / Reset
          </button>
        )}
      </div>
    </div>
  )
}
