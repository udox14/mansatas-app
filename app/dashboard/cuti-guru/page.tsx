import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { PageHeader } from '@/components/layout/page-header'
import { todayWIB } from '@/lib/time'
import { loadCutiGuru } from './actions'
import { CutiGuruClient } from './cuti-guru-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Cuti Guru - MANSATAS App' }

export default async function CutiGuruPage() {
  if (!(await getCurrentUser())) redirect('/login')
  const result = await loadCutiGuru()
  if ('error' in result) redirect('/dashboard')
  return (
    <div className="space-y-4 pb-12">
      <PageHeader title="Cuti Guru" description="Atur periode cuti dan penugasan pengganti." />
      <CutiGuruClient people={result.people} periods={result.periods} today={todayWIB()} />
    </div>
  )
}
