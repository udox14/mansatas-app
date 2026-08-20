'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlass, NotePencil, Users } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AvatarSiswa } from '@/components/ui/avatar-siswa'
import { StudentNoteTimeline } from '@/components/student-notes/student-note-timeline'
import type { StudentNote, StudentNoteAssignment, StudentNoteClass, StudentNoteStudent, StudentNoteStudentWithStats } from '@/lib/student-note-shared'

type Props = {
  assignments: StudentNoteAssignment[]
  classes: StudentNoteClass[]
  students: StudentNoteStudent[]
  notedStudents: StudentNoteStudentWithStats[]
  notes: StudentNote[]
  selectedAssignmentId: string | null
  selectedClassId: string | null
  selectedStudent: StudentNoteStudent | null
  mode: 'kelas' | 'saya' | 'bercatatan'
}

export function CatatanSiswaClient(props: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [notedClass, setNotedClass] = useState('semua')
  const [notedSort, setNotedSort] = useState('terbaru')
  const visibleStudents = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('id-ID')
    if (!needle) return props.students
    return props.students.filter(student =>
      student.nama_lengkap.toLocaleLowerCase('id-ID').includes(needle) || String(student.nisn || '').includes(needle)
    )
  }, [props.students, search])
  const notedClasses = useMemo(() => Array.from(
    new Map(props.notedStudents.map(student => [student.kelas_id, student.kelas_label])).entries()
  ).sort((a, b) => a[1].localeCompare(b[1], 'id-ID', { numeric: true })), [props.notedStudents])
  const visibleNotedStudents = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('id-ID')
    return props.notedStudents
      .filter(student => notedClass === 'semua' || student.kelas_id === notedClass)
      .filter(student => !needle
        || student.nama_lengkap.toLocaleLowerCase('id-ID').includes(needle)
        || String(student.nisn || '').includes(needle))
      .sort((a, b) => {
        if (notedSort === 'terbanyak') return b.note_count - a.note_count || a.nama_lengkap.localeCompare(b.nama_lengkap, 'id-ID')
        if (notedSort === 'nama') return a.nama_lengkap.localeCompare(b.nama_lengkap, 'id-ID')
        return b.latest_note_at.localeCompare(a.latest_note_at) || a.nama_lengkap.localeCompare(b.nama_lengkap, 'id-ID')
      })
  }, [props.notedStudents, search, notedClass, notedSort])

  const navigate = (values: { assignment?: string | null; kelas?: string | null; siswa?: string | null }) => {
    const params = new URLSearchParams()
    params.set('mode', 'kelas')
    const assignment = values.assignment === undefined ? props.selectedAssignmentId : values.assignment
    const kelas = values.kelas === undefined ? props.selectedClassId : values.kelas
    const siswa = values.siswa === undefined ? props.selectedStudent?.id : values.siswa
    if (assignment) params.set('penugasan', assignment)
    if (kelas) params.set('kelas', kelas)
    if (siswa) params.set('siswa', siswa)
    router.push(`/dashboard/catatan-siswa?${params.toString()}`)
  }

  const navigateNotedStudent = (siswaId: string) => {
    const params = new URLSearchParams({ mode: 'bercatatan', siswa: siswaId })
    router.push(`/dashboard/catatan-siswa?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-surface bg-surface p-1 shadow-sm sm:w-fit sm:gap-2">
        <Link href="/dashboard/catatan-siswa?mode=kelas" className={`rounded-lg px-4 py-2 text-center text-xs font-semibold transition-colors ${props.mode === 'kelas' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-surface-2'}`}>
          Kelas & Siswa
        </Link>
        <Link href="/dashboard/catatan-siswa?mode=saya" className={`rounded-lg px-4 py-2 text-center text-xs font-semibold transition-colors ${props.mode === 'saya' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-surface-2'}`}>
          Catatan Saya
        </Link>
        <Link href="/dashboard/catatan-siswa?mode=bercatatan" className={`rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors sm:px-4 ${props.mode === 'bercatatan' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-surface-2'}`}>
          Siswa Bercatatan
        </Link>
      </div>

      {props.mode === 'saya' ? (
        <StudentNoteTimeline notes={props.notes} showStudentOnCards />
      ) : props.mode === 'bercatatan' ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-3 rounded-xl border border-surface bg-surface p-4 shadow-sm lg:sticky lg:top-0 lg:self-start">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Siswa Bercatatan</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{visibleNotedStudents.length} dari {props.notedStudents.length} siswa</p>
              </div>
            </div>
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama atau NISN..." className="min-h-10 pl-9" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={notedClass} onValueChange={setNotedClass}>
                <SelectTrigger className="min-h-10 w-full"><SelectValue placeholder="Semua kelas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua kelas</SelectItem>
                  {notedClasses.map(([id, label]) => <SelectItem key={id} value={id}>Kelas {label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={notedSort} onValueChange={setNotedSort}>
                <SelectTrigger className="min-h-10 w-full"><SelectValue placeholder="Urutkan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="terbaru">Catatan terbaru</SelectItem>
                  <SelectItem value="terbanyak">Catatan terbanyak</SelectItem>
                  <SelectItem value="nama">Nama A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-[58dvh] space-y-1 overflow-y-auto pr-1">
              {visibleNotedStudents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-xs text-slate-400 dark:border-slate-700">
                  Tidak ada siswa yang cocok dengan filter.
                </div>
              ) : visibleNotedStudents.map(student => (
                <button key={student.id} type="button" onClick={() => navigateNotedStudent(student.id)} className={`flex min-h-14 w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${props.selectedStudent?.id === student.id ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'hover:bg-surface-2'}`}>
                  <AvatarSiswa fotoUrl={student.foto_url} nama={student.nama_lengkap} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{student.nama_lengkap}</span>
                    <span className="block truncate text-[10px] text-slate-400">{student.kelas_label} · NISN {student.nisn || '-'}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{student.note_count}</span>
                </button>
              ))}
            </div>
          </aside>
          <main className="min-w-0">
            {props.selectedStudent ? (
              <StudentNoteTimeline notes={props.notes} siswa={props.selectedStudent} readOnlyLabel="Daftar ini hanya menampilkan siswa yang sudah memiliki catatan. Untuk menambah catatan baru, gunakan tab Kelas & Siswa." />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-surface px-5 py-14 text-center dark:border-slate-700">
                <NotePencil className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Belum ada siswa yang memiliki catatan</p>
                <p className="mt-1 text-xs text-slate-400">Siswa akan muncul otomatis setelah catatan pertamanya disimpan.</p>
              </div>
            )}
          </main>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-4 rounded-xl border border-surface bg-surface p-4 shadow-sm lg:sticky lg:top-0 lg:self-start">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <NotePencil className="h-4 w-4 text-emerald-600" />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Konteks Catatan</p>
              </div>
              {props.assignments.length > 0 ? (
                <div className="space-y-2">
                  <Select value={props.selectedAssignmentId || undefined} onValueChange={value => {
                    const assignment = props.assignments.find(item => item.id === value)
                    navigate({ assignment: value, kelas: assignment?.kelas_id || null, siswa: null })
                  }}>
                    <SelectTrigger className="min-h-10 w-full"><SelectValue placeholder="Pilih kelas dan mapel" /></SelectTrigger>
                    <SelectContent className="max-h-[60dvh] max-w-[calc(100vw_-_2rem)]">
                      {props.assignments.map(item => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {props.classes.length > 0 && (
                    <Select value={!props.selectedAssignmentId ? props.selectedClassId || undefined : undefined} onValueChange={value => navigate({ assignment: null, kelas: value, siswa: null })}>
                      <SelectTrigger className="min-h-10 w-full"><SelectValue placeholder="Atau buka kelas untuk dibaca" /></SelectTrigger>
                      <SelectContent className="max-h-[60dvh] max-w-[calc(100vw_-_2rem)]">
                        {props.classes.map(item => <SelectItem key={item.id} value={item.id}>Kelas {item.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : (
                <Select value={props.selectedClassId || undefined} onValueChange={value => navigate({ assignment: null, kelas: value, siswa: null })}>
                  <SelectTrigger className="min-h-10 w-full"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                  <SelectContent className="max-h-[60dvh] max-w-[calc(100vw_-_2rem)]">
                    {props.classes.map(item => <SelectItem key={item.id} value={item.id}>Kelas {item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {props.selectedClassId && (
              <div className="space-y-2">
                <div className="relative">
                  <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama atau NISN..." className="min-h-10 pl-9" />
                </div>
                <Select value={props.selectedStudent?.id || undefined} onValueChange={value => navigate({ siswa: value })}>
                  <SelectTrigger className="min-h-10 w-full"><SelectValue placeholder="Pilih siswa" /></SelectTrigger>
                  <SelectContent className="max-h-[60dvh] max-w-[calc(100vw_-_2rem)]">
                    {visibleStudents.map(student => <SelectItem key={student.id} value={student.id}>{student.nama_lengkap}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="hidden max-h-[52dvh] space-y-1 overflow-y-auto pr-1 lg:block">
                  {visibleStudents.map(student => (
                    <button key={student.id} type="button" onClick={() => navigate({ siswa: student.id })} className={`flex min-h-12 w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${props.selectedStudent?.id === student.id ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'hover:bg-surface-2'}`}>
                      <AvatarSiswa fotoUrl={student.foto_url} nama={student.nama_lengkap} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{student.nama_lengkap}</span>
                        <span className="block truncate text-[10px] text-slate-400">NISN {student.nisn || '-'}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <main className="min-w-0">
            {props.selectedStudent ? (
              <StudentNoteTimeline
                notes={props.notes}
                siswa={props.selectedStudent}
                penugasanId={props.selectedAssignmentId}
                canCreate={!!props.selectedAssignmentId}
                readOnlyLabel={!props.selectedAssignmentId ? 'Mode baca: hanya guru dengan penugasan aktif yang dapat menambahkan catatan.' : undefined}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-surface px-5 py-14 text-center dark:border-slate-700">
                <Users className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {props.selectedClassId ? 'Pilih siswa untuk melihat catatan' : 'Belum ada jadwal mengajar aktif saat ini'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {props.selectedClassId ? 'Gunakan filter kelas dan daftar siswa di atas.' : 'Pilih kelas atau penugasan secara manual untuk melanjutkan.'}
                </p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  )
}
