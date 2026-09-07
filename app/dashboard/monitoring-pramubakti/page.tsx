import { redirect } from 'next/navigation'
import { requirePbAccess } from '@/lib/pramubakti-db'
import { PageHeader } from '@/components/layout/page-header'
import { getPramubaktiMonitoring } from './actions'
import { PramubaktiMonitoringClient } from './monitoring-client'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Monitoring Pramubakti - MANSATAS' }
export default async function Page() {
  try { await requirePbAccess('monitor') } catch { redirect('/dashboard') }
  return <div className="space-y-4 pb-20"><PageHeader title="Monitoring Pramubakti" description="Pantau laporan, kelola izin dan sakit, serta cetak rekap pekerjaan." /><PramubaktiMonitoringClient initialData={await getPramubaktiMonitoring()} /></div>
}
