'use client'

import { useState, useTransition } from 'react'
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
  const [pending, startTransition] = useTransition()
  const changed = status !== data.waliStatus || note !== data.waliNote
  const save = () => startTransition(async () => {
    try {
      const result = await simpanKoreksiAbsensiCepat({ siswaId: data.siswaId, tanggal: data.tanggal, penugasanId: data.penugasanId, status, keterangan: note, revision: data.revision })
      if (result.error) { setFeedback(result.error); return }
      setFeedback('Koreksi tersimpan. Laporan orang tua akan diperiksa memakai data terbaru.')
      router.refresh()
    } catch { setFeedback('Koreksi belum tersimpan. Coba kembali.'); }
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
    {feedback && <p role="status" className="text-sm">{feedback}</p>}
    <div className="flex items-center gap-3"><Button onClick={save} disabled={!changed || pending} className="min-h-11">{pending ? 'Menyimpan…' : 'Simpan Koreksi'}</Button>{feedback.includes('Muat ulang') && <Button variant="outline" onClick={() => router.refresh()}>Muat ulang</Button>}</div>
  </div>
}
