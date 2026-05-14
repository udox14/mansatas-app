import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { todayWIB } from '@/lib/time'
import { PageHeader } from '@/components/layout/page-header'
import { getCkhPageData } from './actions'
import { CkhGeneratorClient } from './components/ckh-generator-client'

export const metadata = { title: 'CKH Generator - MANSATAS App' }
export const dynamic = 'force-dynamic'

function parsePeriod(params: { year?: string; month?: string }, today: string) {
  const fallback = {
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }
  const year = Number(params.year)
  const month = Number(params.month)

  return {
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : fallback.year,
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : fallback.month,
  }
}

export default async function CkhGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'ckh-generator')
  if (!allowed) redirect('/dashboard')

  const params = await searchParams
  const today = todayWIB()
  const { year, month } = parsePeriod(params, today)
  const data = await getCkhPageData(year, month)
  const roles = await getUserRoles(db, user.id)
  const canManageTemplates = roles.includes('super_admin') || roles.includes('admin_tu')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-16">
      <PageHeader
        title="CKH Generator"
        description="Buat, edit, sinkronkan agenda, dan cetak Capaian Kinerja Harian bulanan."
      />
      <CkhGeneratorClient initialData={data} year={year} month={month} canManageTemplates={canManageTemplates} />
    </div>
  )
}
