// Lokasi: app/dashboard/izin/components/izin-wali-kelas-client.tsx
'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  ShieldAlert, X, Save, Loader2, Users,
  ChevronDown, MessageSquare,
} from 'lucide-react'
import {
  loadSiswaUntukIzin, simpanIzinWaliKelasBatch,
  type SiswaIzinWaliKelas, type KelasIzin, type AlasanIzin, type AlasanIzinRow,
} from '../actions'

interface Props {
  kelasList: KelasIzin[]
  alasanList: AlasanIzinRow[]
}

export function IzinWaliKelasClient({ kelasList, alasanList }: Props) {
  const today = new Date().toISOString().split('T')[0]

  const [selectedKelasId, setSelectedKelasId] = useState(kelasList[0]?.kelas_id || '')
  const [tanggal, setTanggal] = useState(today)
  const [siswaList, setSiswaList] = useState<SiswaIzinWaliKelas[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)
  const [expandedNote, setExpandedNote] = useState<string | null>(null)

  const loadData = useCallback(async (kelasId: string, tgl: string) => {
    setIsLoading(true)
    setPesan(null)
    setHasChanges(false)
    const res = await loadSiswaUntukIzin(kelasId, tgl)
    if (res.error) setPesan({ tipe: 'error', teks: res.error })
    else setSiswaList(res.siswa)
    setIsLoading(false)
    setHasLoaded(true)
  }, [])

  const handleKelasChange = (kelasId: string) => {
    setSelectedKelasId(kelasId)
    setHasLoaded(false)
    setSiswaList([])
  }

  const handleTanggalChange = (tgl: string) => {
    setTanggal(tgl)
    setHasLoaded(false)
    setSiswaList([])
  }

  const defaultAlasan = alasanList[0]?.alasan ?? ''

  const setAlasan = (siswaId: string, alasan: AlasanIzin | null) => {
    setSiswaList(prev => prev.map(s =>
      s.siswa_id === siswaId ? { ...s, alasan, keterangan: alasan === null ? '' : s.keterangan } : s
    ))
    setHasChanges(true)
    if (alasan === null) setExpandedNote(n => n === siswaId ? null : n)
  }

  const setKeterangan = (siswaId: string, keterangan: string) => {
    setSiswaList(prev => prev.map(s => s.siswa_id === siswaId ? { ...s, keterangan } : s))
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!selectedKelasId) return
    setIsSaving(true)
    setPesan(null)
    const res = await simpanIzinWaliKelasBatch(
      selectedKelasId, tanggal,
      siswaList.map(s => ({ siswa_id: s.siswa_id, alasan: s.alasan, keterangan: s.keterangan }))
    )
    if (res.error) setPesan({ tipe: 'error', teks: res.error })
    else {
      setPesan({ tipe: 'sukses', teks: res.success || 'Tersimpan!' })
      setHasChanges(false)
      await loadData(selectedKelasId, tanggal)
    }
    setIsSaving(false)
  }

  const jumlahIzin = siswaList.filter(s => s.alasan !== null).length
  const selectedKelas = kelasList.find(k => k.kelas_id === selectedKelasId)

  return (
    <div className="space-y-4 pb-24">
      {/* Filter: Kelas & Tanggal */}
      <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Kelas Binaan</label>
            <div className="relative">
              <select
                value={selectedKelasId}
                onChange={e => handleKelasChange(e.target.value)}
                className="w-full appearance-none rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-400 pr-8"
              >
                {kelasList.map(k => (
                  <option key={k.kelas_id} value={k.kelas_id}>{k.kelas_label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={e => handleTanggalChange(e.target.value)}
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <Button
          onClick={() => loadData(selectedKelasId, tanggal)}
          disabled={!selectedKelasId || isLoading}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
          size="sm"
        >
          {isLoading
            ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Memuat...</>
            : <><Users className="h-3.5 w-3.5 mr-1.5" />Tampilkan Siswa</>}
        </Button>
      </div>

      {/* Pesan */}
      {pesan && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${pesan.tipe === 'sukses' ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {pesan.teks}
        </div>
      )}

      {/* Placeholder sebelum load */}
      {!hasLoaded && !isLoading && (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-10 text-center">
          <ShieldAlert className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Pilih kelas dan tanggal, lalu klik <strong>Tampilkan Siswa</strong>.</p>
        </div>
      )}

      {/* Daftar Siswa */}
      {hasLoaded && !isLoading && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedKelas?.kelas_label} &middot; {siswaList.length} siswa &middot;{' '}
              {tanggal === today ? 'Hari ini' : new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {jumlahIzin > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                {jumlahIzin} izin
              </span>
            )}
          </div>

          <div className="space-y-2">
            {siswaList.map((s, idx) => {
              const noteOpen = expandedNote === s.siswa_id
              const hasIzin = s.alasan !== null

              return (
                <div
                  key={s.siswa_id}
                  className={`rounded-lg border overflow-hidden transition-colors ${hasIzin ? 'bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
                >
                  <div className="flex items-start gap-2 px-3 py-2.5">
                    <span className="text-[10px] text-slate-400 w-5 text-center shrink-0 mt-0.5">{idx + 1}</span>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate leading-tight">{s.nama_lengkap}</p>
                      <p className="text-[10px] text-slate-400">{s.nisn}</p>

                      {/* Dropdown alasan — muncul saat ada izin */}
                      {hasIzin && (
                        <div className="mt-1.5">
                          <div className="relative">
                            <select
                              value={s.alasan || ''}
                              onChange={e => setAlasan(s.siswa_id, e.target.value as AlasanIzin)}
                              className="w-full appearance-none rounded border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 pr-6"
                            >
                              {alasanList.map(a => (
                                <option key={a.id} value={a.alasan}>{a.alasan}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                          </div>
                          {/* Preview keterangan */}
                          {s.keterangan && !noteOpen && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1">"{s.keterangan}"</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Tombol toggle izin */}
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      {hasIzin ? (
                        <>
                          <button
                            onClick={() => setExpandedNote(noteOpen ? null : s.siswa_id)}
                            className={`p-1.5 rounded-md ${s.keterangan ? 'text-amber-500' : 'text-slate-300'} hover:bg-white/60 dark:hover:bg-slate-700/60`}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setAlasan(s.siswa_id, null)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setAlasan(s.siswa_id, defaultAlasan as AlasanIzin)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-400 hover:border-blue-300 hover:text-blue-600 dark:hover:border-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <ShieldAlert className="h-3 w-3" />
                          Izin
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Input keterangan */}
                  {hasIzin && noteOpen && (
                    <div className="px-3 py-2 border-t border-blue-100 dark:border-blue-800/50">
                      <input
                        type="text"
                        value={s.keterangan}
                        onChange={e => setKeterangan(s.siswa_id, e.target.value)}
                        placeholder="Keterangan tambahan (opsional)..."
                        className="w-full text-xs bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              )
            })}

            {siswaList.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
                <p className="text-sm text-slate-400">Tidak ada siswa aktif di kelas ini.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Floating Save */}
      {hasLoaded && siswaList.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 p-3 bg-gradient-to-t from-white via-white dark:from-slate-900 dark:via-slate-900 to-transparent pointer-events-none">
          <div className="max-w-lg mx-auto pointer-events-auto">
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/30 h-11 text-sm font-semibold"
            >
              {isSaving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />
                  {jumlahIzin > 0 ? `Simpan Izin (${jumlahIzin} siswa)` : 'Simpan (hapus semua izin)'}
                  {hasChanges ? ' *' : ''}</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
