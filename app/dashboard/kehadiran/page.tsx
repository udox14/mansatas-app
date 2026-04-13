// Lokasi: app/dashboard/kehadiran/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'
import { AbsensiClient } from './components/absensi-client'
import { getBlokMengajarHariIni } from './actions'
import { getEffectiveUser, getActAsUserList, getActAsDate } from '@/lib/act-as'
import { ActAsBanner } from '@/components/layout/act-as-banner'

export const metadata = { title: 'Absensi Siswa - MANSATAS App' }

async function AbsensiFetcher({ effectiveUserId, dateOverride }: { effectiveUserId: string; dateOverride?: string }) {
  const data = await getBlokMengajarHariIni(effectiveUserId, dateOverride)
  return <AbsensiClient initialData={data} />
}

export const dynamic = 'force-dynamic'
export default async function KehadiranPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'kehadiran')
  if (!allowed) redirect('/dashboard')

  // Check super admin untuk fitur Act As
  const userRoles = await getUserRoles(db, user.id)
  const isSuperAdmin = userRoles.includes('super_admin')

  const effective = await getEffectiveUser()
  const effectiveUserId = effective?.effectiveUserId || user.id

  // Tanggal override: URL searchParam lebih prioritas dari cookie
  const urlDate = params?.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null
  const cookieDate = (isSuperAdmin && effective?.isActingAs) ? await getActAsDate() : null
  const actAsDate = urlDate || cookieDate

  // Ambil daftar guru hanya jika super admin
  const actAsUsers = isSuperAdmin ? await getActAsUserList() : []

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-24">
      <PageHeader
        title="Absensi Siswa"
        description="Absen siswa di kelas yang Anda ajar hari ini."
      />

      {/* Act As Banner — hanya untuk super admin */}
      {isSuperAdmin && (
        <Suspense fallback={null}>
          <ActAsBanner
            isActingAs={effective?.isActingAs || false}
            actAsName={effective?.actAsName || null}
            userList={actAsUsers}
            adminName={effective?.realUserName || 'Admin'}
            actAsDate={actAsDate}
            showDatePicker={true}
          />
        </Suspense>
      )}

      <Suspense fallback={<PageLoading text="Memuat jadwal mengajar..." />}>
        <AbsensiFetcher effectiveUserId={effectiveUserId} dateOverride={actAsDate ?? undefined} />
      </Suspense>
    </div>
  )
}
