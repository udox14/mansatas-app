import { redirect } from 'next/navigation'
import { NotePencil } from '@phosphor-icons/react/dist/ssr'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import {
  getAccessibleStudentNoteClasses,
  getCurrentStudentNoteAssignmentId,
  getMyStudentNotes,
  getStudentNoteAssignments,
  getStudentNoteContext,
  getStudentNotes,
  getStudentNoteStudents,
} from '@/lib/student-notes'
import { PageHeader } from '@/components/layout/page-header'
import { CatatanSiswaClient } from './catatan-siswa-client'

export const metadata = { title: 'Catatan Siswa - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function CatatanSiswaPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; penugasan?: string; kelas?: string; siswa?: string }>
}) {
  const query = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const db = await getDB()
  if (!(await checkFeatureAccess(db, user.id, 'catatan-siswa'))) redirect('/dashboard')

  const mode = query.mode === 'saya' ? 'saya' as const : 'kelas' as const
  const context = await getStudentNoteContext(db, user.id)
  const [assignments, classes] = await Promise.all([
    getStudentNoteAssignments(db, user.id),
    getAccessibleStudentNoteClasses(db, user.id, context.roles),
  ])

  if (mode === 'saya') {
    const notes = await getMyStudentNotes(db, user.id)
    return (
      <div className="min-w-0 space-y-4 animate-in fade-in duration-500 pb-10">
        <PageHeader title="Catatan Siswa" description="Catat dan baca informasi internal siswa yang terhubung dengan tugas Anda." />
        <CatatanSiswaClient assignments={assignments} classes={classes} students={[]} notes={notes} selectedAssignmentId={null} selectedClassId={null} selectedStudent={null} mode={mode} />
      </div>
    )
  }

  const autoAssignmentId = !query.penugasan && !query.kelas
    ? await getCurrentStudentNoteAssignmentId(db, user.id, assignments)
    : null
  const selectedAssignment = assignments.find(item => item.id === query.penugasan)
    || assignments.find(item => item.id === autoAssignmentId)
    || null
  const accessibleClassIds = new Set(classes.map(item => item.id))
  const selectedClassId = selectedAssignment?.kelas_id || (query.kelas && accessibleClassIds.has(query.kelas) ? query.kelas : null)
  const students = selectedClassId ? await getStudentNoteStudents(db, selectedClassId) : []
  const selectedStudent = students.find(item => item.id === query.siswa) || students[0] || null
  const notes = selectedStudent ? await getStudentNotes(db, user.id, selectedStudent.id, context.roles) : []

  return (
    <div className="min-w-0 space-y-4 animate-in fade-in duration-500 pb-10">
      <PageHeader title="Catatan Siswa" description="Catat dan baca informasi internal siswa yang terhubung dengan tugas Anda." />
      {classes.length === 0 && assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-surface px-6 py-14 text-center dark:border-slate-700">
          <NotePencil className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Belum ada kelas yang dapat diakses</p>
          <p className="mt-1 text-xs text-slate-400">Hubungi admin jika penugasan mengajar atau kelas binaan belum tersedia.</p>
        </div>
      ) : (
        <CatatanSiswaClient
          assignments={assignments}
          classes={classes}
          students={students}
          notes={notes}
          selectedAssignmentId={selectedAssignment?.id || null}
          selectedClassId={selectedClassId}
          selectedStudent={selectedStudent}
          mode={mode}
        />
      )}
    </div>
  )
}
