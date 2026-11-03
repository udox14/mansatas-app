import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { checkFeatureAccess, checkFeatureCrudAccess } from '@/lib/features'
import { getKomitePaymentSettings } from '@/lib/komite-payment-settings'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { PengaturanKomiteClient } from './pengaturan-client'
import { CashflowCategoryManager } from './cashflow-category-manager'
import { getKomiteReportSettings } from '@/lib/komite-report-settings'
import { ReportSettingsCard } from './report-settings-card'
import { getDsptSettings } from '@/lib/dspt-settings'
import { DsptSettingsCard } from './dspt-settings-card'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pengaturan Komite | Keuangan MANSATAS' }

export default async function PengaturanKomitePage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-pengaturan')
  if (!allowed) redirect('/dashboard')

  const [settings, categories, canUpdateCategories, reportSettings, openingBalances, dsptSettings] = await Promise.all([
    getKomitePaymentSettings(),
    db.prepare('SELECT id,direction,name,sort_order,is_active,is_system FROM fin_cashflow_categories ORDER BY direction,sort_order,name').all<any>(),
    checkFeatureCrudAccess(db, session.user.id, 'keuangan-pengaturan', 'update'),
    getKomiteReportSettings(),
    db.prepare('SELECT period,amount,note FROM fin_monthly_opening_balances ORDER BY period DESC LIMIT 1').all<{ period: string; amount: number; note: string | null }>(),
    getDsptSettings(),
  ])

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Pengaturan Komite"
        description="Kelola rekening, kontak, dan QR code pembayaran yang tampil di Portal Orang Tua."
      />
      <PengaturanKomiteClient initialSettings={settings} canUpdate={canUpdateCategories} />
      <DsptSettingsCard initial={dsptSettings} />
      <ReportSettingsCard initialSettings={reportSettings} latestBalance={openingBalances.results?.[0]} />
      <CashflowCategoryManager canUpdate={canUpdateCategories} initialCategories={(categories.results ?? []).map(row => ({
        id: row.id, direction: row.direction, name: row.name, sortOrder: Number(row.sort_order || 0),
        isActive: row.is_active === 1, isSystem: row.is_system === 1,
      }))} />
    </div>
  )
}
