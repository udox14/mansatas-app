'use client'

import { useState } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { attendanceStatusLabel } from '@/lib/attendance-status'
import { ATTENDANCE_CORRECTION_LABEL } from '@/lib/attendance-correction'
import { decideAttendanceCorrection, getAttendanceCorrectionReview, listAttendanceCorrectionQueue } from '../correction-actions'

type Queue = Awaited<ReturnType<typeof listAttendanceCorrectionQueue>>
type Review = NonNullable<Awaited<ReturnType<typeof getAttendanceCorrectionReview>>['data']>

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  }).format(new Date(`${date}T00:00:00+07:00`))
}

function timeLabel(date: string) {
  return `${new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date(date.replace(' ', 'T') + 'Z'))} WIB`
}

export function AttendanceCorrectionReview({ initial, initialReview, initialError }: {
  initial: Queue; initialReview?: Review; initialError?: string
}) {
  const [queue, setQueue] = useState(initial)
  const [history, setHistory] = useState(false)
  const [review, setReview] = useState<Review | null>(initialReview ?? null)
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(initialError || initial.error || '')

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

  const blocks = review?.currentBlocks ?? review?.blocks ?? []
  const permissions = review?.currentPermissions ?? review?.permissions ?? []

  return <section className="max-w-5xl space-y-2" aria-label="Persetujuan koreksi" aria-busy={busy}>
    {error && <p role="alert" className="px-1 py-2 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="px-1 py-2 text-sm">{message}</p>}
    {review ? <article className="rounded-lg border bg-surface text-sm">
      <header className="border-b px-4 pb-3 pt-1 sm:px-5">
        <button type="button" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          disabled={busy} onClick={() => setReview(null)}><ArrowLeft className="size-4" aria-hidden="true" /> Daftar ajuan</button>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="break-words text-base font-semibold sm:text-lg">{review.student}</h2>
          <span className="font-medium text-muted-foreground">{ATTENDANCE_CORRECTION_LABEL[review.stale ? 'STALE' : review.status]}</span>
        </div>
        <p className="mt-0.5 text-muted-foreground">{review.kelas} · {dateLabel(review.date)}</p>
      </header>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 border-b bg-muted/30 px-4 py-2.5 sm:px-5">
        <div className="flex flex-wrap gap-x-2"><dt className="text-muted-foreground">Rekap saat ini</dt>
          <dd className="font-semibold">{review.isFinal ? attendanceStatusLabel(review.current) : 'Belum ditetapkan'}</dd></div>
        <div className="flex flex-wrap gap-x-2"><dt className="text-muted-foreground">Usulan wali</dt>
          <dd className="font-semibold">{attendanceStatusLabel(review.proposed)}</dd></div>
      </dl>
      {review.stale && <p role="status" className="border-b bg-amber-500/10 px-4 py-2 sm:px-5">Data Alfa berubah. Wali kelas perlu mengajukan ulang.</p>}
      <div className="grid gap-4 px-4 py-3 sm:grid-cols-2 sm:px-5">
        <section className="min-w-0 space-y-1">
          <h3 className="font-semibold">{review.stale ? 'Alfa mapel saat ini' : 'Alfa per mapel'}</h3>
          {blocks.length ? <ul className="divide-y">
            {blocks.map(block => <li key={`${block.assignment}:${block.from}`} className="py-1.5">
              <p className="break-words"><strong>{block.mapel}</strong> <span className="text-muted-foreground">· Jam ke-{block.from}{block.from === block.to ? '' : `–${block.to}`}{block.teacher && ` · ${block.teacher}`}</span></p>
              {block.note && <p className="whitespace-pre-wrap break-words text-muted-foreground">{block.note}</p>}
            </li>)}
          </ul> : <p className="text-muted-foreground">Tidak ada blok Alfa yang masih berlaku.</p>}
          {permissions.length ? <div className="pt-1">
            <h3 className="font-semibold">Izin resmi</h3>
            <ul className="space-y-0.5">
              {permissions.map((permission, index) => <li key={index} className="break-words text-muted-foreground">
                {attendanceStatusLabel(permission.status)} · Jam ke-{permission.jam_ke_mulai}–{permission.jam_ke_selesai}
                {permission.catatan && ` · ${permission.catatan}`}
              </li>)}
            </ul>
          </div> : <p className="text-muted-foreground">Izin resmi: tidak ada pada blok KBM.</p>}
        </section>
        <section className="min-w-0 space-y-1">
          <h3 className="font-semibold">Alasan wali kelas</h3>
          <p className="whitespace-pre-wrap break-words">{review.reason}</p>
          <p className="break-words text-muted-foreground">{review.requester} · {timeLabel(review.requestedAt)}</p>
        </section>
      </div>
      {review.status === 'PENDING' ? review.stale ? (
        <div className="border-t px-4 py-2.5 sm:px-5"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => run(() => decide('STALE'))}>Tutup ajuan lama</Button></div>
      ) : <div className="space-y-2 border-t px-4 py-2.5 sm:px-5">
        {!review.canApprove && <p className="text-sm text-muted-foreground">Persetujuan ajuan ini memerlukan pemeriksa lain.</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="grid min-w-0 flex-1 gap-1 font-medium">
            {rejecting ? 'Alasan penolakan (wajib)' : 'Catatan keputusan (opsional)'}
            <textarea className="min-h-9 resize-y rounded-md border bg-background px-2.5 py-1.5 font-normal" rows={1} maxLength={2000} value={note}
              disabled={busy} onChange={event => setNote(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={rejecting ? 'destructive' : 'outline'} disabled={busy || (rejecting && !note.trim())}
              onClick={() => rejecting ? run(() => decide('REJECTED')) : setRejecting(true)}>{rejecting ? 'Konfirmasi penolakan' : 'Tolak'}</Button>
            {rejecting ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setRejecting(false)}>Batal</Button>
              : <Button type="button" size="sm" disabled={busy || !review.canApprove} onClick={() => run(() => decide('APPROVED'))}>Setujui menjadi {attendanceStatusLabel(review.proposed)}</Button>}
          </div>
        </div>
      </div> : (review.reviewedAt || review.reviewNote) && <footer className="space-y-1 border-t px-4 py-2.5 sm:px-5">
        {review.reviewedAt && <p className="break-words text-muted-foreground">{review.reviewer ? `Diputuskan oleh ${review.reviewer} · ` : ''}{timeLabel(review.reviewedAt)}</p>}
        {review.reviewNote && <p className="whitespace-pre-wrap break-words">{review.reviewNote}</p>}
      </footer>}
    </article> : <div className="rounded-lg border bg-surface">
      <div className="flex gap-5 border-b px-4" role="group" aria-label="Filter ajuan">
        {[false, true].map(showHistory => <button key={String(showHistory)} type="button" aria-pressed={history === showHistory}
          disabled={busy} onClick={() => { if (history !== showHistory) void run(() => loadQueue(showHistory)) }}
          className={`min-h-10 border-b-2 text-sm font-medium ${history === showHistory ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          {showHistory ? 'Riwayat' : `Menunggu (${queue.pending ?? 0})`}
        </button>)}
      </div>
      <ul className="divide-y">
        {queue.rows?.map(item => <li key={item.id}>
          <button type="button" disabled={busy} onClick={() => run(() => open(item.id))}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-left text-sm hover:bg-muted/50 focus-visible:outline focus-visible:-outline-offset-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <span className="min-w-0 break-words"><strong>{item.student}</strong> <span className="text-muted-foreground">· {item.kelas}</span></span>
            <span className="col-start-1 row-start-2 text-muted-foreground sm:col-start-2 sm:row-start-1">{dateLabel(item.date)} · {item.blocks} blok Alfa</span>
            <span className="col-start-1 row-start-3 flex flex-wrap gap-x-2 sm:col-start-3 sm:row-start-1">
              {history ? <>
                <strong className={item.status === 'REJECTED' ? 'text-destructive' : 'text-foreground'}>
                  {item.status === 'APPROVED'
                    ? `Disetujui menjadi ${attendanceStatusLabel(item.proposed)}`
                    : ATTENDANCE_CORRECTION_LABEL[item.status]}
                </strong>
                {item.status !== 'APPROVED' && <span className="text-muted-foreground">Usulan {attendanceStatusLabel(item.proposed)}</span>}
              </> : <span className="font-medium">{attendanceStatusLabel(item.previous)} → {attendanceStatusLabel(item.proposed)}</span>}
            </span>
            <ChevronRight className="col-start-2 row-span-3 row-start-1 size-4 text-muted-foreground sm:col-start-4 sm:row-span-1" aria-hidden="true" />
          </button>
        </li>)}
        {!queue.rows?.length && <li className="px-4 py-3 text-sm text-muted-foreground">{history ? 'Belum ada keputusan koreksi.' : 'Tidak ada ajuan yang menunggu.'}</li>}
      </ul>
      {(queue.previousOffset != null || queue.nextOffset != null) && <div className="flex flex-wrap gap-2 border-t px-3 py-1">
        <Button type="button" variant="ghost" size="sm" disabled={busy || queue.previousOffset == null}
          onClick={() => run(() => loadQueue(history, queue.previousOffset ?? 0))}>Sebelumnya</Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy || queue.nextOffset == null}
          onClick={() => run(() => loadQueue(history, queue.nextOffset ?? 0))}>Berikutnya</Button>
      </div>}
    </div>}
  </section>
}
