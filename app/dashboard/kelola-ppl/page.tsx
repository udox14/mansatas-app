import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { checkFeatureAccess } from '@/lib/features'
import { getDB } from '@/utils/db'
import { getDaftarGuruPPLWithSummary, getDaftarGuruUtama } from './actions'
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

  const pplList = await getDaftarGuruPPLWithSummary()
  const guruUtamaList = await getDaftarGuruUtama()

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Manajemen Spesifik Guru PPL"
        description="Atur pendelegasian komponen tugas secara spesifik (jadwal atau piket) dari guru kepada PPL."
      />
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm mb-4 flex items-start gap-2">
        <Users className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
        <p>Silakan pilih Guru PPL di bawah, kemudian pilih Guru Utama yang digantikan. Setelah itu, PPL dapat mengakses modul KBM dan Nilai Harian sesuai jadwal yang dituju.</p>
      </div>

      <KelolaPplClient pplList={pplList} guruUtamaList={guruUtamaList} />
    </div>
  )
}
