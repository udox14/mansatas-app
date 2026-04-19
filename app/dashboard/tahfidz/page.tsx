import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getKelasTahfidz } from './actions'
import { TahfidzClient } from './components/TahfidzClient'

export const dynamic = 'force-dynamic'

export default async function TahfidzPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const kelasList = await getKelasTahfidz()

  return <TahfidzClient kelasList={kelasList} />
}
