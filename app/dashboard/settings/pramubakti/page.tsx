import { redirect } from 'next/navigation'
import { requirePbAccess } from '@/lib/pramubakti-db'
import { PageHeader } from '@/components/layout/page-header'
import { getPramubaktiSettings } from './actions'
import { PramubaktiSettingsClient } from './settings-client'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pengaturan Pramubakti - MANSATAS' }
export default async function Page() {
  try { await requirePbAccess('settings') } catch { redirect('/dashboard') }
  return <div className="space-y-4 pb-20"><PageHeader title="Pengaturan Pramubakti" description="Atur jadwal bersama, libur kerja, pilihan pekerjaan, dan template CKH." /><PramubaktiSettingsClient initialData={await getPramubaktiSettings()} /></div>
}
