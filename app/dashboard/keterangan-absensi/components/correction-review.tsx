'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { attendanceStatusLabel } from '@/lib/attendance-status'
import { ATTENDANCE_CORRECTION_LABEL } from '@/lib/attendance-correction'
import { decideAttendanceCorrection, getAttendanceCorrectionReview, listAttendanceCorrectionQueue } from '../correction-actions'

type Queue = Awaited<ReturnType<typeof listAttendanceCorrectionQueue>>
type Review = NonNullable<Awaited<ReturnType<typeof getAttendanceCorrectionReview>>['data']>

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
  }).format(new Date(`${date}T00:00:00+07:00`))
}

function timeLabel(date: string) {
  return `${new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date(date.replace(' ', 'T') + 'Z'))} WIB`
}

export function AttendanceCorrectionReview({ initial }: { initial: Queue }) {
  const [queue, setQueue] = useState(initial)
  const [history, setHistory] = useState(false)
  const [review, setReview] = useState<Review | null>(null)
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(initial.error || '')

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setMessage('')
    try { await action() }
    catch { setError('Data ajuan tidak dapat diproses. Coba lagi.') }
    finally { setBusy(false) }
  }

  async function loadQueue(nextHistory: boolean, offset = 0) {
    const result = await listAttendanceCorrectionQueue(nextHistory, offset)
    if (result.error) { setError(result.error); return }
    setQueue(result)
    setHistory(nextHistory)
  }

  async function open(id: string) {
    const result = await getAttendanceCorrectionReview(id)
    if (!result.data) { setError(result.error || 'Ajuan tidak tersedia.'); return }
    setReview(result.data)
    setNote('')
    setRejecting(false)
  }

  async function decide(decision: 'APPROVED' | 'REJECTED' | 'STALE') {
    if (!review) return
    const result = await decideAttendanceCorrection(review.id, decision, note)
    if (result.error) { setError(result.error); return }
    setReview(null)
    await loadQueue(false)
    setMessage(result.success || 'Keputusan disimpan.')
  }

  return <section className="space-y-4" aria-label="Persetujuan koreksi">
    {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}
    {review ? <article className="space-y-5 rounded-xl border bg-surface p-4 sm:p-6">
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setReview(null)}>Kembali ke daftar</Button>
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">{review.student} · {review.kelas}</h2>
        <p className="text-sm text-muted-foreground">{dateLabel(review.date)} · {ATTENDANCE_CORRECTION_LABEL[review.stale ? 'STALE' : review.status]}</p>
      </header>
      <dl className="grid gap-3 rounded-lg border bg-background p-4 sm:grid-cols-2">
        <div><dt className="text-sm text-muted-foreground">Rekap harian saat ini</dt>
          <dd className="text-lg font-semibold">{review.isFinal ? attendanceStatusLabel(review.current) : 'Belum ditetapkan'}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Usulan wali kelas</dt>
          <dd className="text-lg font-semibold">{attendanceStatusLabel(review.proposed)}</dd></div>
      </dl>
      {review.stale && <p role="status" className="rounded-lg border border-amber-500/40 p-3 text-sm">Data Alfa berubah setelah ajuan dikirim. Wali kelas perlu mengajukan ulang berdasarkan data terbaru.</p>}
      <section className="space-y-2">
        <h3 className="font-semibold">{review.stale ? 'Catatan mapel Alfa saat ini' : 'Catatan mapel yang memicu Alfa'}</h3>
        <ul className="divide-y rounded-lg border px-3">
          {(review.currentBlocks ?? review.blocks).map(block => <li key={`${block.assignment}:${block.from}`} className="space-y-1 py-2.5">
            <p className="text-sm"><strong>{block.mapel}</strong> · Jam ke-{block.from}{block.from === block.to ? '' : `–${block.to}`}
              {block.teacher && ` · ${block.teacher}`} · <strong className="text-destructive">Alfa</strong></p>
            {block.note && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{block.note}</p>}
          </li>)}
          {review.currentBlocks?.length === 0 && <li className="py-2.5 text-sm text-muted-foreground">Tidak ada blok Alfa yang masih berlaku.</li>}
        </ul>
      </section>
      <section className="space-y-2 text-sm">
        <h3 className="font-semibold">Izin resmi</h3>
        {(review.currentPermissions ?? review.permissions).length ? <ul className="list-disc space-y-1 pl-5">
          {(review.currentPermissions ?? review.permissions).map((permission, index) => <li key={index}>
            {attendanceStatusLabel(permission.status)} · Jam ke-{permission.jam_ke_mulai}–{permission.jam_ke_selesai}
            {permission.catatan && <span className="break-words"> · {permission.catatan}</span>}
          </li>)}
        </ul> : <p className="text-muted-foreground">Tidak ada izin resmi pada blok KBM yang tercatat.</p>}
      </section>
      <section className="space-y-2 text-sm">
        <h3 className="font-semibold">Alasan wali kelas</h3>
        <p className="whitespace-pre-wrap break-words">{review.reason}</p>
        <p className="text-muted-foreground">Diajukan oleh {review.requester} · {timeLabel(review.requestedAt)}</p>
      </section>
      {review.status === 'PENDING' ? review.stale ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => decide('STALE'))}>Tutup ajuan lama</Button>
      ) : <div className="space-y-3 border-t pt-4">
        <p className="text-sm">Jika disetujui, rekap harian menjadi <strong>{attendanceStatusLabel(review.proposed)}</strong>. Catatan Alfa per mapel tetap tersimpan.</p>
        {!review.canApprove && <p className="text-sm text-muted-foreground">Persetujuan ajuan ini memerlukan pemeriksa lain.</p>}
        <label className="grid gap-1 text-sm font-medium">
          {rejecting ? 'Alasan penolakan (wajib)' : 'Catatan keputusan (opsional)'}
          <textarea className="rounded-md border bg-background p-2 font-normal" rows={2} maxLength={2000} value={note}
            disabled={busy} onChange={event => setNote(event.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={rejecting ? 'destructive' : 'outline'} disabled={busy || (rejecting && !note.trim())}
            onClick={() => rejecting ? run(() => decide('REJECTED')) : setRejecting(true)}>{rejecting ? 'Konfirmasi penolakan' : 'Tolak'}</Button>
          {rejecting ? <Button type="button" variant="outline" disabled={busy} onClick={() => setRejecting(false)}>Batal</Button>
            : <Button type="button" disabled={busy || !review.canApprove} onClick={() => run(() => decide('APPROVED'))}>Setujui menjadi {attendanceStatusLabel(review.proposed)}</Button>}
        </div>
      </div> : <section className="space-y-1 border-t pt-4 text-sm">
        <h3 className="font-semibold">{ATTENDANCE_CORRECTION_LABEL[review.status]}</h3>
        {review.reviewer && review.reviewedAt && <p className="text-muted-foreground">{review.reviewer} · {timeLabel(review.reviewedAt)}</p>}
        {review.reviewNote && <p className="whitespace-pre-wrap break-words">{review.reviewNote}</p>}
      </section>}
    </article> : <>
      <div className="flex flex-wrap gap-2" aria-label="Filter ajuan">
        <Button type="button" variant={history ? 'outline' : 'default'} aria-pressed={!history} disabled={busy}
          onClick={() => run(() => loadQueue(false))}>Menunggu ({queue.pending ?? 0})</Button>
        <Button type="button" variant={history ? 'default' : 'outline'} aria-pressed={history} disabled={busy}
          onClick={() => run(() => loadQueue(true))}>Riwayat</Button>
      </div>
      <ul className="divide-y rounded-xl border bg-surface">
        {queue.rows?.map(item => <li key={item.id} className="flex flex-col items-start gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-semibold">{item.student} · {item.kelas}</p>
            <p className="text-sm text-muted-foreground">{dateLabel(item.date)} · {item.blocks} blok Alfa</p>
            <p className="text-sm"><strong>{attendanceStatusLabel(item.previous)} → {attendanceStatusLabel(item.proposed)}</strong>
              {history && ` · ${ATTENDANCE_CORRECTION_LABEL[item.status]}`}</p>
          </div>
          <Button type="button" variant="outline" disabled={busy} aria-label={`Tinjau ajuan ${item.student}`}
            onClick={() => run(() => open(item.id))}>{history ? 'Lihat keputusan' : 'Tinjau'}</Button>
        </li>)}
        {!queue.rows?.length && <li className="p-5 text-sm text-muted-foreground">{history ? 'Belum ada keputusan koreksi.' : 'Tidak ada ajuan yang menunggu.'}</li>}
      </ul>
      {(queue.previousOffset != null || queue.nextOffset != null) && <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy || queue.previousOffset == null}
          onClick={() => run(() => loadQueue(history, queue.previousOffset ?? 0))}>Sebelumnya</Button>
        <Button type="button" variant="outline" disabled={busy || queue.nextOffset == null}
          onClick={() => run(() => loadQueue(history, queue.nextOffset ?? 0))}>Berikutnya</Button>
      </div>}
    </>}
  </section>
}
