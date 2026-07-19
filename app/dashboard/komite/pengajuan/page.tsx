import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getKomiteDashboardData } from './actions'
import { PengajuanKomiteClient } from './pengajuan-komite-client'
import { PageHeader } from '@/components/layout/page-header'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pengajuan Dana Komite | MANSATAS' }

export default async function PengajuanKomitePage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  let data
  try {
    data = await getKomiteDashboardData()
  } catch {
    redirect('/dashboard')
  }
  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-10">
      <PageHeader title="Pengajuan Dana Komite" description="Pengajuan, review berjenjang, dan Surat Perintah Bayar dalam satu alur." />
      <PengajuanKomiteClient {...data} />
    </div>
  )
}
