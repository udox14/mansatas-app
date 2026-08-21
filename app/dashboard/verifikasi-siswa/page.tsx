import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getUserRoles } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { canAccessStudentVerification, loadVerificationQueue } from './verification-data'
import { VerificationQueueClient } from './verification-queue-client'

export const metadata = { title: 'Insight & Verifikasi Siswa - MANSATAS' }
export const dynamic = 'force-dynamic'

export default async function VerificationStudentsPage({ searchParams }: { searchParams: Promise<{ tahun?: string; kelas?: string }> }) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams])
  if (!user) redirect('/login')
  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  if (!canAccessStudentVerification(roles)) redirect('/dashboard')
  const data = await loadVerificationQueue(db, query.tahun, query.kelas)
  return (
    <div className="space-y-5 pb-14">
      <PageHeader title="Insight & Verifikasi Siswa" description="Pusat analisis lintas-domain untuk verifikasi kondisi siswa menjelang kenaikan kelas." icon={ShieldCheck} iconColor="text-emerald-600" />
      {data ? <VerificationQueueClient data={data} isSuperAdmin={roles.includes('super_admin')} /> : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950">Belum ada tahun ajaran yang dapat dianalisis.</div>
      )}
    </div>
  )
}
