import { redirect } from 'next/navigation'
import { Activity } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { getActivityLogs, requireActivityLogAdmin, type ActivityLogFilters } from './actions'
import { LogAktivitasClient } from './log-aktivitas-client'

export const metadata = { title: 'Log Aktivitas - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function LogAktivitasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const ctx = await requireActivityLogAdmin()
  if (!ctx) redirect('/dashboard')

  const params = await searchParams
  const filters: ActivityLogFilters = {
    startDate: single(params.startDate),
    endDate: single(params.endDate),
    actor: single(params.actor),
    module: cleanSelect(single(params.module)),
    action: cleanSelect(single(params.action)),
    entityType: cleanSelect(single(params.entityType)),
    severity: cleanSelect(single(params.severity)),
    q: single(params.q),
    page: parseNumber(single(params.page), 1),
    pageSize: parseNumber(single(params.pageSize), 25),
  }

  const data = await getActivityLogs(filters)

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Log Aktivitas"
        description="Pantau tindakan kritis yang mengubah data master, akses, dan pengaturan sistem."
        icon={Activity}
      />
      <LogAktivitasClient
        logs={data.logs}
        total={data.total}
        modules={data.modules}
        actions={data.actions}
        entityTypes={data.entityTypes}
        filters={filters}
      />
    </div>
  )
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function cleanSelect(value?: string) {
  return value && value !== 'all' ? value : undefined
}

function parseNumber(value: string | undefined, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}
