'use client'

import { useMemo, useState } from 'react'
import { AttendanceCorrectionRequest } from './AttendanceCorrectionRequest'
import { isProposedAttendanceStatus, type AttendanceAlfaBlock } from '@/lib/attendance-correction'
import { useAttendanceAutosave } from '@/hooks/use-attendance-autosave'
import { attendanceDraftKey, clearAttendanceDraft, validAttendanceDraftStatus } from '@/lib/attendance-local-draft'
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
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvatarSiswa } from '@/components/ui/avatar-siswa'
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
  foto_url?: string | null
  total_blok: number
  submitted_blok: number
  is_daily_final: boolean
  kbm_end_at: string | null
  pending_blok: number
  guru_status: FinalStatus
  guru_status_reason: string
  wali_status: WaliStatus | null
  alfa_blocks?: AttendanceAlfaBlock[]
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
  userId: string
  kelasId: string
  tanggal: string
  today: string
  minDate: string
  rows: KeputusanAbsensiRow[]
  isEffective: boolean
  holidayReason?: string | null
}

const STATUS_OPTIONS: Array<{ status: WaliStatus; label: string; icon: any; className: string; activeBg: string }> = [
  { status: 'HADIR', label: 'Hadir', icon: CheckCircle2, className: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50', activeBg: 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500' },
  { status: 'SAKIT', label: 'Sakit', icon: Thermometer, className: 'border-amber-200 text-amber-700 hover:bg-amber-50', activeBg: 'bg-amber-50 border-amber-500 text-amber-800 ring-1 ring-amber-500' },
  { status: 'IZIN', label: 'Izin', icon: ShieldAlert, className: 'border-blue-200 text-blue-700 hover:bg-blue-50', activeBg: 'bg-blue-50 border-blue-500 text-blue-800 ring-1 ring-blue-500' },
  { status: 'ALFA', label: 'Alfa', icon: XCircle, className: 'border-rose-200 text-rose-700 hover:bg-rose-50', activeBg: 'bg-rose-50 border-rose-500 text-rose-800 ring-1 ring-rose-500' },
]

function badgeClass(status: string) {
  if (status === 'HADIR') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
  if (status === 'SAKIT') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
  if (status === 'IZIN') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
  if (status === 'ALFA') return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
  if (status === 'PARSIAL') return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
  if (status === 'PERLU_KONFIRMASI_WALI') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
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
  return <KehadiranHarianEditor key={`${props.kelasId}:${props.tanggal}:${JSON.stringify(props.rows)}`} {...props} />
}

function KehadiranHarianEditor({ userId, kelasId, tanggal, today, minDate, rows, isEffective, holidayReason }: Props) {
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

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (
      priority(a.status_akhir) - priority(b.status_akhir) ||
      a.nama_lengkap.localeCompare(b.nama_lengkap)
    ))
  }, [items])

  const hasChanges = items.some(row => row.draft_status !== row.wali_status || row.draft_keterangan !== (row.keterangan_wali_kelas || ''))
  const correctedCount = rows.filter(row => row.wali_status !== null).length

  // Ringkasan KBM global untuk tanggal terpilih
  const firstRow = rows[0]
  const kbmStatusText = firstRow ? (
    firstRow.is_daily_final
      ? 'Rekap setelah KBM, berdasarkan data yang tersedia.'
      : firstRow.kbm_end_at
        ? `Rekap sementara · KBM berakhir pukul ${new Date(firstRow.kbm_end_at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB.`
        : tanggal === today && firstRow.total_blok > 0
          ? 'Rekap sementara · jam pelajaran perlu dilengkapi agar akhir KBM dapat ditentukan.'
          : 'Belum ada input absensi untuk rekap harian.'
  ) : null

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

  const changedItems = items.filter(item => item.draft_status !== item.wali_status || item.draft_keterangan !== (item.keterangan_wali_kelas || ''))
  const save = async () => {
      if (changedItems.some(item => item.alfa_blocks?.length && isProposedAttendanceStatus(item.draft_status))) {
        throw new Error('Ajukan koreksi untuk siswa yang masih memiliki Alfa atau kembalikan draftnya ke status otomatis.')
      }
      const res = await simpanKeputusanAbsensiWaliBatch(
        kelasId,
        tanggal,
        changedItems.map(item => ({
          siswa_id: item.siswa_id,
          status: item.draft_status,
          keterangan: item.draft_keterangan,
        }))
      )

      if (res.error) {
        if (res.approvalRequired) {
          const blocked = res.approvalRequired
          setItems(previous => previous.map(item => blocked[item.siswa_id] ? { ...item, alfa_blocks: blocked[item.siswa_id] } : item))
          setEditing(Object.keys(blocked)[0])
        }
        throw new Error(res.error)
      }

      setMessage({ type: 'success', text: 'Koreksi kehadiran disimpan.' })
      setItems(previous => previous.map(item => changedItems.some(sent => sent.siswa_id === item.siswa_id) ? {
        ...item, wali_status: item.draft_status, keterangan_wali_kelas: item.draft_keterangan,
      } : item))
      router.refresh()
  }
  const pendingChanges = changedItems.map(item => ({ siswa_id: item.siswa_id, status: item.draft_status, keterangan: item.draft_keterangan }))
  const localKey = attendanceDraftKey(userId, `wali:${kelasId}:${tanggal}`)
  const { saving: isPending, error: saveError, retry, restored } = useAttendanceAutosave(pendingChanges.length ? JSON.stringify(pendingChanges) : '', save, {
    key: localKey, changes: pendingChanges,
    restore: value => {
      if (!isEffective) throw new Error('Draft tetap tersimpan di perangkat; tanggal ini tidak aktif untuk koreksi kehadiran.')
      if (!Array.isArray(value) || value.some(change => !change || !rows.some(row => row.siswa_id === change.siswa_id) || !validAttendanceDraftStatus(change.status, true) || typeof change.keterangan !== 'string' || change.keterangan.length > 2000)) throw new Error('Draft koreksi memuat siswa atau status yang tidak tersedia.')
      if (value.every(change => rows.some(row => row.siswa_id === change.siswa_id && row.wali_status === change.status && (row.keterangan_wali_kelas || '') === change.keterangan))) { clearAttendanceDraft(localKey,value); return }
      setItems(previous => previous.map(item => {
        const change = value.find(change => change.siswa_id === item.siswa_id)
        return change ? { ...item, draft_status: change.status, draft_keterangan: change.keterangan } : item
      }))
    },
  })

  return (
    <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
      {/* Header & Filter Tanggal */}
      <div className="flex flex-col gap-3 border-b border-surface-2 px-4 py-3 md:flex-row md:items-center">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="p-2 rounded-lg bg-purple-50 border border-purple-100 dark:bg-purple-950/40 dark:border-purple-800">
            <ClipboardCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Kehadiran Harian</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Pantau kehadiran dan koreksi jika diperlukan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="keputusan-absensi-tanggal" className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">Tanggal</label>
          <input
            id="keputusan-absensi-tanggal"
            type="date"
            value={tanggal}
            min={minDate}
            max={today}
            disabled={isPending}
            onChange={event => changeDate(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-purple-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>
        {correctedCount > 0 && (
          <div className="flex items-center">
            <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300">
              {correctedCount} dikoreksi wali kelas
            </span>
          </div>
        )}
      </div>

      {/* Banner Konteks KBM & Penjelasan Bersih */}
      <div className="border-b border-surface-2 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            Menampilkan kehadiran untuk <span className="font-semibold text-slate-800 dark:text-slate-100">{tanggal === today ? 'hari ini' : formatTanggal(tanggal)}</span>.
          </div>
          {kbmStatusText && (
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {kbmStatusText}
            </div>
          )}
        </div>
      </div>

      {!isEffective ? (
        <div className="px-4 py-8 text-center text-xs text-slate-500">
          {holidayReason || 'Tanggal ini tidak efektif pembelajaran. Absensi harian tidak dihitung.'}
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-slate-400">Belum ada siswa aktif di kelas ini.</div>
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

              return (
                <div key={row.siswa_id} className="p-3.5 sm:p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    {/* Profil & Status Siswa */}
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="mt-1 text-xs font-bold text-slate-400 w-5 shrink-0 text-right">{index + 1}</span>
                      <AvatarSiswa fotoUrl={row.foto_url} nama={row.nama_lengkap} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                            {row.nama_lengkap}
                          </p>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeClass(finalStatus)}`}>
                            {attendanceStatusLabel(finalStatus)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {row.wali_status ? '· Dikoreksi wali kelas' : `· ${attendanceSourceLabel(row.sumber_status)}`}
                          </span>
                        </div>

                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                          <span>NISN: {row.nisn}</span>
                          <span>•</span>
                          <span>{row.submitted_blok}/{row.total_blok} blok memiliki data</span>
                          {row.pending_blok > 0 && (
                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                              ({row.pending_blok} blok belum diinput)
                            </span>
                          )}
                        </div>

                        {row.status_reason && (
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{row.status_reason}</p>
                        )}

                        {row.keterangan_wali_kelas && (
                          <p className="mt-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            Catatan wali kelas: {row.keterangan_wali_kelas}
                          </p>
                        )}

                        {draftChanged && (
                          <p className="mt-1 text-[11px] font-semibold text-purple-700 dark:text-purple-400">
                            Koreksi belum disimpan: {row.draft_status ? attendanceStatusLabel(row.draft_status) : 'Kembali ke status otomatis'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Tombol Aksi */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end lg:self-start">
                      <button
                        type="button"
                        aria-expanded={isEditing}
                        onClick={() => setEditing(isEditing ? null : row.siswa_id)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isEditing
                            ? 'border-purple-300 bg-purple-600 text-white'
                            : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300'
                        }`}
                      >
                        {isEditing ? 'Tutup Koreksi' : 'Koreksi'}
                      </button>

                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => toggleExpanded(row.siswa_id)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          isExpanded
                            ? 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                        }`}
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                        <span>Detail & Riwayat</span>
                      </button>
                    </div>
                  </div>

                  {/* Panel Form Koreksi */}
                  {isEditing && (
                    <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50/40 p-3 dark:border-purple-900/60 dark:bg-purple-950/30 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                          Pilih Status Koreksi Wali Kelas:
                        </p>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {STATUS_OPTIONS.map(option => {
                          const Icon = option.icon
                          const active = row.draft_status === option.status
                          return (
                            <button
                              key={option.status}
                              disabled={isPending || (Boolean(row.alfa_blocks?.length) && isProposedAttendanceStatus(option.status))}
                              aria-pressed={active}
                              type="button"
                              onClick={() => setStatus(row.siswa_id, active ? null : option.status)}
                              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-all ${
                                active ? option.activeBg : `${option.className} bg-white dark:bg-slate-900`
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {option.label}
                            </button>
                          )
                        })}
                      </div>

                      {row.draft_status && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setStatus(row.siswa_id, null)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-rose-600 transition-colors"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Kembalikan ke Status Otomatis
                        </button>
                      )}

                      <div>
                        <input
                          aria-label={`Catatan koreksi untuk ${row.nama_lengkap}`}
                          disabled={!row.draft_status || isPending || (Boolean(row.alfa_blocks?.length) && isProposedAttendanceStatus(row.draft_status))}
                          type="text"
                          value={row.draft_keterangan}
                          onChange={event => setKeterangan(row.siswa_id, event.target.value)}
                          placeholder="Alasan koreksi wali kelas..."
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-purple-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        />
                      </div>
                      <AttendanceCorrectionRequest key={`${row.siswa_id}:${tanggal}`} siswaId={row.siswa_id} tanggal={tanggal}
                        blocks={row.alfa_blocks ?? []} draftStatus={draftChanged ? row.draft_status : null}
                        draftNote={draftChanged ? row.draft_keterangan : ''}
                        onRequested={() => {
                          setItems(previous => previous.map(item => item.siswa_id === row.siswa_id ? {
                            ...item, draft_status: item.wali_status, draft_keterangan: item.keterangan_wali_kelas || '',
                          } : item))
                          router.refresh()
                        }} />
                    </div>
                  )}

                  {/* Panel Detail & Riwayat Koreksi */}
                  {isExpanded && (
                    <div className="mt-3 space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                      <div>
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1.5">Rincian Sesi Pembelajaran Guru:</p>
                        {row.detail_guru.length === 0 ? (
                          <p className="text-[11px] text-slate-400">Belum ada detail sesi pembelajaran untuk siswa ini.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {row.detail_guru.map((detail, detailIndex) => (
                              <div
                                key={`${row.siswa_id}-${detail.nama_mapel}-${detailIndex}`}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-md border border-slate-200/80 bg-white px-3 py-2 text-xs shadow-xs dark:border-slate-800 dark:bg-slate-900"
                              >
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-bold text-slate-800 dark:text-slate-100">{detail.nama_mapel}</span>
                                  <span className="text-[11px] text-slate-400">
                                    (Jam {detail.jam_ke_mulai === detail.jam_ke_selesai ? detail.jam_ke_mulai : `${detail.jam_ke_mulai}-${detail.jam_ke_selesai}`})
                                  </span>
                                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeClass(detail.status)}`}>
                                    {attendanceStatusLabel(detail.status)}
                                  </span>
                                  {detail.guru_nama && (
                                    <span className="text-[11px] text-slate-500">· Guru: {detail.guru_nama}</span>
                                  )}
                                </div>
                                {detail.catatan ? (
                                  <span className="mt-1 sm:mt-0 text-[11px] text-slate-500 italic">Catatan: {detail.catatan}</span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Riwayat Koreksi */}
                      <div className="border-t border-slate-200 pt-2 dark:border-slate-800 text-[11px]">
                        <p className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          <History className="h-3.5 w-3.5" /> Riwayat koreksi
                        </p>
                        {historyLoading === row.siswa_id ? (
                          <p className="text-slate-400">Memuat riwayat...</p>
                        ) : (historyByStudent[row.siswa_id] || []).length === 0 ? (
                          <p className="text-slate-400">Belum ada perubahan yang tercatat.</p>
                        ) : (
                          <div className="space-y-1">
                            {(historyByStudent[row.siswa_id] || []).slice(0, 5).map(item => (
                              <div key={item.id} className="rounded border border-slate-100 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                                <p className="text-slate-500 text-[10px]">{item.actor_name || 'Pengguna'} · {new Date(item.created_at).toLocaleString('id-ID')}</p>
                                <p className="font-medium text-slate-700 dark:text-slate-200">
                                  {item.before.status ? attendanceStatusLabel(item.before.status) : 'Status otomatis'} → {item.after.status ? attendanceStatusLabel(item.after.status) : 'Status otomatis'}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Sticky Bottom Save Bar */}
          <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-surface-2 bg-white/95 px-4 py-3 backdrop-blur dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-between shadow-lg">
            <p className="text-xs text-slate-500">
              <span role="status">{isPending ? 'Menyimpan koreksi…' : saveError ? 'Koreksi belum tersimpan di server.' : hasChanges ? 'Koreksi tersimpan di perangkat; dikirim otomatis setelah 2 detik tanpa perubahan baru.' : 'Koreksi hanya diperlukan jika ada kekeliruan pada rekap. Perubahan disimpan otomatis setelah 2 detik.'}</span>
              {restored && <span className="block mt-1">Koreksi yang belum terkirim dipulihkan dari perangkat.</span>}
            </p>
            {saveError && <><p role="alert" className="text-xs text-rose-600">{saveError}</p><Button onClick={retry} disabled={isPending} variant="outline" size="sm">Coba lagi</Button></>}
          </div>
        </>
      )}
    </div>
  )
}
