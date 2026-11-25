import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, FileCheck2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { checkFeatureAccess, checkFeatureCrudAccess } from '@/lib/features'
import { listKomiteFundOptions } from '@/lib/komite-funds'
import { getKomitePaymentSettings } from '@/lib/komite-payment-settings'
import { getKomiteReportSettings } from '@/lib/komite-report-settings'
import { getDsptSettings } from '@/lib/dspt-settings'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { PengaturanKomiteClient } from './pengaturan-client'
import { CashflowCategoryManager } from './cashflow-category-manager'
import { ReportSettingsCard } from './report-settings-card'
import { DsptSettingsCard } from './dspt-settings-card'
import { FundSettingsCard } from './fund-settings-card'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pengaturan Komite | Keuangan MANSATAS' }

export default async function PengaturanKomitePage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-pengaturan')
  if (!allowed) redirect('/dashboard')

  const [settings, categories, canUpdateCategories, reportSettings, openingBalances, dsptSettings, funds, overdrafts] = await Promise.all([
    getKomitePaymentSettings(),
    db.prepare('SELECT id,direction,name,sort_order,is_active,is_system FROM fin_cashflow_categories ORDER BY direction,sort_order,name').all<any>(),
    checkFeatureCrudAccess(db, session.user.id, 'keuangan-pengaturan', 'update'),
    getKomiteReportSettings(),
    db.prepare('SELECT period,amount,note FROM fin_monthly_opening_balances ORDER BY period DESC LIMIT 1').all<{ period: string; amount: number; note: string | null }>(),
    getDsptSettings(),
    listKomiteFundOptions(db),
    db.prepare('SELECT source,allow_negative FROM fin_komite_fund_settings').all<{ source: string; allow_negative: number }>(),
  ])

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-10">
      <PageHeader
        title="Pengaturan Komite"
        description="Kelola rekening & QRIS portal orang tua, target DSPT, sumber dana & kategori kas, serta format BKU."
      />

      <Tabs defaultValue="pembayaran" className="space-y-4">
        <TabsList className="h-auto max-w-full justify-start overflow-x-auto p-1">
          <TabsTrigger value="pembayaran" className="shrink-0 text-xs">Rekening & QRIS</TabsTrigger>
          <TabsTrigger value="dspt" className="shrink-0 text-xs">Target DSPT Baru</TabsTrigger>
          <TabsTrigger value="dana" className="shrink-0 text-xs">Sumber Dana & Kategori Kas</TabsTrigger>
          <TabsTrigger value="laporan" className="shrink-0 text-xs">Laporan BKU & Penandatangan</TabsTrigger>
        </TabsList>

        <TabsContent value="pembayaran" className="mt-0">
          <PengaturanKomiteClient initialSettings={settings} canUpdate={canUpdateCategories} />
        </TabsContent>

        <TabsContent value="dspt" className="mt-0">
          <DsptSettingsCard initial={dsptSettings} />
        </TabsContent>

        <TabsContent value="dana" className="mt-0 space-y-4">
          <FundSettingsCard years={funds.years} overdrafts={overdrafts.results} canUpdate={canUpdateCategories} />
          <CashflowCategoryManager
            canUpdate={canUpdateCategories}
            initialCategories={(categories.results ?? []).map(row => ({
              id: row.id,
              direction: row.direction,
              name: row.name,
              sortOrder: Number(row.sort_order || 0),
              isActive: row.is_active === 1,
              isSystem: row.is_system === 1,
            }))}
          />
        </TabsContent>

        <TabsContent value="laporan" className="mt-0 space-y-4">
          <ReportSettingsCard initialSettings={reportSettings} latestBalance={openingBalances.results?.[0]} />
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <FileCheck2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pengaturan Verifikator & Penandatangan SPB</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Pemilihan Verifikator aktif, Ketua penandatangan SPB, dan akses pengaju dikelola langsung pada modul Pengajuan & SPB.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 text-xs">
              <Link href="/dashboard/komite/pengajuan?tab=settings">
                Buka Pengaturan SPB <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
