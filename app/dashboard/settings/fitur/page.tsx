// app/dashboard/settings/fitur/page.tsx
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { getRoleFeatureMatrix } from './actions'
import { FiturClient } from './fitur-client'

export const metadata = { title: 'Manajemen Fitur - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function FiturPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<any>()
  if (userRow?.role !== 'super_admin') redirect('/dashboard')

  const { matrix, roles } = await getRoleFeatureMatrix()

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Manajemen Fitur"
        description="Atur fitur mana saja yang bisa diakses oleh setiap role. Buat role baru sesuai kebutuhan."
      />
      <FiturClient initialMatrix={matrix} initialRoles={roles} />
    </div>
  )
}
