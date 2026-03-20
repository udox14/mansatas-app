// Lokasi: app/dashboard/settings/page.tsx
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import { SettingsClient } from './components/settings-client'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Pengaturan Global - MANSATAS App' }

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const role = (user as any).role ?? ''
  if (!['super_admin', 'kepsek', 'admin_tu'].includes(role)) redirect('/dashboard')

  const db = await getDB()
  const taResult = await db.prepare('SELECT * FROM tahun_ajaran ORDER BY nama DESC, semester DESC').all<any>()

  // Parse daftar_jurusan dari string JSON ke array
  const taData = (taResult.results || []).map((ta: any) => ({
    ...ta,
    daftar_jurusan: (() => {
      try { return JSON.parse(ta.daftar_jurusan || '[]') } catch { return ['MIPA','SOSHUM','KEAGAMAAN','UMUM'] }
    })()
  }))

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader title="Pengaturan Sistem" description="Kelola kalender akademik dan daftar jurusan/peminatan madrasah." icon={Settings} iconColor="text-slate-500 dark:text-slate-400 dark:text-slate-500" />
      <SettingsClient taData={taData} />
    </div>
  )
}