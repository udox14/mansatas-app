'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Thermometer,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { simpanKeputusanAbsensiWaliBatch } from '@/app/dashboard/kelas-binaan/attendance-actions'

type FinalStatus =
  | 'HADIR'
  | 'SAKIT'
  | 'IZIN'
  | 'ALFA'
  | 'PARSIAL'
  | 'PERLU_KONFIRMASI_WALI'
  | 'BELUM_ADA_INPUT'
  | 'BELUM_ADA_DATA'

type SourceStatus =
  | 'guru'
  | 'wali_kelas'
  | 'koreksi_wali_kelas'
  | 'perlu_konfirmasi_wali'
  | 'belum_ada_input'
  | 'belum_ada_data'

type WaliStatus = 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA'

export type KeputusanAbsensiRow = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  total_blok: number
  guru_status: FinalStatus
  wali_status: WaliStatus | null
  status_akhir: FinalStatus
  sumber_status: SourceStatus
  keterangan_wali_kelas: string | null
  detail_guru: Array<{
    status: string
    nama_mapel: string
    jam_ke_mulai: number
    jam_ke_selesai: number
    catatan: string
  }>
}

type Props = {
  kelasId: string
  tanggal: string
  rows: KeputusanAbsensiRow[]
  isEffective: boolean
  holidayReason?: string | null
}

const STATUS_OPTIONS: Array<{ status: WaliStatus; label: string; icon: any; className: string }> = [
  { status: 'HADIR', label: 'Hadir', icon: CheckCircle2, className: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
  { status: 'SAKIT', label: 'Sakit', icon: Thermometer, className: 'border-amber-200 text-amber-700 hover:bg-amber-50' },
  { status: 'IZIN', label: 'Izin', icon: ShieldAlert, className: 'border-blue-200 text-blue-700 hover:bg-blue-50' },
  { status: 'ALFA', label: 'Alfa', icon: XCircle, className: 'border-rose-200 text-rose-700 hover:bg-rose-50' },
]

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

function sourceLabel(source: string) {
  if (source === 'wali_kelas') return 'Wali Kelas'
  if (source === 'koreksi_wali_kelas') return 'Koreksi Wali'
  if (source === 'guru') return 'Guru'
  if (source === 'perlu_konfirmasi_wali') return 'Perlu Keputusan Wali'
  if (source === 'belum_ada_input') return 'Belum Ada Input'
  return 'Belum Lengkap'
}

function badgeClass(status: string) {
  if (status === 'HADIR') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'SAKIT') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (status === 'IZIN') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (status === 'ALFA') return 'bg-rose-50 text-rose-700 border-rose-200'
  if (status === 'PARSIAL') return 'bg-violet-50 text-violet-700 border-violet-200'
  if (status === 'PERLU_KONFIRMASI_WALI') return 'bg-purple-50 text-purple-700 border-purple-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function priority(status: FinalStatus) {
  if (status === 'PERLU_KONFIRMASI_WALI') return 0
  if (status === 'PARSIAL') return 1
  if (status === 'BELUM_ADA_INPUT') return 2
  if (status === 'BELUM_ADA_DATA') return 3
  if (status === 'ALFA') return 4
  if (status === 'SAKIT' || status === 'IZIN') return 5
  return 6
}

function needsWaliDecision(status: FinalStatus) {
  return ['PERLU_KONFIRMASI_WALI', 'PARSIAL', 'BELUM_ADA_INPUT', 'BELUM_ADA_DATA', 'ALFA'].includes(status)
}

export function KeputusanAbsensiHariIni({ kelasId, tanggal, rows, isEffective, holidayReason }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(() => rows.map(row => ({
    ...row,
    draft_status: row.wali_status,
    draft_keterangan: row.keterangan_wali_kelas || '',
  })))
  const [expanded, setExpanded] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isPending, startTransition] = useTransition()

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (
      priority(a.status_akhir) - priority(b.status_akhir) ||
      a.nama_lengkap.localeCompare(b.nama_lengkap)
    ))
  }, [items])

  const attentionCount = rows.filter(row => needsWaliDecision(row.status_akhir)).length
  const decidedCount = items.filter(row => row.draft_status !== null).length

  const setStatus = (siswaId: string, status: WaliStatus | null) => {
    setItems(prev => prev.map(item => item.siswa_id === siswaId ? { ...item, draft_status: status } : item))
    setHasChanges(true)
    setMessage(null)
  }

  const setKeterangan = (siswaId: string, value: string) => {
    setItems(prev => prev.map(item => item.siswa_id === siswaId ? { ...item, draft_keterangan: value } : item))
    setHasChanges(true)
    setMessage(null)
  }

  const save = () => {
    startTransition(async () => {
      const res = await simpanKeputusanAbsensiWaliBatch(
        kelasId,
        tanggal,
        items.map(item => ({
          siswa_id: item.siswa_id,
          status: item.draft_status,
          keterangan: item.draft_keterangan,
        }))
      )

      if (res.error) {
        setMessage({ type: 'error', text: res.error })
        return
      }

      setHasChanges(false)
      setMessage({ type: 'success', text: res.success || 'Keputusan absensi disimpan.' })
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-surface-2 px-4 py-3 md:flex-row md:items-center">
        <div className="flex items-center gap-2 flex-1">
          <div className="p-1.5 rounded-md bg-purple-50 border border-purple-100">
            <ClipboardCheck className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Keputusan Absensi Hari Ini</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Input guru per mapel menjadi dasar keputusan harian wali kelas</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-1 font-semibold text-purple-700">{attentionCount} perlu dicek</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">{decidedCount} sudah diputuskan</span>
        </div>
      </div>

      {!isEffective ? (
        <div className="px-4 py-6 text-center text-xs text-slate-500">
          {holidayReason || 'Hari ini tidak efektif pembelajaran. Keputusan absensi tidak wajib diisi.'}
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-slate-400">Belum ada siswa aktif di kelas ini.</div>
      ) : (
        <>
          {message && (
            <div className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-xs ${
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}>
              {message.text}
            </div>
          )}

          <div className="divide-y divide-surface-2">
            {sortedItems.map((row, index) => {
              const isExpanded = expanded === row.siswa_id
              const finalStatus = row.draft_status || row.status_akhir
              const noTeacherDetailText = needsWaliDecision(row.status_akhir)
                ? 'Belum ada detail input guru yang bisa dijadikan rujukan untuk siswa ini.'
                : 'Tidak ada catatan ketidakhadiran dari guru untuk siswa ini.'

              return (
                <div key={row.siswa_id} className="px-3 py-3 sm:px-4">
                  <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-slate-400">{index + 1}</span>
                        <p className="min-w-0 flex-1 basis-full text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100 sm:basis-auto">
                          {row.nama_lengkap}
                        </p>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeClass(finalStatus)}`}>
                          {statusLabel(finalStatus)}
                        </span>
                        <span className="text-[10px] text-slate-400">{sourceLabel(row.sumber_status)}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">{row.nisn}</p>

                      <div className="mt-2 space-y-1">
                        {row.detail_guru.length === 0 ? (
                          <p className="text-[11px] text-slate-400">{noTeacherDetailText}</p>
                        ) : (
                          row.detail_guru.map((detail, detailIndex) => (
                            <div key={`${row.siswa_id}-${detail.nama_mapel}-${detailIndex}`} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
                              <span className="font-semibold">{detail.nama_mapel}</span>
                              <span className="text-slate-400"> Jam {detail.jam_ke_mulai === detail.jam_ke_selesai ? detail.jam_ke_mulai : `${detail.jam_ke_mulai}-${detail.jam_ke_selesai}`}</span>
                              <span className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${badgeClass(detail.status)}`}>{statusLabel(detail.status)}</span>
                              {detail.catatan ? <span className="ml-1 text-slate-500">Catatan: {detail.catatan}</span> : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 xl:w-[360px]">
                      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                        {STATUS_OPTIONS.map(option => {
                          const Icon = option.icon
                          const active = row.draft_status === option.status
                          return (
                            <button
                              key={option.status}
                              type="button"
                              onClick={() => setStatus(row.siswa_id, active ? null : option.status)}
                              className={`inline-flex items-center justify-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                                active ? `${option.className} bg-white ring-1 ring-current` : `${option.className} bg-white`
                              }`}
                            >
                              <Icon className="h-3 w-3" />
                              {option.label}
                            </button>
                          )
                        })}
                        {row.draft_status && (
                          <button
                            type="button"
                            onClick={() => setStatus(row.siswa_id, null)}
                            className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 sm:col-span-auto"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Ikuti Guru
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpanded(isExpanded ? null : row.siswa_id)}
                          className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 sm:col-span-auto"
                        >
                          <MessageSquare className="h-3 w-3" />
                          Catatan
                        </button>
                      </div>

                      {(isExpanded || row.draft_keterangan) && (
                        <input
                          type="text"
                          value={row.draft_keterangan}
                          onChange={event => setKeterangan(row.siswa_id, event.target.value)}
                          placeholder="Catatan keputusan wali kelas..."
                          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-purple-300 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-surface-2 bg-white/95 px-4 py-3 backdrop-blur dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-slate-500">
              {hasChanges ? 'Ada perubahan keputusan absensi yang belum disimpan.' : 'Keputusan wali kelas sudah sesuai data terakhir.'}
            </p>
            <Button
              onClick={save}
              disabled={isPending || !hasChanges}
              className="bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              size="sm"
            >
              {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />}
              Simpan Keputusan
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
