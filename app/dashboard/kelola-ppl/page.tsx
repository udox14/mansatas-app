import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { checkFeatureAccess } from '@/lib/features'
import { getDB } from '@/utils/db-server'
import { getDaftarGuruPPLWithSummary, getPplCampuses } from './actions'
import { KelolaPplClient } from './components/KelolaPplClient'
import { Users } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Kelola PPL - MANSATAS App' }

export default async function KelolaPPLPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // Pastikan user punya akses Administrator (role super_admin, kepsek, wakamad)
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'kelola-ppl') // Feature is optional, but menu.ts restricts it
  if (!allowed) redirect('/dashboard')

  const [pplList, campuses] = await Promise.all([
    getDaftarGuruPPLWithSummary(),
    getPplCampuses(),
  ])

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Kelola PPL"
        description="Atur kampus, delegasi mapel–kelas, dan pantau kehadiran PPL dalam satu workspace."
      />
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm mb-4 flex items-start gap-2">
        <Users className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
        <p>Silakan pilih Guru PPL dan Guru Utama yang digantikan. PPL kemudian dapat mengisi agenda, absensi siswa, catatan siswa, dan nilai untuk mapel–kelas yang dipilih; seluruh data resmi tetap atas nama Guru Utama.</p>
      </div>

      <KelolaPplClient pplList={pplList} campuses={campuses} />
    </div>
  )
}
