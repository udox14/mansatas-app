import { Suspense } from 'react'
import Link from 'next/link'
import { getCurrentUser, isCurrentUserPlayReviewer } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db-server'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { Eye } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { MonitoringClient } from '@/app/dashboard/monitoring-penugasan/components/monitoring-client'
import { getCutiMonitoring, getMonitoringData, getPetugasPiketMonitoring } from './actions'
import { todayWIB } from '@/lib/time'

export const metadata = { title: 'Monitoring Penugasan - MANSATAS App' }

export const dynamic = 'force-dynamic'

async function Fetcher({ tanggal, canManageReasons }: { tanggal: string; canManageReasons: boolean }) {
  const [{ error, data }, petugasPiket, cuti] = await Promise.all([
    getMonitoringData(tanggal),
    getPetugasPiketMonitoring(tanggal),
    getCutiMonitoring(tanggal),
  ])
  if (error) return <div className="p-4 text-red-500 bg-red-50 rounded-lg">{error}</div>
  return <MonitoringClient initialData={[...cuti, ...data]} initialTanggal={tanggal} petugasPiket={petugasPiket} canManageReasons={canManageReasons} />
}

export default async function MonitoringPenugasanPage({
  searchParams
}: {
  searchParams: Promise<{ tanggal?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'monitoring-penugasan')
  if (!allowed) redirect('/dashboard')
  const roles = await getUserRoles(db, user.id)
  const canManageReasons = roles.includes('super_admin')
  const canManageLeave = !(await isCurrentUserPlayReviewer()) && (canManageReasons || (roles.includes('wakamad') && await db.prepare(
    'SELECT jabatan_struktural_id FROM "user" WHERE id = ?'
  ).bind(user.id).first<string>('jabatan_struktural_id') === 'jbt_waka_kurikulum'))

  const { tanggal: requestedTanggal } = await searchParams
  const tanggal = requestedTanggal || todayWIB()

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Monitoring Penugasan"
        description="Pantau seluruh pendelegasian tugas antar guru sekolah."
      />
      {canManageLeave && <Link href="/dashboard/monitoring-penugasan/cuti-guru" className="inline-flex rounded-md border px-3 py-2 text-sm font-medium">Cuti Guru</Link>}

      <Suspense fallback={<PageLoading text="Memuat data monitoring..." />} key={tanggal}>
        <Fetcher tanggal={tanggal} canManageReasons={canManageReasons} />
      </Suspense>
    </div>
  )
}
