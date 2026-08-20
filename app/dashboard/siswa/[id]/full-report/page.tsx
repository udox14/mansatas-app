import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getUserRoles } from '@/lib/features'
import { FullReportClient } from './full-report-client'
import { canAccessFullStudentReport, loadFullStudentReport } from './report-data'

export const metadata = { title: 'Full Report Siswa - MANSATAS' }
export const dynamic = 'force-dynamic'

export default async function FullStudentReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ periode?: string; tahun?: string }>
}) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, getCurrentUser()])
  if (!user) redirect('/login')

  const db = await getDB()
  const [roles, studentScope] = await Promise.all([
    getUserRoles(db, user.id),
    db.prepare('SELECT kelas_id FROM siswa WHERE id = ?').bind(id).first<{ kelas_id: string | null }>(),
  ])
  if (!studentScope) notFound()

  const allowed = await canAccessFullStudentReport(db, user.id, roles, studentScope.kelas_id)
  if (!allowed) redirect('/dashboard/siswa')

  const selectedPeriod = query.periode || (query.tahun ? `year:${query.tahun}` : undefined)
  const report = await loadFullStudentReport(db, id, selectedPeriod)
  if (!report) notFound()

  return <FullReportClient report={report} />
}
