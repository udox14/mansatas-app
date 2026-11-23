import { redirect } from 'next/navigation'
import { UserCheck } from 'lucide-react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { checkFeatureCrudAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import {
  type ParentLoginActivityFilter,
  type ParentLoginFilters,
  type ParentLoginSort,
  type ParentLoginStatusFilter,
} from '@/lib/parent-login-tracking'
import { getParentLoginMonitoringData } from './actions'
import { MonitoringLoginOrtuClient } from './monitoring-login-ortu-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Monitoring Login Ortu - MANSATAS App' }

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function parseStatus(value: string): ParentLoginStatusFilter {
  if (value === 'sudah' || value === 'belum') return value
  return 'all'
}

function parseAktivitas(value: string): ParentLoginActivityFilter {
  if (value === '7d' || value === '30d' || value === 'inactive_30d') return value
  return 'all'
}

function parseSort(value: string): ParentLoginSort {
  if (value === 'last_login_desc' || value === 'last_seen_desc' || value === 'belum_dulu') {
    return value
  }
  return 'nama_asc'
}

function parsePageSize(value: string): number | 'semua' {
  if (value === 'semua') return 'semua'
  const num = Number(value)
  return Number.isInteger(num) && num >= 10 && num <= 200 ? num : 25
}

function parsePositiveInt(value: string, fallback: number): number {
  const num = Number(value)
  return Number.isInteger(num) && num > 0 ? num : fallback
}

export default async function MonitoringLoginOrtuPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureCrudAccess(db, user.id, 'monitoring-login-ortu', 'read')
  if (!allowed) redirect('/dashboard')

  const params = await searchParams
  const activeTab = single(params.tab) === 'kelas' ? 'kelas' : 'siswa'
  const rawTingkat = single(params.tingkat).trim()
  const rawKelasId = single(params.kelasId).trim()

  const filters: ParentLoginFilters = {
    status: parseStatus(single(params.status)),
    tingkat: rawTingkat && rawTingkat !== 'all' ? rawTingkat : undefined,
    kelasId: rawKelasId && rawKelasId !== 'all' ? rawKelasId : undefined,
    aktivitas: parseAktivitas(single(params.aktivitas)),
    q: single(params.q).trim() || undefined,
    sort: parseSort(single(params.sort)),
    page: parsePositiveInt(single(params.page), 1),
    pageSize: parsePageSize(single(params.pageSize)),
  }

  const data = await getParentLoginMonitoringData(filters)

  return (
    <div className="space-y-4 pb-12">
      <PageHeader
        title="Monitoring Login Ortu"
        description="Pantau status login, terakhir login, dan aktivitas orang tua di Portal Orang Tua per siswa maupun per kelas."
        icon={UserCheck}
      />
      <MonitoringLoginOrtuClient
        summary={data.summary}
        rows={data.rows}
        total={data.total}
        classRecaps={data.classRecaps}
        filterOptions={data.filterOptions}
        scopeMode={data.scopeMode}
        filters={filters}
        activeTab={activeTab}
      />
    </div>
  )
}
