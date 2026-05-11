import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { todayWIB } from '@/lib/time'
import { getKalenderPendidikanData } from './actions'
import { KalenderPendidikanClient } from './components/kalender-client'

export const metadata = { title: 'Kalender Pendidikan - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function KalenderPendidikanPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'kalender-pendidikan')
  if (!allowed) redirect('/dashboard')

  const params = await searchParams
  const today = todayWIB()
  const fallbackYear = Number(today.slice(0, 4))
  const fallbackMonth = Number(today.slice(5, 7))
  const year = Number(params.year) || fallbackYear
  const month = Number(params.month) || fallbackMonth
  const data = await getKalenderPendidikanData(year, month)

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-16">
      <PageHeader
        title="Kalender Pendidikan"
        description="Atur hari efektif, libur, rapat, ujian, dan tanggal merah yang memengaruhi absensi serta agenda pembelajaran."
      />
      <KalenderPendidikanClient initialData={data} />
    </div>
  )
}
