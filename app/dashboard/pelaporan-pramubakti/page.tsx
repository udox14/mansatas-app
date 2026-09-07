// Lokasi: app/dashboard/pelaporan-pramubakti/page.tsx
import { redirect } from 'next/navigation'
import { requirePbAccess } from '@/lib/pramubakti-db'
import { getPramubaktiReports } from './actions'
import { PramubaktiClient } from './pramubakti-client'
import { PageHeader } from '@/components/layout/page-header'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pelaporan Pramubakti - MANSATAS App' }

export default async function Page() {
  try {
    await requirePbAccess('self')
  } catch {
    redirect('/dashboard')
  }

  const data = await getPramubaktiReports()

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Pelaporan Pramubakti"
        description="Pencatatan aktivitas pekerjaan dan presensi harian pramubakti."
      />
      <PramubaktiClient initialData={data} />
    </div>
  )
}
