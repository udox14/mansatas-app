// Lokasi: app/dashboard/keterangan-absensi/components/keterangan-client.tsx
'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2, Thermometer, ShieldAlert, X, Save, Loader2,
  Users, ChevronDown, MessageSquare, XCircle,
} from 'lucide-react'
import {
  loadSiswaKeterangan, simpanKeteranganBatch,
  type SiswaKeterangan, type KelasWaliKelas,
} from '../actions'

interface Props {
  kelasList: KelasWaliKelas[]
  initialKelasId: string | null
}

const STATUS_UI = {
  HADIR: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', icon: CheckCircle2, label: 'Hadir' },
  SAKIT: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', icon: Thermometer, label: 'Sakit' },
  IZIN:  { bg: 'bg-blue-50',  border: 'border-blue-300',  text: 'text-blue-700',  icon: ShieldAlert,  label: 'Izin'  },
  ALFA:  { bg: 'bg-red-50',   border: 'border-red-300',   text: 'text-red-700',   icon: XCircle,      label: 'Alfa'  },
}

function statusLabel(status: string | null | undefined) {
  if (status === 'HADIR') return 'Hadir'
  if (status === 'SAKIT') return 'Sakit'
  if (status === 'IZIN') return 'Izin'
  if (status === 'ALFA') return 'Alfa'
  if (status === 'PARSIAL') return 'Bolos'
  if (status === 'PERLU_KONFIRMASI_WALI') return 'Perlu Keputusan Wali'
  if (status === 'BELUM_ADA_INPUT') return 'Belum Ada Input'
  return 'Belum Lengkap'
}

function sourceLabel(source: string | null | undefined) {
  if (source === 'perizinan') return 'Perizinan'
  if (source === 'wali_kelas') return 'Wali Kelas'
  if (source === 'koreksi_wali_kelas') return 'Koreksi Wali'
  if (source === 'guru') return 'Guru'
  if (source === 'perlu_konfirmasi_wali') return 'Perlu Keputusan Wali'
  if (source === 'belum_ada_input') return 'Belum Ada Input'
  return 'Belum Lengkap'
}

function statusBadgeClass(status: string | null | undefined) {
  if (status === 'HADIR') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'SAKIT') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (status === 'IZIN') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (status === 'ALFA') return 'bg-red-50 text-red-700 border-red-200'
  if (status === 'PARSIAL') return 'bg-violet-50 text-violet-700 border-violet-200'
  if (status === 'PERLU_KONFIRMASI_WALI') return 'bg-purple-50 text-purple-700 border-purple-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function statusPriority(status: string | null | undefined) {
  if (status === 'PERLU_KONFIRMASI_WALI') return 0
  if (status === 'PARSIAL') return 1
  if (status === 'BELUM_ADA_INPUT') return 2
  if (status === 'BELUM_ADA_DATA') return 3
  if (status === 'ALFA') return 4
  return 5
}

function needsWaliDecision(status: string | null | undefined) {
  return ['PERLU_KONFIRMASI_WALI', 'PARSIAL', 'BELUM_ADA_INPUT', 'BELUM_ADA_DATA', 'ALFA'].includes(status || '')
}

export function KeteranganClient({ kelasList, initialKelasId }: Props) {
  const today = new Date().toISOString().split('T')[0]

  const [selectedKelasId, setSelectedKelasId] = useState<string>(initialKelasId || kelasList[0]?.kelas_id || '')
  const [tanggal, setTanggal] = useState(today)
  const [siswaList, setSiswaList] = useState<SiswaKeterangan[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)
  const [calendarInfo, setCalendarInfo] = useState('')
  const [expandedNote, setExpandedNote] = useState<string | null>(null)

  const selectedKelas = kelasList.find(k => k.kelas_id === selectedKelasId)

  const loadData = useCallback(async (kelasId: string, tgl: string) => {
    setIsLoading(true)
    setPesan(null)
    setHasChanges(false)
    const res = await loadSiswaKeterangan(kelasId, tgl)
    if (res.error) setPesan({ tipe: 'error', teks: res.error })
    else {
      setSiswaList(res.siswa)
      setCalendarInfo(res.calendarStatus && !res.calendarStatus.isEffective ? `Tanggal ini tidak efektif pembelajaran: ${res.calendarStatus.reason || 'keterangan tidak wajib diisi.'}` : '')
    }
    setIsLoading(false)
    setHasLoaded(true)
  }, [])

  const handleKelasChange = (kelasId: string) => {
    setSelectedKelasId(kelasId)
    setHasLoaded(false)
    setSiswaList([])
    setCalendarInfo('')
  }

  const handleTanggalChange = (tgl: string) => {
    setTanggal(tgl)
    setHasLoaded(false)
    setSiswaList([])
    setCalendarInfo('')
  }

  const setStatus = (siswaId: string, status: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA' | null) => {
    setSiswaList(prev => prev.map(s => s.siswa_id === siswaId ? { ...s, status } : s))
    setHasChanges(true)
  }

  const setKeterangan = (siswaId: string, keterangan: string) => {
    setSiswaList(prev => prev.map(s => s.siswa_id === siswaId ? { ...s, keterangan } : s))
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!selectedKelasId) return
    setIsSaving(true)
    setPesan(null)
    const res = await simpanKeteranganBatch(
      selectedKelasId, tanggal,
      siswaList.map(s => ({ siswa_id: s.siswa_id, status: s.status, keterangan: s.keterangan }))
    )
    if (res.error) setPesan({ tipe: 'error', teks: res.error })
    else {
      setPesan({ tipe: 'sukses', teks: res.success || 'Tersimpan!' })
      setHasChanges(false)
      await loadData(selectedKelasId, tanggal)
    }
    setIsSaving(false)
  }

  const jumlahDitandai = siswaList.filter(s => s.status !== null).length
  const sortedSiswaList = [...siswaList].sort((a, b) => (
    statusPriority(a.status_akhir) - statusPriority(b.status_akhir) ||
    a.nama_lengkap.localeCompare(b.nama_lengkap)
  ))

  return (
    <div className="space-y-4 pb-40 md:pb-24">
      {/* Filter: Kelas & Tanggal */}
      <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Pilih Kelas */}
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Kelas Binaan</label>
            <div className="relative">
              <select
                value={selectedKelasId}
                onChange={e => handleKelasChange(e.target.value)}
                className="w-full appearance-none rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-400 pr-8"
              >
                {kelasList.map(k => (
                  <option key={k.kelas_id} value={k.kelas_id}>{k.kelas_label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Pilih Tanggal */}
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={e => handleTanggalChange(e.target.value)}
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        <Button
          onClick={() => loadData(selectedKelasId, tanggal)}
          disabled={!selectedKelasId || isLoading}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
          size="sm"
        >
          {isLoading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Memuat...</> : <><Users className="h-3.5 w-3.5 mr-1.5" />Tampilkan Siswa</>}
        </Button>
      </div>

      {/* Pesan */}
      {pesan && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${pesan.tipe === 'sukses' ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {pesan.teks}
        </div>
      )}

      {calendarInfo && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {calendarInfo}
        </div>
      )}

      {/* Belum dimuat */}
      {!hasLoaded && !isLoading && (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-10 text-center">
          <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Pilih kelas dan tanggal, lalu klik <strong>Tampilkan Siswa</strong>.</p>
        </div>
      )}

      {/* Daftar Siswa */}
      {hasLoaded && !isLoading && (
        <>
          {/* Summary */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedKelas?.kelas_label} &middot; {siswaList.length} siswa &middot;{' '}
              {tanggal === today ? 'Hari ini' : new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {jumlahDitandai > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                {jumlahDitandai} ditandai
              </span>
            )}
          </div>

          <div className="space-y-2">
            {sortedSiswaList.map((s, idx) => {
              const noteOpen = expandedNote === s.siswa_id
              const ui = s.status ? STATUS_UI[s.status] : null

              return (
                <div
                  key={s.siswa_id}
                  className={`rounded-lg border overflow-hidden transition-colors ${ui ? `${ui.bg} ${ui.border}` : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
                >
                  <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <span className="mt-0.5 w-5 shrink-0 text-center text-[10px] text-slate-400">{idx + 1}</span>

                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium leading-tight text-slate-800 break-words dark:text-slate-100">{s.nama_lengkap}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">{s.nisn}</span>
                          <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(s.status || s.status_akhir)}`}>
                            {statusLabel(s.status || s.status_akhir)}
                          </span>
                          <span className="text-[10px] text-slate-400">{sourceLabel(s.sumber_status)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Tombol status */}
                    <div className="ml-7 flex flex-wrap items-center gap-1 sm:ml-0 sm:shrink-0">
                      <button
                        onClick={() => setStatus(s.siswa_id, s.status === 'HADIR' ? null : 'HADIR')}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors ${s.status === 'HADIR' ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-emerald-300 hover:text-emerald-600'}`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Hadir
                      </button>
                      <button
                        onClick={() => setStatus(s.siswa_id, s.status === 'SAKIT' ? null : 'SAKIT')}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors ${s.status === 'SAKIT' ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-amber-300 hover:text-amber-600'}`}
                      >
                        <Thermometer className="h-3 w-3" />
                        Sakit
                      </button>
                      <button
                        onClick={() => setStatus(s.siswa_id, s.status === 'IZIN' ? null : 'IZIN')}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors ${s.status === 'IZIN' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-blue-300 hover:text-blue-600'}`}
                      >
                        <ShieldAlert className="h-3 w-3" />
                        Izin
                      </button>
                      <button
                        onClick={() => setStatus(s.siswa_id, s.status === 'ALFA' ? null : 'ALFA')}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors ${s.status === 'ALFA' ? 'bg-red-100 border-red-300 text-red-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-red-300 hover:text-red-600'}`}
                      >
                        <XCircle className="h-3 w-3" />
                        Alfa
                      </button>
                      {s.status && (
                        <button
                          onClick={() => { setStatus(s.siswa_id, null); if (noteOpen) setExpandedNote(null) }}
                          className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Tombol catatan */}
                    {s.status && (
                      <button
                        onClick={() => setExpandedNote(noteOpen ? null : s.siswa_id)}
                        className={`p-1.5 rounded-md shrink-0 ${s.keterangan ? 'text-amber-500' : 'text-slate-300'} hover:bg-white/60`}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Input keterangan */}
                  {s.status && noteOpen && (
                    <div className="px-3 py-2 border-t border-white/60">
                      <input
                        type="text"
                        value={s.keterangan}
                        onChange={e => setKeterangan(s.siswa_id, e.target.value)}
                        placeholder="Keterangan (misal: laporan orang tua via telpon)..."
                        className="w-full text-xs bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
                        autoFocus
                      />
                    </div>
                  )}

                  {/* Preview keterangan yang sudah tersimpan */}
                  {s.keterangan && !noteOpen && (
                    <div className="px-10 pb-2">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">"{s.keterangan}"</p>
                    </div>
                  )}

                  <div className="px-3 pb-2">
                    {s.detail_guru.length === 0 ? (
                      <p className="text-[11px] text-slate-400">
                        {needsWaliDecision(s.status_akhir)
                          ? 'Belum ada detail input guru yang bisa dijadikan rujukan untuk siswa ini.'
                          : 'Tidak ada catatan ketidakhadiran dari guru untuk siswa ini.'}
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {s.detail_guru.map((detail, detailIndex) => (
                          <div key={`${s.siswa_id}-${detail.nama_mapel}-${detailIndex}`} className="rounded-md border border-slate-100 bg-white/70 px-2 py-1.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                            <span className="font-semibold">{detail.nama_mapel}</span>
                            <span className="text-slate-400"> Jam {detail.jam_ke_mulai === detail.jam_ke_selesai ? detail.jam_ke_mulai : `${detail.jam_ke_mulai}-${detail.jam_ke_selesai}`}</span>
                            <span className={`ml-1.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(detail.status)}`}>{statusLabel(detail.status)}</span>
                            {detail.catatan ? <span className="ml-1 text-slate-500">Catatan: {detail.catatan}</span> : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {siswaList.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
              <p className="text-sm text-slate-400">Tidak ada siswa aktif di kelas ini.</p>
            </div>
          )}
        </>
      )}

      {/* Floating Save */}
      {hasLoaded && siswaList.length > 0 && (
        <div className="fixed left-0 right-0 bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-0 z-20 p-3 bg-gradient-to-t from-white via-white dark:from-slate-900 dark:via-slate-900 to-transparent pointer-events-none">
          <div className="max-w-lg mx-auto pointer-events-auto">
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 h-11 text-sm font-semibold"
            >
              {isSaving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />
                  {jumlahDitandai > 0
                    ? `Simpan Keterangan (${jumlahDitandai} siswa)`
                    : 'Simpan (hapus semua keterangan)'}
                  {hasChanges ? ' *' : ''}</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
