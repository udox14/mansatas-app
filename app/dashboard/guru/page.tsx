// Lokasi: app/dashboard/guru/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { GuruClient } from './components/guru-client'
import { GraduationCap } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'
import { checkFeatureAccess } from '@/lib/features'

export const metadata = { title: 'Data Guru & Pegawai - MANSATAS App' }

async function GuruDataFetcher() {
  const db = await getDB()

  const [usersResult, jabatanResult, userRolesResult, masterRolesResult] = await Promise.all([
    db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.nama_lengkap, u.avatar_url,
      FROM "user" u
      ORDER BY u.nama_lengkap ASC
    `).all<any>(),
    db.prepare(`    `).all<any>(),
    db.prepare(`
      SELECT user_id, role FROM user_roles ORDER BY user_id
    `).all<{ user_id: string; role: string }>(),
    db.prepare(`
      SELECT value, label, is_custom FROM master_roles ORDER BY is_custom ASC, label ASC
    `).all<{ value: string; label: string; is_custom: number }>(),
  ])

  // Build user_roles map
  const userRolesMap: Record<string, string[]> = {}
  for (const row of userRolesResult.results || []) {
    if (!userRolesMap[row.user_id]) userRolesMap[row.user_id] = []
    userRolesMap[row.user_id].push(row.role)
  }

  const mergedData = (usersResult.results || []).map((u: any) => ({
    id: u.id,
    nama_lengkap: u.nama_lengkap || u.name || '',
    role: u.role || '',
    avatar_url: u.avatar_url || null,
    roles: userRolesMap[u.id] || (u.role ? [u.role] : []),
    email: u.email || 'Email tidak ditemukan',
    domisili_pegawai: u.domisili_pegawai || null,
  }))

  return (
    <GuruClient
      initialData={mergedData}
      masterJabatan={jabatanResult.results || []}
      masterRoles={masterRolesResult.results || []}
    />
  )
}

export const dynamic = 'force-dynamic'
export default async function GuruPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'guru')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader title="Guru & Pegawai" description="Kelola data pendidik, hak akses, jabatan struktural, dan domisili." />
      <Suspense fallback={
<PageLoading text="Memuat data kepegawaian..." />
      }>
        <GuruDataFetcher />
      </Suspense>
    </div>
  )
}