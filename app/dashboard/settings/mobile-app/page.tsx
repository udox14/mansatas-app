import { PageHeader } from '@/components/layout/page-header'
import { checkFeatureAccess } from '@/lib/features'
import { getDB } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { MobileAppSettingsClient } from './mobile-app-settings-client'

export const metadata = { title: 'Mobile App - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function MobileAppSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'settings-mobile-app')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Mobile App"
        description="Pusat kontrol fitur native APK MANSATAS: permission, kamera, notifikasi, gesture, dan diagnosa perangkat."
      />
      <MobileAppSettingsClient />
    </div>
  )
}
