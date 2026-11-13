import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { todayWIB } from '@/lib/time'
import { loadCutiGuru } from '../cuti-actions'
import { CutiGuruClient } from './cuti-guru-client'

export const dynamic = 'force-dynamic'

export default async function CutiGuruPage() {
  const result = await loadCutiGuru()
  if ('error' in result) redirect('/dashboard/monitoring-penugasan')
  return (
    <div className="space-y-4 pb-12">
      <Link className="text-sm text-primary underline" href="/dashboard/monitoring-penugasan">Kembali ke Monitoring Penugasan</Link>
      <PageHeader title="Cuti Guru" description="Atur periode cuti dan penugasan pengganti." />
      <CutiGuruClient people={result.people} periods={result.periods} today={todayWIB()} />
    </div>
  )
}
