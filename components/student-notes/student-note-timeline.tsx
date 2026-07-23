'use client'

import { useState, useTransition } from 'react'
import { NotePencil, PencilSimple, Trash, UserCircle, WarningCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AvatarSiswa } from '@/components/ui/avatar-siswa'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createStudentNote, deleteStudentNote, updateStudentNote } from '@/app/dashboard/catatan-siswa/actions'
import { STUDENT_NOTE_MAX_LENGTH, type StudentNote } from '@/lib/student-note-shared'

type Props = {
  notes: StudentNote[]
  siswa?: { id: string; nama_lengkap: string; nisn?: string | null; foto_url?: string | null } | null
  penugasanId?: string | null
  canCreate?: boolean
  showStudentOnCards?: boolean
  readOnlyLabel?: string
}

export function StudentNoteTimeline({
  notes,
  siswa,
  penugasanId,
  canCreate = false,
  showStudentOnCards = false,
  readOnlyLabel,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editing, setEditing] = useState<StudentNote | null>(null)
  const [deleting, setDeleting] = useState<StudentNote | null>(null)
  const [draft, setDraft] = useState('')

  const run = (action: () => Promise<{ success?: string; error?: string }>, onDone?: () => void) => {
    setMessage(null)
    startTransition(async () => {
      const result = await action()
      if (result.error) setMessage({ type: 'error', text: result.error })
      else {
        setMessage({ type: 'success', text: result.success || 'Berhasil.' })
        onDone?.()
      }
    })
  }

  const submitCreate = (formData: FormData) => {
    if (!siswa?.id || !penugasanId) return
    formData.set('siswa_id', siswa.id)
    formData.set('penugasan_id', penugasanId)
    run(() => createStudentNote(formData), () => {
      const form = document.getElementById('student-note-create-form') as HTMLFormElement | null
      form?.reset()
    })
  }

  return (
    <div className="min-w-0 space-y-4">
      {canCreate && siswa && penugasanId ? (
        <form id="student-note-create-form" action={submitCreate} className="rounded-xl border border-surface bg-surface p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex min-w-0 items-center gap-3">
            <AvatarSiswa fotoUrl={siswa.foto_url || null} nama={siswa.nama_lengkap} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">Catatan untuk {siswa.nama_lengkap}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">NISN {siswa.nisn || '-'}</p>
            </div>
          </div>
          <Textarea
            name="isi"
            required
            maxLength={STUDENT_NOTE_MAX_LENGTH}
            rows={5}
            placeholder="Tulis hal yang perlu dicatat tentang siswa ini..."
            className="min-h-28 resize-y bg-white dark:bg-slate-950"
          />
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-slate-400">Maksimal {STUDENT_NOTE_MAX_LENGTH.toLocaleString('id-ID')} karakter.</p>
            <Button type="submit" disabled={isPending} className="min-h-10 w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto">
              <NotePencil className="mr-2 h-4 w-4" /> {isPending ? 'Menyimpan...' : 'Simpan Catatan'}
            </Button>
          </div>
        </form>
      ) : readOnlyLabel ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">
          {readOnlyLabel}
        </div>
      ) : null}

      {message && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${message.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        {notes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-surface px-5 py-12 text-center dark:border-slate-700">
            <NotePencil className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Belum ada catatan siswa</p>
            <p className="mt-1 text-xs text-slate-400">Catatan yang tersimpan akan muncul sebagai riwayat di sini.</p>
          </div>
        ) : notes.map(note => (
          <article key={note.id} className="min-w-0 rounded-xl border border-surface bg-surface p-4 shadow-sm sm:p-5">
            {showStudentOnCards && (
              <div className="mb-3 flex items-center gap-2 border-b border-surface-2 pb-3">
                <AvatarSiswa fotoUrl={note.siswa_foto_url} nama={note.siswa_nama} size="sm" />
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800 dark:text-slate-100">{note.siswa_nama}</p>
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <UserCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="truncate">{note.pencatat_nama}</span>
                  </span>
                  {note.is_owner && <Badge variant="secondary" className="text-[10px]">Milik Anda</Badge>}
                </div>
                <p className="mt-1 break-words text-[11px] text-slate-400">
                  {note.kelas_nama} · {note.mapel_nama} · {note.tahun_ajaran_nama}
                </p>
              </div>
              {note.is_owner && (
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={() => { setDraft(note.isi); setEditing(note) }}>
                    <PencilSimple className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="min-h-9 border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => setDeleting(note)}>
                    <Trash className="h-3.5 w-3.5" />
                    <span className="sr-only">Hapus catatan</span>
                  </Button>
                </div>
              )}
            </div>
            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{note.isi}</p>
            <p className="mt-4 text-[11px] text-slate-400">
              {formatNoteDate(note.created_at)}{note.updated_at !== note.created_at ? ` · Diperbarui ${formatNoteDate(note.updated_at)}` : ''}
            </p>
          </article>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null) }}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw_-_1.5rem)] max-w-lg overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>Edit Catatan Siswa</DialogTitle>
            <DialogDescription>Perbarui isi catatan milik Anda.</DialogDescription>
          </DialogHeader>
          <Textarea value={draft} onChange={event => setDraft(event.target.value)} maxLength={STUDENT_NOTE_MAX_LENGTH} rows={8} className="resize-y" />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={isPending}>Batal</Button>
            <Button disabled={isPending || !draft.trim()} onClick={() => {
              if (!editing) return
              const data = new FormData()
              data.set('note_id', editing.id)
              data.set('isi', draft)
              run(() => updateStudentNote(data), () => setEditing(null))
            }}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={open => { if (!open) setDeleting(null) }}>
        <DialogContent className="w-[calc(100vw_-_1.5rem)] max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><WarningCircle className="h-5 w-5 text-rose-500" /> Hapus Catatan?</DialogTitle>
            <DialogDescription>Catatan akan dihapus permanen dan tidak dapat dipulihkan.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={isPending}>Batal</Button>
            <Button variant="destructive" disabled={isPending} onClick={() => {
              if (!deleting) return
              const data = new FormData()
              data.set('note_id', deleting.id)
              run(() => deleteStudentNote(data), () => setDeleting(null))
            }}>{isPending ? 'Menghapus...' : 'Hapus Catatan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatNoteDate(raw: string) {
  const normalized = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  }).format(date)
}
