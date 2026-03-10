// Lokasi: app/dashboard/settings/profile/page.tsx
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { UserCircle } from 'lucide-react'
import { ProfileClient } from './components/profile-client'

export const metadata = { title: 'Profil Saya - MANSATAS App' }

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
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-700 shadow-sm border border-emerald-200/50">
          <UserCircle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Profil Saya</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola informasi pribadi, foto profil, dan kata sandi akun Anda.</p>
        </div>
      </div>
      <ProfileClient profile={profile} email={user.email ?? ''} />
    </div>
  )
}