// Lokasi: app/dashboard/monitoring-pramubakti/page.tsx
import { redirect } from 'next/navigation'
import { requirePbAccess } from '@/lib/pramubakti-db'
import { PageHeader } from '@/components/layout/page-header'
import { getPramubaktiMonitoring } from './actions'
import { PramubaktiMonitoringClient } from './monitoring-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Monitoring Pramubakti - MANSATAS App' }

export default async function Page() {
  try {
    await requirePbAccess('monitor')
  } catch {
    redirect('/dashboard')
  }

  const initialData = await getPramubaktiMonitoring()

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Monitoring Pramubakti"
        description="Pantau laporan pekerjaan, kelola status kehadiran & izin, serta cetak rekapitulasi kinerja."
      />
      <PramubaktiMonitoringClient initialData={initialData} />
    </div>
  )
}
