// Lokasi: app/dashboard/settings/profile/page.tsx
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { UserCircle } from 'lucide-react'
import { ProfileClient } from './components/profile-client'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Profil Saya - MANSATAS App' }

export const dynamic = 'force-dynamic'
export default async function ProfilePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // Query DB langsung untuk dapat data terbaru (termasuk avatar_url)
  const db = await getDB()
  const freshUser = await db.prepare(
    'SELECT id, name, nama_lengkap, role, avatar_url FROM "user" WHERE id = ?'
  ).bind(user.id).first<any>()

  const profile = {
    id: user.id,
    nama_lengkap: freshUser?.nama_lengkap ?? user.name ?? '',
    role: freshUser?.role ?? (user as any).role ?? '',
    avatar_url: freshUser?.avatar_url ?? null,
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader title="Profil Saya" description="Kelola informasi pribadi, foto profil, dan kata sandi." />
      <ProfileClient profile={profile} email={user.email ?? ''} />
    </div>
  )
}