// Lokasi: app/dashboard/pelaporan-pramubakti/page.tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { requirePbAccess } from '@/lib/pramubakti-db'
import { getEffectiveUser, getActAsDate, getActAsPramubaktiList } from '@/lib/act-as'
import { ActAsBanner } from '@/components/layout/act-as-banner'
import { getPramubaktiReports } from './actions'
import { PramubaktiClient } from './pramubakti-client'
import { PageHeader } from '@/components/layout/page-header'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pelaporan Pramubakti - MANSATAS App' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'pelaporan-pramubakti')
  if (!allowed) redirect('/dashboard')

  // Check super admin untuk fitur Act As
  const userRoles = await getUserRoles(db, user.id)
  const isSuperAdmin = userRoles.includes('super_admin')

  // Pastikan user berhak akses pelaporan pramubakti
  try {
    await requirePbAccess('self')
  } catch {
    if (!isSuperAdmin) redirect('/dashboard')
  }

  const effective = await getEffectiveUser()
  const isActingAs = isSuperAdmin && (effective?.isActingAs || false)
  const effectiveUserId = isActingAs ? effective?.effectiveUserId : user.id

  // Tanggal override: URL searchParam lebih prioritas dari cookie
  const urlDate = params?.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null
  const cookieDate = (isSuperAdmin && isActingAs) ? await getActAsDate() : null
  const actAsDate = urlDate || cookieDate

  // Ambil daftar pramubakti hanya jika super admin
  const actAsUsers = isSuperAdmin ? await getActAsPramubaktiList() : []

  const data = await getPramubaktiReports(undefined, undefined, effectiveUserId, actAsDate ?? undefined)

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Pelaporan Pramubakti"
        description="Pencatatan aktivitas pekerjaan dan presensi harian pramubakti."
      />

      {/* Act As Banner — identik dengan Agenda Guru */}
      {isSuperAdmin && (
        <Suspense fallback={null}>
          <ActAsBanner
            isActingAs={isActingAs}
            actAsName={effective?.actAsName || null}
            userList={actAsUsers}
            adminName={effective?.realUserName || 'Admin'}
            actAsDate={actAsDate}
            showDatePicker={true}
          />
        </Suspense>
      )}

      <PramubaktiClient
        initialData={data}
        isActingAs={isActingAs}
        actAsDate={actAsDate}
      />
    </div>
  )
}
