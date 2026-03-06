// BUAT FILE BARU
// Lokasi: app/dashboard/settings/profile/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { UserCircle } from 'lucide-react'
import { ProfileClient } from './components/profile-client'

export const metadata = { title: 'Profil Saya - MANSATAS App' }

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-700 shadow-sm border border-emerald-200/50">
          <UserCircle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Profil Saya</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola informasi pribadi, foto profil, dan kata sandi akun Anda.
          </p>
        </div>
      </div>

      <ProfileClient profile={profile} email={user.email || ''} />
    </div>
  )
}