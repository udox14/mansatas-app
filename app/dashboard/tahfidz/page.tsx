import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { getKelasTahfidz } from './actions'
import { TahfidzClient } from './components/TahfidzClient'

export const dynamic = 'force-dynamic'

export default async function TahfidzPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const kelasList = await getKelasTahfidz()

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Tahfidz Al-Qur'an"
        description="Kelola dan pantau progress hafalan Al-Qur'an santri."
      />
      <TahfidzClient kelasList={kelasList} />
    </div>
  )
}
