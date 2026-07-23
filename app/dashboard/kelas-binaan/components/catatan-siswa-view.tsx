'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StudentNoteTimeline } from '@/components/student-notes/student-note-timeline'
import { markStudentNotesRead } from '@/app/dashboard/catatan-siswa/actions'
import { studentNoteCollator, type StudentNote, type StudentNoteStudent } from '@/lib/student-note-shared'

export function KelasBinaanCatatanSiswaView({
  kelasId,
  students,
  selectedStudent,
  notes,
  markAsRead,
}: {
  kelasId: string
  students: StudentNoteStudent[]
  selectedStudent: StudentNoteStudent | null
  notes: StudentNote[]
  markAsRead: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const sortedStudents = useMemo(() => [...students].sort((a, b) => studentNoteCollator.compare(a.nama_lengkap, b.nama_lengkap)), [students])
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('id-ID')
    return needle ? sortedStudents.filter(item => item.nama_lengkap.toLocaleLowerCase('id-ID').includes(needle) || String(item.nisn || '').includes(needle)) : sortedStudents
  }, [search, sortedStudents])

  useEffect(() => {
    if (markAsRead) void markStudentNotesRead(kelasId)
  }, [kelasId, markAsRead])

  const selectStudent = (siswaId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'catatan')
    params.set('siswa', siswaId)
    router.push(`/dashboard/kelas-binaan?${params.toString()}`)
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-3 rounded-xl border border-surface bg-surface p-4 shadow-sm lg:self-start">
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Pilih Siswa Binaan</p>
          <p className="mt-0.5 text-xs text-slate-400">Baca seluruh riwayat catatan siswa.</p>
        </div>
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama atau NISN..." className="min-h-10 pl-9" />
        </div>
        <Select value={selectedStudent?.id || undefined} onValueChange={selectStudent}>
          <SelectTrigger className="min-h-10"><SelectValue placeholder="Pilih siswa" /></SelectTrigger>
          <SelectContent className="max-h-[60dvh] max-w-[calc(100vw_-_2rem)]">
            {filtered.map(student => <SelectItem key={student.id} value={student.id}>{student.nama_lengkap}</SelectItem>)}
          </SelectContent>
        </Select>
      </aside>
      <div className="min-w-0">
        {selectedStudent ? (
          <StudentNoteTimeline notes={notes} siswa={selectedStudent} readOnlyLabel="Catatan ini bersifat internal. Penambahan catatan dilakukan melalui modul Catatan Siswa sesuai penugasan mengajar." />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-surface px-5 py-12 text-center text-sm text-slate-400 dark:border-slate-700">Belum ada siswa aktif di kelas ini.</div>
        )}
      </div>
    </div>
  )
}
