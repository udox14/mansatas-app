import { redirect } from 'next/navigation'
import { resolveLegacyMonitoringTab } from '@/lib/kedisiplinan-tabs'

export const dynamic = 'force-dynamic'

export default async function LegacyMonitoringKedisiplinanPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>
}) {
  const params = searchParams ? await searchParams : undefined
  const tab = resolveLegacyMonitoringTab(params?.tab)
  redirect(`/dashboard/kedisiplinan?tab=${tab}`)
}
