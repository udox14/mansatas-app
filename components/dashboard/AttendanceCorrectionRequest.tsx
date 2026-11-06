'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { attendanceStatusLabel } from '@/lib/attendance-status'
import {
  ATTENDANCE_CORRECTION_LABEL, attendanceAlfaKey, isProposedAttendanceStatus,
  type AttendanceAlfaBlock, type ProposedAttendanceStatus,
} from '@/lib/attendance-correction'
import { getStudentAttendanceCorrections, requestAttendanceCorrection } from '@/app/dashboard/keterangan-absensi/correction-actions'

const statuses: ProposedAttendanceStatus[] = ['HADIR', 'SAKIT', 'IZIN']
type RequestRows = NonNullable<Awaited<ReturnType<typeof getStudentAttendanceCorrections>>['rows']>

export function AttendanceCorrectionRequest({ siswaId, tanggal, blocks, draftStatus, draftNote, onRequested, showEmpty = false }: {
  siswaId: string
  tanggal: string
  blocks: AttendanceAlfaBlock[]
  draftStatus?: string | null
  draftNote?: string
  onRequested?: () => void
  showEmpty?: boolean
}) {
  const [status, setStatus] = useState<ProposedAttendanceStatus | '' | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [rows, setRows] = useState<RequestRows>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [canRequest, setCanRequest] = useState<boolean | null>(null)
  const currentKey = attendanceAlfaKey(blocks)
  const pending = rows?.find(row => row.status === 'PENDING' && attendanceAlfaKey(row.blocks) === currentKey)
  const proposed = status ?? (isProposedAttendanceStatus(draftStatus) ? draftStatus : '')
  const reason = note ?? draftNote ?? ''

  useEffect(() => {
    let active = true
    getStudentAttendanceCorrections(siswaId, tanggal).then(result => {
      if (active) {
        setRows(result.rows ?? [])
        setCanRequest(Boolean(result.rows))
      }
    }).catch(() => { if (active) setError('Riwayat ajuan tidak dapat dimuat.') })
    return () => { active = false }
  }, [siswaId, tanggal])

  async function submit() {
    if (!proposed || !reason.trim()) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await requestAttendanceCorrection({ siswaId, tanggal, status: proposed, reason, alfaKey: currentKey })
      if (result.error) {
        setError(result.error)
      } else {
        setMessage(result.success || 'Ajuan dikirim.')
        setStatus(null)
        setNote(null)
        onRequested?.()
      }
      try {
        const refreshed = await getStudentAttendanceCorrections(siswaId, tanggal)
        if (refreshed.rows) setRows(refreshed.rows)
      } catch {
        setError('Riwayat ajuan belum dapat dimuat ulang.')
      }
    } catch {
      setError('Ajuan tidak dapat dikirim. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  if (!showEmpty && !blocks.length && !rows?.length && !error && !message) return null

  return <section className="space-y-3 rounded-lg border bg-background p-3 text-sm" aria-label="Pengajuan koreksi Alfa">
    {blocks.length > 0 && <>
      <div>
        <p className="font-semibold">Pengajuan koreksi Alfa</p>
        <p className="text-muted-foreground">Koreksi ke Hadir, Sakit, atau Izin memerlukan persetujuan madrasah.</p>
      </div>
      <ul className="space-y-1">
        {blocks.map(block => <li key={`${block.assignment}:${block.from}`}>
          <span className="font-medium">{block.mapel}</span> · Jam ke-{block.from}{block.from === block.to ? '' : `–${block.to}`} · Alfa
        </li>)}
      </ul>
      {pending ? <p className="font-medium">Menunggu persetujuan untuk status {attendanceStatusLabel(pending.proposed)}.</p>
        : canRequest === false ? <p className="text-muted-foreground">Ajuan dapat dikirim oleh wali kelas siswa.</p>
        : canRequest === true && (
        <div className="grid gap-2">
          <label className="grid gap-1 font-medium">Status yang diajukan
            <select value={proposed} onChange={event => setStatus(event.target.value as typeof status)}
              className="min-h-10 rounded-md border bg-background px-2 font-normal" disabled={busy}>
              <option value="">Pilih status</option>
              {statuses.map(value => <option key={value} value={value}>{attendanceStatusLabel(value)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 font-medium">Alasan pengajuan
            <textarea value={reason} onChange={event => setNote(event.target.value)} maxLength={2000} rows={2}
              className="rounded-md border bg-background p-2 font-normal" disabled={busy} />
          </label>
          <Button className="justify-self-start" type="button" disabled={busy || !proposed || !reason.trim()} onClick={submit}>Ajukan koreksi</Button>
        </div>
      )}
    </>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {showEmpty && !blocks.length && !rows?.length && <p className="text-muted-foreground">
      {canRequest === null ? 'Memuat riwayat ajuan…' : canRequest ? 'Belum ada riwayat ajuan.' : 'Riwayat ajuan tersedia untuk wali kelas siswa.'}
    </p>}
    {Boolean(rows?.length) && <>
      <Button type="button" variant="outline" size="sm" aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}>Riwayat ajuan</Button>
      {showHistory && <ul className="divide-y">
        {rows?.map(row => <li key={row.id} className="space-y-1 py-2">
          <p className="font-medium">{attendanceStatusLabel(row.proposed)} · {ATTENDANCE_CORRECTION_LABEL[
            row.status === 'PENDING' && attendanceAlfaKey(row.blocks) !== currentKey ? 'STALE' : row.status
          ]}</p>
          <p className="whitespace-pre-wrap break-words text-muted-foreground">{row.reason}</p>
        </li>)}
      </ul>}
    </>}
  </section>
}
