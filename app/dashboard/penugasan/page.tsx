// Lokasi: app/dashboard/penugasan/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db-server'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { Send } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'
import { PenugasanClient } from './components/penugasan-client'
import { getJadwalUntukDelegasi, getDaftarUser, getTugasMasuk, getDelegasiTerkirim, hasJadwalPiketHariIni } from './actions'
import { todayWIB } from '@/lib/time'

export const metadata = { title: 'Penugasan - MANSATAS App' }

export const dynamic = 'force-dynamic'

async function PenugasanDataFetcher({ canExecutePiket }: { canExecutePiket: boolean }) {
  const tanggal = todayWIB()
  const [jadwal, users, tugasMasuk, terkirim] = await Promise.all([
    getJadwalUntukDelegasi(tanggal),
    getDaftarUser(tanggal),
    getTugasMasuk(tanggal),
    getDelegasiTerkirim(tanggal),
  ])

  return (
    <PenugasanClient
      initialJadwal={jadwal}
      initialUsers={users}
      initialTugasMasuk={tugasMasuk}
      initialTerkirim={terkirim}
      isGuruPiket={canExecutePiket}
      tanggalHariIni={tanggal}
    />
  )
}

export default async function PenugasanPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'penugasan')
  if (!allowed) redirect('/dashboard')

  const [allRoles, canExecutePiketFromSchedule] = await Promise.all([
    getUserRoles(db, user.id),
    hasJadwalPiketHariIni(todayWIB()),
  ])
  const canExecutePiket = allRoles.includes('guru_piket') || canExecutePiketFromSchedule

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Penugasan"
        description="Titipkan tugas mengajar dan absensi ke guru lain."
      />

      <Suspense fallback={<PageLoading text="Memuat data penugasan..." />}>
        <PenugasanDataFetcher canExecutePiket={canExecutePiket} />
      </Suspense>
    </div>
  )
}

