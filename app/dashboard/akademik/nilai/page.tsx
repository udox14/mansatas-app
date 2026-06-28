// app/dashboard/akademik/nilai/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { NilaiPageTabs } from './components/nilai-page-tabs'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Rekap Nilai Akademik - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function RekapNilaiPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Rekap Nilai Akademik"
        description="Lihat rekap nilai semua siswa per kelas, atau import nilai rapor dari file Excel/RDM per semester."
      />
      <NilaiPageTabs />
    </div>
  )
}
