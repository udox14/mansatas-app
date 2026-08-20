import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getUserRoles } from '@/lib/features'
import { canAccessStudentVerification, loadStudentInsight, loadVerificationYears } from '../verification-data'
import { StudentInsightClient } from './student-insight-client'

export const metadata = { title: 'Insight Siswa - MANSATAS' }
export const dynamic = 'force-dynamic'

export default async function StudentInsightPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tahun?: string }> }) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, getCurrentUser()])
  if (!user) redirect('/login')
  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  if (!canAccessStudentVerification(roles)) redirect('/dashboard')
  const data = await loadStudentInsight(db, id, query.tahun)
  if (!data) {
    const studentExists = await db.prepare('SELECT id FROM siswa WHERE id=?').bind(id).first()
    if (!studentExists) notFound()
    const { selected } = await loadVerificationYears(db, query.tahun)
    redirect(`/dashboard/verifikasi-siswa${selected ? `?tahun=${encodeURIComponent(selected.name)}` : ''}`)
  }
  return <StudentInsightClient data={data} />
}
