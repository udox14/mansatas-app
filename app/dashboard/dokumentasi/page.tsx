import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getUserRoles } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { DokumentasiClient } from './dokumentasi-client'

export const metadata = { title: 'Denah Aplikasi & Panduan - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function DokumentasiPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const roles = await getUserRoles(db, user.id)
  const isSuperAdmin = roles.includes('super_admin') || (user as any).role === 'super_admin'

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Denah Aplikasi & Panduan"
        description="Peta arsitektur modul, matriks hak akses peran, dan alur proses kerja operasional MANSATAS."
      />
      <DokumentasiClient
        userRoles={roles}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  )
}
