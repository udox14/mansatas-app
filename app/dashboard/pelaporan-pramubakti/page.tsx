import { redirect } from 'next/navigation'
import { requirePbAccess } from '@/lib/pramubakti-db'
import { getPramubaktiReports } from './actions'
import { PramubaktiClient } from './pramubakti-client'
import { PageHeader } from '@/components/layout/page-header'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pelaporan Pramubakti - MANSATAS' }
export default async function Page() {
  try { await requirePbAccess('self') } catch { redirect('/dashboard') }
  const data = await getPramubaktiReports()
  return <div className="space-y-4 pb-20"><PageHeader title="Pelaporan Pramubakti" description="Laporkan pekerjaan harian dan dokumentasikan layanan lingkungan madrasah." /><PramubaktiClient initialData={data} /></div>
}
