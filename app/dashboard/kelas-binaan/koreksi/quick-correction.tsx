'use client'

import { useState } from 'react'
import { useAttendanceAutosave } from '@/hooks/use-attendance-autosave'
import { attendanceDraftKey, clearAttendanceDraft, validAttendanceDraftStatus } from '@/lib/attendance-local-draft'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { attendanceStatusLabel } from '@/lib/attendance-status'
import { simpanKoreksiAbsensiCepat, type QuickAttendanceContext } from '../attendance-actions'

const statuses = ['HADIR', 'SAKIT', 'IZIN', 'ALFA'] as const
export function QuickAttendanceCorrection({ data }: { data: QuickAttendanceContext }) {
  const router = useRouter()
  const [status, setStatus] = useState<QuickAttendanceContext['waliStatus']>(data.waliStatus)
  const [note, setNote] = useState(data.waliNote)
  const [feedback, setFeedback] = useState('')
  const [saved, setSaved] = useState({ status: data.waliStatus, note: data.waliNote })
  const [revision, setRevision] = useState(data.revision)
  const localKey = attendanceDraftKey(data.userId, `cepat:${data.siswaId}:${data.tanggal}:${data.penugasanId}`)
  const changed = status !== saved.status || note !== saved.note
  const save = async () => {
      const result = await simpanKoreksiAbsensiCepat({ siswaId: data.siswaId, tanggal: data.tanggal, penugasanId: data.penugasanId, status, keterangan: note, revision })
      if (result.error) throw new Error(result.error)
      setSaved({ status, note })
      setFeedback('Koreksi tersimpan. Laporan orang tua akan diperiksa memakai data terbaru.')
      router.refresh()
  }
  const { saving: pending, error, retry, restored, discard } = useAttendanceAutosave(changed ? JSON.stringify([status, note, revision]) : '', save, {
    key: localKey, changes: { status, note, revision },
    restore: value => {
      const change = value as { status: QuickAttendanceContext['waliStatus']; note: string; revision: string } | null
      if (!change || !validAttendanceDraftStatus(change.status, true) || typeof change.note !== 'string' || change.note.length > 2000 || typeof change.revision !== 'string') throw new Error('Draft koreksi tidak valid.')
      // The server may have committed even when its response was lost offline.
      if (change.status === data.waliStatus && change.note === data.waliNote) { clearAttendanceDraft(localKey, value); return }
      setStatus(change.status); setNote(change.note); setRevision(change.revision)
    },
  })
  return <div className="space-y-5 rounded-xl border bg-surface p-4 sm:p-6">
    <div><h2 className="text-lg font-semibold">{data.nama}</h2><p className="text-sm text-muted-foreground">Kelas {data.kelas} · {data.tanggal}</p></div>
    <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm"><p className="font-medium">{data.mapel} · Jam {data.jam}</p><p>Catatan guru: <strong>{attendanceStatusLabel(data.statusGuru)}</strong></p>{data.catatanGuru && <p>{data.catatanGuru}</p>}</div>
    <p className="text-sm text-muted-foreground">{data.parentSent ? 'Laporan awal sudah terkirim ke orang tua. Koreksi akan diperhitungkan dalam rekap harian.' : data.parentDueAt ? `Laporan orang tua menunggu pemeriksaan sampai pukul ${new Date(data.parentDueAt).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB. Jika hasilnya Hadir, laporan dibatalkan.` : 'Belum ada laporan orang tua yang menunggu pengiriman.'}</p>
    <fieldset disabled={pending} className="space-y-3"><legend className="mb-2 text-sm font-semibold">Koreksi harian</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{statuses.map(value => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold ${status === value ? 'border-purple-600 bg-purple-50 text-purple-800 ring-1 ring-purple-600' : 'hover:bg-muted'}`}>{attendanceStatusLabel(value)}</button>)}</div>
      {(status || data.waliStatus) && <button type="button" onClick={() => { setStatus(null); setNote('') }} className="text-sm text-purple-700 hover:underline">Kembalikan ke status otomatis</button>}
      <div className="space-y-1"><label htmlFor="quick-correction-note" className="text-sm font-medium">Alasan koreksi <span className="font-normal text-muted-foreground">(opsional)</span></label><textarea id="quick-correction-note" disabled={!status} value={note} onChange={e => setNote(e.target.value)} maxLength={2000} rows={2} className="w-full rounded-lg border bg-background p-2 text-sm" /></div>
    </fieldset>
    <p className="text-sm text-muted-foreground">{data.isFinal ? `Rekap saat ini: ${attendanceStatusLabel(data.dailyStatus)}.` : 'Koreksi dapat disimpan sekarang. Rekap harian tersedia setelah KBM selesai.'} {data.pendingBlocks > 0 && `${data.pendingBlocks} blok pelajaran belum diinput.`} Catatan asli guru tetap tersimpan.</p>
    <p role="status" className="text-sm text-muted-foreground">{pending ? 'Menyimpan koreksi…' : error ? 'Koreksi belum tersimpan.' : changed ? 'Menunggu 2 detik tanpa perubahan baru untuk menyimpan…' : feedback || 'Perubahan status dan alasan disimpan otomatis setelah 2 detik.'}</p>
    {restored && <p className="text-xs text-muted-foreground">Koreksi yang belum terkirim dipulihkan dari perangkat.</p>}
    {error && <div className="flex flex-wrap items-center gap-3"><p role="alert" className="text-sm text-rose-600">{error}</p>{error.includes('Muat ulang') ? <Button variant="outline" onClick={() => { discard(); setStatus(data.waliStatus); setNote(data.waliNote); setSaved({status:data.waliStatus,note:data.waliNote}); setRevision(data.revision); router.refresh() }}>Gunakan data terbaru</Button> : <Button variant="outline" onClick={retry} disabled={pending}>Coba lagi</Button>}</div>}
  </div>
}
