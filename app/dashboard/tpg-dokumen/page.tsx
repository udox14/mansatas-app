import { redirect } from 'next/navigation'
import { FileArchive } from 'lucide-react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { todayWIB } from '@/lib/time'
import { previousMonthPeriod } from '@/lib/tpg'
import { PageHeader } from '@/components/layout/page-header'
import { getTpgDokumenData } from './actions'
import { TpgDokumenClient } from './tpg-dokumen-client'

export const metadata = { title: 'Dokumen TPG - MANSATAS App' }
export const dynamic = 'force-dynamic'

function parsePeriod(params: { s36Year?: string; s36Month?: string; ckhYear?: string; ckhMonth?: string }) {
  const [todayYear, todayMonth, todayDay] = todayWIB().split('-').map(Number)
  const previous = previousMonthPeriod(new Date(todayYear, todayMonth - 1, todayDay))
  const current = { year: todayYear, month: todayMonth }
  const s36Year = Number(params.s36Year)
  const s36Month = Number(params.s36Month)
  const ckhYear = Number(params.ckhYear)
  const ckhMonth = Number(params.ckhMonth)

  return {
    s36Year: Number.isInteger(s36Year) && s36Year >= 2020 && s36Year <= 2100 ? s36Year : previous.year,
    s36Month: Number.isInteger(s36Month) && s36Month >= 1 && s36Month <= 12 ? s36Month : previous.month,
    ckhYear: Number.isInteger(ckhYear) && ckhYear >= 2020 && ckhYear <= 2100 ? ckhYear : current.year,
    ckhMonth: Number.isInteger(ckhMonth) && ckhMonth >= 1 && ckhMonth <= 12 ? ckhMonth : current.month,
  }
}

export default async function TpgDokumenPage({
  searchParams,
}: {
  searchParams: Promise<{ s36Year?: string; s36Month?: string; ckhYear?: string; ckhMonth?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'tpg-dokumen')
  if (!allowed) redirect('/dashboard')

  const params = await searchParams
  const period = parsePeriod(params)
  const data = await getTpgDokumenData(period.s36Year, period.s36Month, period.ckhYear, period.ckhMonth)

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-16">
      <PageHeader
        title="Dokumen TPG"
        description="Upload S36 bulanan dan siapkan CKH yang sudah dikirim untuk TU."
        icon={FileArchive}
      />
      <TpgDokumenClient initialData={data} />
    </div>
  )
}
