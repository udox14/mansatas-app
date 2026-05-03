import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard Keuangan | MANSATAS' }

export default async function KeuanganDashboardPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  redirect('/dashboard')
}
