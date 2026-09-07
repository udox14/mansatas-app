// Lokasi: app/dashboard/settings/pramubakti/page.tsx
import { redirect } from 'next/navigation'
import { requirePbAccess } from '@/lib/pramubakti-db'
import { PageHeader } from '@/components/layout/page-header'
import { getPramubaktiSettings } from './actions'
import { PramubaktiSettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pengaturan Pramubakti - MANSATAS App' }

export default async function Page() {
  try {
    await requirePbAccess('settings')
  } catch {
    redirect('/dashboard')
  }

  const data = await getPramubaktiSettings()

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Pengaturan Pramubakti"
        description="Kelola jadwal wajib bersama, kalender libur kerja, daftar pilihan aktivitas, dan template CKH."
      />
      <PramubaktiSettingsClient initialData={data} />
    </div>
  )
}
