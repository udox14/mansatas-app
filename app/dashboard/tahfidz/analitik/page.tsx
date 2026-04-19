import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getKelasTahfidz } from '../actions'
import { AnalitikClient } from '../components/AnalitikClient'

export const dynamic = 'force-dynamic'

export default async function TahfidzAnalitikPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const kelasList = await getKelasTahfidz()

  return <AnalitikClient kelasList={kelasList} />
}
