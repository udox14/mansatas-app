// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/settings/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import { SettingsClient } from './components/settings-client'

export const metadata = { title: 'Pengaturan Global - MANSATAS App' }

export default async function SettingsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  
  if (profile?.role !== 'super_admin' && profile?.role !== 'admin_tu') {
    redirect('/dashboard') 
  }

  // Ambil data Tahun Ajaran (Daftar jurusan sekarang sudah menempel di sini)
  const { data: taData } = await supabase
    .from('tahun_ajaran')
    .select('*')
    .order('nama', { ascending: false })
    .order('semester', { ascending: false })

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center gap-3">
        <div className="bg-slate-800 p-3 rounded-2xl text-white shadow-sm border border-slate-700">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pengaturan Sistem</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola kalender akademik dan daftar jurusan/peminatan madrasah.
          </p>
        </div>
      </div>

      {/* Tidak perlu pass 'pengaturan' global lagi */}
      <SettingsClient taData={taData || []} />
    </div>
  )
}