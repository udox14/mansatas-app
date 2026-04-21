// Lokasi: app/dashboard/kehadiran/components/absensi-client.tsx
'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2, XCircle, Thermometer, ShieldAlert,
  Loader2, BookOpen, RefreshCw, Save,
  MessageSquare, Users, ArrowLeft, ClipboardCheck,
} from 'lucide-react'
import {
  getBlokMengajarHariIni, loadSiswaAbsensi, simpanAbsensi,
  type BlokMengajar, type SiswaAbsensi,
} from '../actions'

interface Props {
  initialData: {
    error: string | null
    blocks: BlokMengajar[]
    tanggal: string
    hari: number
    hariNama: string
  }
}

const STATUS_CYCLE: Array<SiswaAbsensi['status']> = ['HADIR', 'SAKIT', 'ALFA', 'IZIN']
const STATUS_UI: Record<string, { bg: string; text: string; icon: any; label: string; border: string }> = {
  HADIR: { bg: 'bg-emerald-50 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, label: 'Hadir', border: 'border-emerald-200 dark:border-emerald-800' },
  SAKIT: { bg: 'bg-amber-50', text: 'text-amber-700', icon: Thermometer, label: 'Sakit', border: 'border-amber-200' },
  ALFA:  { bg: 'bg-red-50', text: 'text-red-700', icon: XCircle, label: 'Alfa', border: 'border-red-200' },
  IZIN:  { bg: 'bg-blue-50', text: 'text-blue-700', icon: ShieldAlert, label: 'Izin', border: 'border-blue-200' },
}

export function AbsensiClient({ initialData }: Props) {
  const [data, setData] = useState(initialData)
  const [activeBlock, setActiveBlock] = useState<BlokMengajar | null>(null)
  const [siswaList, setSiswaList] = useState<SiswaAbsensi[]>([])
  const [isLoadingSiswa, setIsLoadingSiswa] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const refresh = async () => {
    setIsRefreshing(true)
    setData(await getBlokMengajarHariIni())
    setIsRefreshing(false)
  }

  const openBlock = useCallback(async (block: BlokMengajar) => {
    setActiveBlock(block)
    setIsLoadingSiswa(true)
    setPesan(null)
    setHasChanges(false)
    const res = await loadSiswaAbsensi(block.penugasan_id, block.kelas_id, data.tanggal)
    if (res.error) setPesan({ tipe: 'error', teks: res.error })
    else setSiswaList(res.siswa)
    setIsLoadingSiswa(false)
  }, [data.tanggal])

  const closeBlock = () => {
    if (hasChanges && !confirm('Ada perubahan belum disimpan. Yakin ingin keluar?')) return
    setActiveBlock(null); setSiswaList([]); setHasChanges(false); setPesan(null)
  }

  const toggleStatus = (siswaId: string) => {
    setSiswaList(prev => prev.map(s => {
      if (s.siswa_id !== siswaId) return s
      const idx = STATUS_CYCLE.indexOf(s.status)
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
      return { ...s, status: next }
    }))
    setHasChanges(true)
  }

  const setStatus = (siswaId: string, status: SiswaAbsensi['status']) => {
    setSiswaList(prev => prev.map(s => s.siswa_id === siswaId ? { ...s, status } : s))
    setHasChanges(true)
  }

  const setCatatan = (siswaId: string, catatan: string) => {
    setSiswaList(prev => prev.map(s => s.siswa_id === siswaId ? { ...s, catatan } : s))
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!activeBlock) return
    setIsSaving(true); setPesan(null)
    const dataAbsen = siswaList.map(s => ({
      siswa_id: s.siswa_id, status: s.status, catatan: s.catatan,
    }))
    const res = await simpanAbsensi(
      activeBlock.penugasan_id, data.tanggal,
      activeBlock.jam_ke_mulai, activeBlock.jam_ke_selesai, activeBlock.jumlah_jam,
      dataAbsen,
    )
    if (res.error) setPesan({ tipe: 'error', teks: res.error })
    else { setPesan({ tipe: 'sukses', teks: res.success || 'Berhasil!' }); setHasChanges(false); refresh() }
    setIsSaving(false)
  }

  const { blocks, tanggal, hariNama, error } = data

  // Counts
  const counts = siswaList.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1; return acc
  }, {} as Record<string, number>)

  if (error) return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-6 text-center">
      <BookOpen className="h-8 w-8 text-amber-500 mx-auto mb-2" />
      <p className="text-sm text-amber-700">{error}</p>
    </div>
  )

  // ── VIEW: DAFTAR SISWA (ABSENSI) ──
  if (activeBlock) {
    const hadir = counts.HADIR || 0
    const tidakHadir = siswaList.length - hadir
    return (
      <div className="space-y-2">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b pb-2 -mx-1 px-1">
          <div className="flex items-center gap-2 mb-1.5">
            <button onClick={closeBlock} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/80 dark:hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 truncate">{activeBlock.mapel_nama}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {activeBlock.kelas_label} &middot; Jam {activeBlock.jam_ke_mulai === activeBlock.jam_ke_selesai ? activeBlock.jam_ke_mulai : `${activeBlock.jam_ke_mulai}-${activeBlock.jam_ke_selesai}`} ({activeBlock.slot_mulai}—{activeBlock.slot_selesai})
              </p>
            </div>
          </div>
          {/* Quick stats */}
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 font-medium">Hadir: {hadir}</span>
            {(counts.SAKIT || 0) > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Sakit: {counts.SAKIT}</span>}
            {(counts.ALFA || 0) > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Alfa: {counts.ALFA}</span>}
            {(counts.IZIN || 0) > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Izin: {counts.IZIN}</span>}
          </div>
          {/* Bulk actions */}
          <div className="flex gap-1.5 mt-2">
            <button onClick={() => { setSiswaList(prev => prev.map(s => ({ ...s, status: 'HADIR' }))); setHasChanges(true) }}
              className="text-[10px] px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 font-medium">Semua Hadir</button>
            <button onClick={() => { setSiswaList(prev => prev.map(s => ({ ...s, status: 'ALFA' }))); setHasChanges(true) }}
              className="text-[10px] px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium">Semua Alfa</button>
          </div>
        </div>

        {/* Loading */}
        {isLoadingSiswa && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        )}

        {/* Pesan */}
        {pesan && (
          <div className={`rounded-lg border px-3 py-2 text-xs ${pesan.tipe === 'sukses' ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {pesan.teks}
          </div>
        )}

        {/* Siswa List — Mobile optimized cards */}
        {!isLoadingSiswa && siswaList.map((s, idx) => {
          const ui = STATUS_UI[s.status]
          const Icon = ui.icon
          const noteOpen = expandedNote === s.siswa_id

          return (
            <div key={s.siswa_id} className={`rounded-lg border ${ui.border} ${ui.bg} overflow-hidden transition-colors`}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                {/* Number */}
                <span className="text-[10px] text-slate-400 w-5 text-center shrink-0">{idx + 1}</span>

                {/* Name + info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200 dark:text-slate-100 truncate leading-tight">{s.nama_lengkap}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400">{s.nisn}</span>
                    {s.keterangan_wali_kelas && (
                      <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded bg-purple-100 text-purple-700 font-medium">
                        <ClipboardCheck className="h-2.5 w-2.5" />
                        Wali Kelas
                      </span>
                    )}
                    {s.ada_izin && (
                      <span className="text-[10px] px-1.5 py-0 rounded bg-blue-200 text-blue-800 font-medium">Izin: {s.alasan_izin}</span>
                    )}
                  </div>
                </div>

                {/* Status toggle — tap to cycle */}
                <button
                  onClick={() => toggleStatus(s.siswa_id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border ${ui.border} ${ui.bg} ${ui.text} text-xs font-semibold shrink-0 active:scale-95 transition-transform`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {ui.label}
                </button>

                {/* Note toggle */}
                <button
                  onClick={() => setExpandedNote(noteOpen ? null : s.siswa_id)}
                  className={`p-1.5 rounded-md shrink-0 ${s.catatan ? 'text-amber-500' : 'text-slate-300'} hover:bg-white dark:hover:bg-slate-900/50`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Quick status bar (mobile: tap specific status) */}
              <div className="flex border-t border-white/60 divide-x divide-white/60">
                {STATUS_CYCLE.map(st => {
                  const u = STATUS_UI[st]
                  const active = s.status === st
                  return (
                    <button
                      key={st}
                      onClick={() => setStatus(s.siswa_id, st)}
                      className={`flex-1 py-1.5 text-[10px] font-medium text-center transition-colors ${active ? `${u.text} font-bold` : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-400'}`}
                    >
                      {u.label}
                    </button>
                  )
                })}
              </div>

              {/* Note input */}
              {noteOpen && (
                <div className="px-3 py-2 border-t border-white/60">
                  <input
                    type="text"
                    value={s.catatan}
                    onChange={e => setCatatan(s.siswa_id, e.target.value)}
                    placeholder="Catatan (opsional)..."
                    className="w-full text-xs bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-md px-2.5 py-1.5 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Floating Save Button */}
        {siswaList.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-20 p-3 bg-gradient-to-t from-white via-white dark:from-slate-900 dark:via-slate-900 to-transparent pointer-events-none">
            <div className="max-w-lg mx-auto pointer-events-auto">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 h-11 text-sm font-semibold"
              >
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" />Simpan Absensi {hasChanges ? '(ada perubahan)' : ''}</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── VIEW: DAFTAR BLOK MENGAJAR ──
  if (blocks.length === 0) return (
    <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-10 text-center">
      <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
      <p className="text-sm text-slate-500 dark:text-slate-400">Tidak ada jadwal mengajar hari ini ({hariNama}).</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Date header */}
      <div className="flex items-center justify-between rounded-lg border bg-white dark:bg-slate-900 dark:bg-slate-800 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-slate-200">
            {hariNama}, {new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{blocks.length} kelas untuk diabsen</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {pesan && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${pesan.tipe === 'sukses' ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {pesan.teks}
        </div>
      )}

      {/* Block cards */}
      {blocks.map(block => (
        <button
          key={block.penugasan_id}
          onClick={() => openBlock(block)}
          className="w-full text-left rounded-lg border bg-white dark:bg-slate-900 dark:bg-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 p-4 transition-colors active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">{block.mapel_nama}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {block.kelas_label} &middot;{' '}
                {block.jam_ke_mulai === block.jam_ke_selesai ? `Jam ${block.jam_ke_mulai}` : `Jam ${block.jam_ke_mulai}-${block.jam_ke_selesai}`}
                {' '}({block.jumlah_jam} JP) &middot; {block.slot_mulai}—{block.slot_selesai}
              </p>
            </div>
            {block.sudah_absen ? (
              <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 font-medium border border-emerald-200 dark:border-emerald-800">
                {block.tidak_hadir > 0 ? `${block.tidak_hadir} tdk hadir` : '✓ Semua hadir'}
              </span>
            ) : (
              <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-medium border border-slate-200 dark:border-slate-800">
                Belum diabsen
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Users className="h-3 w-3 text-slate-400" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{block.total_siswa} siswa</span>
          </div>
        </button>
      ))}
    </div>
  )
}
