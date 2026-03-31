// Lokasi: app/dashboard/penerimaan-pt/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getInitialDataPenerimaanPT } from './actions'
import { PenerimaanPTClient } from './components/penerimaan-pt-client'
import { GraduationCap } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Penerimaan Perguruan Tinggi - MANSATAS App' }
export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'wali_kelas']

export default async function PenerimaanPTPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const role = (user as any).role ?? ''
  if (!ALLOWED_ROLES.includes(role)) redirect('/dashboard')

  const { taAktif } = await getInitialDataPenerimaanPT()

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Penerimaan Perguruan Tinggi"
        description="Data siswa kelas 12 yang diterima di perguruan tinggi per jalur seleksi."
        icon={GraduationCap}
        iconColor="text-indigo-500"
      />
      <PenerimaanPTClient
        taAktif={taAktif ?? null}
        userRole={role}
      />
    </div>
  )
}