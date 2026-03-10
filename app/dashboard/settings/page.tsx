// Lokasi: app/dashboard/settings/page.tsx
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import { SettingsClient } from './components/settings-client'

export const metadata = { title: 'Pengaturan Global - MANSATAS App' }

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const role = (user as any).role ?? ''
  if (role !== 'super_admin' && role !== 'admin_tu') redirect('/dashboard')

  const db = await getDB()
  const taResult = await db.prepare('SELECT * FROM tahun_ajaran ORDER BY nama DESC, semester DESC').all<any>()

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center gap-3">
        <div className="bg-slate-800 p-3 rounded-2xl text-white shadow-sm border border-slate-700">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pengaturan Sistem</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola kalender akademik dan daftar jurusan/peminatan madrasah.</p>
        </div>
      </div>
      <SettingsClient taData={taResult.results || []} />
    </div>
  )
}