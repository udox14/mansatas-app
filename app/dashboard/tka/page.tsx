// Lokasi: app/dashboard/tka/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getInitialDataTka } from './actions'
import { TkaClient } from './components/tka-client'
import { ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Tes Kemampuan Akademik - MANSATAS App' }
export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk']

export default async function TkaPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const role = (user as any).role ?? ''
  if (!ALLOWED_ROLES.includes(role)) redirect('/dashboard')

  const { tahunAjaranAktif, kelasList } = await getInitialDataTka()

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Tes Kemampuan Akademik"
        description="Pendataan mapel TKA, rencana setelah lulus, dan pilihan pendidikan siswa kelas 12."
        icon={ClipboardList}
        iconColor="text-sky-500"
      />
      <TkaClient
        tahunAjaranAktif={tahunAjaranAktif ?? null}
        kelasList={kelasList}
      />
    </div>
  )
}
