import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { AuditAksesAgendaClient } from './audit-akses-agenda-client'
import { getAgendaAuditData, type AuditAccessFilters } from './actions'

export const metadata = { title: 'Audit Akses Agenda - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function AuditAksesAgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const filters: AuditAccessFilters = {
    startDate: single(params.startDate) || '2026-09-01',
    endDate: single(params.endDate),
    riskLevel: cleanSelect(single(params.riskLevel)),
    teacher: single(params.teacher),
    page: positiveNumber(single(params.page), 1),
    pageSize: positiveNumber(single(params.pageSize), 25),
  }
  const data = await getAgendaAuditData(filters)
  if (data.error) redirect('/dashboard')
  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Audit Akses Agenda"
        description="Indikator pergantian akun pada perangkat yang sama. Skor merupakan bahan pemeriksaan, bukan vonis otomatis."
        icon={ShieldAlert}
      />
      <AuditAksesAgendaClient {...data} filters={filters} />
    </div>
  )
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function cleanSelect(value?: string) {
  return value && value !== 'all' ? value : undefined
}

function positiveNumber(value: string | undefined, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}
