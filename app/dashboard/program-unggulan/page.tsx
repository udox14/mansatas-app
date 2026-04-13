// Lokasi: app/dashboard/program-unggulan/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { Star } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'
import { TesClient } from './components/tes-client'
import { getKelasUnggulanGuru } from './actions'
import { getEffectiveUser, getActAsUserList, getActAsDate } from '@/lib/act-as'
import { ActAsBanner } from '@/components/layout/act-as-banner'

export const metadata = { title: 'Program Unggulan - MANSATAS App' }
export const dynamic = 'force-dynamic'

async function DataFetcher({ effectiveUserId, namaLengkap, dateOverride }: { effectiveUserId: string; namaLengkap: string; dateOverride?: string | null }) {
  const { data, error } = await getKelasUnggulanGuru(effectiveUserId, dateOverride || undefined)
  if (error) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p className="text-sm">{error}</p>
      </div>
    )
  }
  return <TesClient kelasList={data} currentUser={{ id: effectiveUserId, nama_lengkap: namaLengkap }} />
}

export default async function ProgramUnggulanPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'program-unggulan')
  if (!allowed) redirect('/dashboard')

  // Check super admin untuk fitur Act As
  const userRoles = await getUserRoles(db, user.id)
  const isSuperAdmin = userRoles.includes('super_admin')

  const effective = await getEffectiveUser()
  const effectiveUserId = effective?.effectiveUserId || user.id

  // Ambil daftar guru hanya jika super admin
  const actAsUsers = isSuperAdmin ? await getActAsUserList() : []

  // Ambil tanggal override jika sedang Act As
  const urlDate = params?.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null
  const cookieDate = (isSuperAdmin && effective?.isActingAs) ? await getActAsDate() : null
  const actAsDate = urlDate || cookieDate

  // Nama yang tampil: jika act-as, pakai nama guru target
  const namaLengkap = effective?.isActingAs
    ? (effective.actAsName ?? '')
    : ((user as any).nama_lengkap ?? user.name ?? '')

  // Admin diarahkan ke panel kelola KECUALI jika sedang act-as
  if (!effective?.isActingAs && userRoles.some(r => ['super_admin', 'admin_tu', 'kepsek'].includes(r))) {
    // Admin bisa juga akses halaman tes, tapi redirect default ke kelola
    // Uncomment baris di bawah jika ingin redirect otomatis:
    // redirect('/dashboard/program-unggulan/kelola')
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12 max-w-lg mx-auto">
      <PageHeader
        title="Program Unggulan"
        description="Pengetesan siswa kelas unggulan"
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

      <Suspense fallback={<PageLoading text="Memuat program unggulan..." />}>
        <DataFetcher effectiveUserId={effectiveUserId} namaLengkap={namaLengkap} dateOverride={actAsDate} />
      </Suspense>
    </div>
  )
}
