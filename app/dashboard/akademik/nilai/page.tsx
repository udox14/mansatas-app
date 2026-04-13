// app/dashboard/akademik/nilai/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getRingkasanImport } from './actions'
import { NilaiClient } from './components/nilai-client'
import { PageHeader } from '@/components/layout/page-header'
import { FileSpreadsheet } from 'lucide-react'

export const metadata = { title: 'Rekap Nilai Akademik - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function RekapNilaiPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const ringkasan = await getRingkasanImport()

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Rekap Nilai Akademik"
        description="Import nilai rapor dari file Excel/RDM per semester. Data otomatis tersinkron ke halaman detail siswa."
      />
      <NilaiClient ringkasan={ringkasan} />
    </div>
  )
}
