import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { getRppmPageData } from './actions'
import { RppmGeneratorClient } from './components/rppm-generator-client'

export const metadata = { title: 'RPPM Generator - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function RppmGeneratorPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'rppm-generator')
  if (!allowed) redirect('/dashboard')

  const data = await getRppmPageData()

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-16">
      <PageHeader
        title="RPPM Generator"
        description="Buat prompt AI, paste JSON, simpan draft, dan unduh RPPM KBC dalam format Word."
      />
      <RppmGeneratorClient initialDocuments={data.documents} mapelOptions={data.mapelOptions} user={data.user} kepsek={data.kepsek} />
    </div>
  )
}
