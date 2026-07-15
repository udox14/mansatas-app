import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { todayWIB } from '@/lib/time'
import { getAgendaKelasOptions, getAgendaKelasSignatureSettings } from './actions'
import { AgendaKelasClient } from './components/agenda-kelas-client'

export const metadata = { title: 'Agenda Kelas - MANSATAS App' }
export const dynamic = 'force-dynamic'

async function AgendaKelasDataFetcher() {
  const [options, signatureSettings] = await Promise.all([
    getAgendaKelasOptions(),
    getAgendaKelasSignatureSettings(),
  ])
  return (
    <AgendaKelasClient
      daftarKelas={options.kelas}
      today={todayWIB()}
      initialSignatureSettings={signatureSettings.settings}
    />
  )
}

export default async function AgendaKelasPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'agenda-kelas')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Agenda Kelas"
        description="Periksa agenda harian kelas dan cetak agenda bulanan sesuai format resmi."
      />
      <Suspense fallback={<PageLoading text="Memuat daftar kelas..." />}>
        <AgendaKelasDataFetcher />
      </Suspense>
    </div>
  )
}
