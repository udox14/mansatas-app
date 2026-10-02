'use client'

import { useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  ClipboardCheck,
  History,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Thermometer,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getKeputusanAbsensiHistory,
  simpanKeputusanAbsensiWaliBatch,
  type KeputusanAbsensiHistoryRow,
} from '@/app/dashboard/kelas-binaan/attendance-actions'
import {
  attendanceSourceLabel,
  attendanceStatusLabel,
  type FinalAttendanceSource,
  type FinalAttendanceStatus,
} from '@/lib/attendance-status'

type FinalStatus = FinalAttendanceStatus
type SourceStatus = FinalAttendanceSource

type WaliStatus = 'HADIR' | 'SAKIT' | 'IZIN' | 'ALFA'

export type KeputusanAbsensiRow = {
  siswa_id: string
  nama_lengkap: string
  nisn: string
  total_blok: number
  submitted_blok: number
  is_daily_final: boolean
  kbm_end_at: string | null
  pending_blok: number
  guru_status: FinalStatus
  guru_status_reason: string
  wali_status: WaliStatus | null
  status_akhir: FinalStatus
  sumber_status: SourceStatus
  status_reason: string
  requires_wali_decision: boolean
  keterangan_wali_kelas: string | null
  detail_guru: Array<{
    status: string
    nama_mapel: string
    guru_nama: string | null
    sumber: 'guru' | 'perizinan_siswa'
    jam_ke_mulai: number
    jam_ke_selesai: number
    catatan: string
  }>
}

type Props = {
  kelasId: string
  tanggal: string
  today: string
  minDate: string
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

function formatTanggal(tanggal: string) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(`${tanggal}T00:00:00+07:00`))
}

export function KeputusanAbsensiHariIni(props: Props) {
  // A new server snapshot resets drafts and history, including after saving a correction.
  return <KehadiranHarianEditor key={`${props.kelasId}:${props.tanggal}:${JSON.stringify(props.rows)}`} {...props} />
}

function KehadiranHarianEditor({ kelasId, tanggal, today, minDate, rows, isEffective, holidayReason }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [items, setItems] = useState(() => rows.map(row => ({
    ...row,
    draft_status: row.wali_status,
    draft_keterangan: row.keterangan_wali_kelas || '',
  })))
  const [editing, setEditing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [historyByStudent, setHistoryByStudent] = useState<Record<string, KeputusanAbsensiHistoryRow[]>>({})
  const [historyLoading, setHistoryLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (
      priority(a.status_akhir) - priority(b.status_akhir) ||
      a.nama_lengkap.localeCompare(b.nama_lengkap)
    ))
  }, [items])

  const hasChanges = items.some(row => row.draft_status !== row.wali_status || row.draft_keterangan !== (row.keterangan_wali_kelas || ''))
  const correctedCount = rows.filter(row => row.wali_status !== null).length

  const setStatus = (siswaId: string, status: WaliStatus | null) => {
    setItems(prev => prev.map(item => item.siswa_id === siswaId ? { ...item, draft_status: status, draft_keterangan: status ? item.draft_keterangan : '' } : item))
    setMessage(null)
  }

  const setKeterangan = (siswaId: string, value: string) => {
    setItems(prev => prev.map(item => item.siswa_id === siswaId ? { ...item, draft_keterangan: value } : item))
    setMessage(null)
  }

  const changeDate = (nextDate: string) => {
    if (!nextDate || nextDate === tanggal) return
    if (hasChanges && !window.confirm('Perubahan yang belum disimpan akan hilang. Ganti tanggal sekarang?')) return

    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'keputusan')
    params.set('tanggal', nextDate)
    router.push(`${pathname}?${params.toString()}`)
  }

  const toggleExpanded = async (siswaId: string) => {
    if (expanded === siswaId) {
      setExpanded(null)
      return
    }
    setExpanded(siswaId)
    if (historyByStudent[siswaId]) return
    setHistoryLoading(siswaId)
    const result = await getKeputusanAbsensiHistory(siswaId, tanggal)
    setHistoryByStudent(prev => ({ ...prev, [siswaId]: result.history || [] }))
    setHistoryLoading(null)
  }

  const save = () => {
    startTransition(async () => {
      const res = await simpanKeputusanAbsensiWaliBatch(
        kelasId,
        tanggal,
        items.filter(item => item.draft_status !== item.wali_status || item.draft_keterangan !== (item.keterangan_wali_kelas || '')).map(item => ({
          siswa_id: item.siswa_id,
          status: item.draft_status,
          keterangan: item.draft_keterangan,
        }))
      )

      if (res.error) {
        setMessage({ type: 'error', text: res.error })
        return
      }

      setMessage({ type: 'success', text: 'Koreksi kehadiran disimpan.' })
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
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Kehadiran Harian</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Pantau kehadiran dan koreksi jika diperlukan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="keputusan-absensi-tanggal" className="whitespace-nowrap text-[10px] font-semibold text-slate-500 dark:text-slate-400">Tanggal</label>
          <input
            id="keputusan-absensi-tanggal"
            type="date"
            value={tanggal}
            min={minDate}
            max={today}
            disabled={isPending}
            onChange={event => changeDate(event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:border-purple-300 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">{correctedCount} dikoreksi wali kelas</span>
        </div>
      </div>

      <div className="border-b border-surface-2 px-4 py-2 text-[11px] text-slate-500 dark:text-slate-400">
        Menampilkan kehadiran untuk <span className="font-semibold text-slate-700 dark:text-slate-200">{tanggal === today ? 'hari ini' : formatTanggal(tanggal)}</span>. Status harian ditentukan otomatis setelah pembelajaran selesai. Wali kelas cukup memeriksa dan melakukan koreksi jika ada kekeliruan.
      </div>

      {!isEffective ? (
        <div className="px-4 py-6 text-center text-xs text-slate-500">
          {holidayReason || 'Tanggal ini tidak efektif pembelajaran. Absensi harian tidak dihitung.'}
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
              const isEditing = editing === row.siswa_id
              const draftChanged = row.draft_status !== row.wali_status || row.draft_keterangan !== (row.keterangan_wali_kelas || '')
              const finalStatus = row.status_akhir
              const noTeacherDetailText = 'Belum ada detail sesi pembelajaran untuk siswa ini.'

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
                          {attendanceStatusLabel(finalStatus)}
                        </span>
                        <span className="text-[10px] text-slate-400">{row.wali_status ? 'Dikoreksi wali kelas' : attendanceSourceLabel(row.sumber_status)}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">{row.nisn}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{row.status_reason}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{row.submitted_blok}/{row.total_blok} blok memiliki data · {row.pending_blok} blok belum diinput</p>

                      <p className="mt-1 text-[11px] text-slate-500">
                        {row.is_daily_final ? 'Rekap setelah KBM, berdasarkan data yang tersedia.' : row.kbm_end_at ? `Rekap sementara · KBM berakhir pukul ${new Date(row.kbm_end_at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB.` : tanggal === today && row.total_blok > 0 ? 'Rekap sementara · jam pelajaran perlu dilengkapi agar akhir KBM dapat ditentukan.' : 'Belum ada input absensi untuk rekap harian.'}
                      </p>
                      {row.keterangan_wali_kelas && <p className="mt-1 text-[11px] text-slate-500">Catatan wali kelas: {row.keterangan_wali_kelas}</p>}
                      {draftChanged && <p className="mt-1 text-[11px] font-semibold text-purple-700">Koreksi belum disimpan: {row.draft_status ? attendanceStatusLabel(row.draft_status) : 'Kembali ke status otomatis'}</p>}
                      {isExpanded && <div className="mt-2 space-y-1">
                        {row.detail_guru.length === 0 ? (
                          <p className="text-[11px] text-slate-400">{noTeacherDetailText}</p>
                        ) : (
                          row.detail_guru.map((detail, detailIndex) => (
                            <div key={`${row.siswa_id}-${detail.nama_mapel}-${detailIndex}`} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="font-semibold">{detail.nama_mapel}</span>
                                <span className="text-slate-400"> Jam ke-{detail.jam_ke_mulai === detail.jam_ke_selesai ? detail.jam_ke_mulai : `${detail.jam_ke_mulai}-${detail.jam_ke_selesai}`}</span>
                                <span className={`ml-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${badgeClass(detail.status)}`}>{attendanceStatusLabel(detail.status)}</span>
                              </div>
                              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                {detail.sumber === 'perizinan_siswa' ? 'Perizinan diinput oleh' : 'Absensi diinput oleh'}:{' '}
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{detail.guru_nama || 'Tidak diketahui'}</span>
                              </p>
                              {detail.catatan ? <p className="mt-0.5 text-[10px] text-slate-500">Catatan: {detail.catatan}</p> : null}
                            </div>
                          ))
                        )}
                      </div>}
                    </div>

                    <div className="flex flex-col gap-2 xl:w-[360px]">
                      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                        <button type="button" aria-expanded={isEditing} onClick={() => setEditing(isEditing ? null : row.siswa_id)} className="rounded-md border border-purple-200 px-2.5 py-1.5 text-[11px] font-semibold text-purple-700">{isEditing ? 'Tutup Koreksi' : 'Koreksi'}</button>
                        {isEditing && STATUS_OPTIONS.map(option => {
                          const Icon = option.icon
                          const active = row.draft_status === option.status
                          return (
                            <button
                              key={option.status}
                              disabled={isPending}
                              aria-pressed={active}
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
                        {isEditing && row.draft_status && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => setStatus(row.siswa_id, null)}
                            className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 sm:col-span-auto"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Kembalikan ke Status Otomatis
                          </button>
                        )}
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => toggleExpanded(row.siswa_id)}
                          className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 sm:col-span-auto"
                        >
                          <MessageSquare className="h-3 w-3" />
                          Detail & Riwayat
                        </button>
                      </div>

                      {(isExpanded || isEditing) && (
                        <div className="space-y-2">
                          {isEditing && <input
                            aria-label={`Catatan koreksi untuk ${row.nama_lengkap}`}
                            disabled={!row.draft_status || isPending}
                            type="text"
                            value={row.draft_keterangan}
                            onChange={event => setKeterangan(row.siswa_id, event.target.value)}
                            placeholder="Alasan koreksi wali kelas..."
                            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-purple-300 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                          />}
                          {isExpanded && (
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                              <p className="mb-1 flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300"><History className="h-3 w-3" /> Riwayat koreksi</p>
                              {historyLoading === row.siswa_id ? <p>Memuat riwayat...</p> : (historyByStudent[row.siswa_id] || []).length === 0 ? <p>Belum ada perubahan yang tercatat.</p> : (
                                <div className="space-y-1.5">
                                  {(historyByStudent[row.siswa_id] || []).slice(0, 5).map(item => (
                                    <div key={item.id} className="border-t border-slate-200 pt-1 first:border-0 first:pt-0">
                                      <p>{item.actor_name || 'Pengguna'} · {new Date(item.created_at).toLocaleString('id-ID')}</p>
                                      <p>{item.before.status ? attendanceStatusLabel(item.before.status) : 'Status otomatis'} → {item.after.status ? attendanceStatusLabel(item.after.status) : 'Status otomatis'}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-surface-2 bg-white/95 px-4 py-3 backdrop-blur dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-slate-500">
              {hasChanges ? 'Ada koreksi yang belum disimpan.' : 'Koreksi hanya diperlukan jika ada kekeliruan pada rekap.'}
            </p>
            <Button
              onClick={save}
              disabled={isPending || !hasChanges}
              className="bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              size="sm"
            >
              {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />}
              Simpan Koreksi
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
