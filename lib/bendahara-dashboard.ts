import { isKomiteFundScope } from '@/lib/komite-funds'
import { getKomiteFinancialReport, isValidReportPeriod, reportPeriodLabel } from '@/lib/komite-financial-report'
import type { KomiteLedgerRow, KomiteFinancialReport } from '@/lib/komite-financial-report'
import { todayWIB } from '@/lib/time'
import { getOrSetFinanceCache } from '@/lib/finance-cache'

export type DashboardSection<T> =
  | { status: 'ready'; data: T }
  | { status: 'unavailable'; data: null }

export type CollectionSummary = {
  totalAccounts: number
  target: number
  paid: number
  discount: number
  remaining: number
  paidPercent: number
  settled: number
  partial: number
  unpaid: number
}

export type LegacyArrearsSummary = {
  totalAccounts: number
  target: number
  paid: number
  remaining: number
  paidPercent: number
}

export type QueueSummary = {
  count: number
  amount: number
  oldestAt: string | null
}

export type CashPosition = Pick<KomiteFinancialReport,
  'period' | 'periodLabel' | 'openingBalance' | 'totalIncome' | 'totalExpense' | 'endingBalance'> & {
    recentRows: KomiteLedgerRow[]
  }

export type BendaharaDashboardData = {
  period: string
  periodLabel: string
  cashPosition: DashboardSection<CashPosition> | null
  dspt: DashboardSection<CollectionSummary> | null
  legacySpp: DashboardSection<LegacyArrearsSummary> | null
  inactiveArrears: DashboardSection<LegacyArrearsSummary> | null
  paymentQueue: DashboardSection<QueueSummary> | null
  approvalQueue: DashboardSection<QueueSummary> | null
  releaseQueue: DashboardSection<QueueSummary> | null
}

export const DSPT_COLLECTION_SQL = `
  SELECT
    COUNT(d.id) AS total_accounts,
    COALESCE(SUM(d.nominal_target), 0) AS target,
    COALESCE(SUM(d.total_dibayar), 0) AS paid,
    COALESCE(SUM(d.total_diskon), 0) AS discount,
    COALESCE(SUM(MAX(d.nominal_target - d.total_dibayar - d.total_diskon, 0)), 0) AS remaining,
    SUM(CASE WHEN d.status = 'lunas' THEN 1 ELSE 0 END) AS settled,
    SUM(CASE WHEN d.status = 'nyicil' THEN 1 ELSE 0 END) AS partial,
    SUM(CASE WHEN d.status = 'belum_bayar' THEN 1 ELSE 0 END) AS unpaid
  FROM fin_dspt d
  JOIN siswa s ON s.id = d.siswa_id
  WHERE s.status = 'aktif'
`

export const LEGACY_SPP_SQL = `
  SELECT
    COUNT(sp.id) AS total_accounts,
    COALESCE(SUM(sp.jumlah), 0) AS target,
    COALESCE(SUM(sp.total_dibayar), 0) AS paid,
    COALESCE(SUM(MAX(sp.jumlah - sp.total_dibayar, 0)), 0) AS remaining
  FROM fin_spp_saldo_awal sp
  JOIN siswa s ON s.id = sp.siswa_id
  WHERE s.status = 'aktif'
`

export const INACTIVE_ARREARS_SQL = `
  SELECT
    COUNT(*) AS total_accounts,
    COALESCE(SUM(target), 0) AS target,
    COALESCE(SUM(paid), 0) AS paid,
    COALESCE(SUM(remaining), 0) AS remaining
  FROM (
    SELECT d.nominal_target AS target, d.total_dibayar AS paid,
      MAX(d.nominal_target - d.total_dibayar - d.total_diskon, 0) AS remaining, s.tahun_masuk
    FROM fin_dspt d JOIN siswa s ON s.id = d.siswa_id
    WHERE s.status <> 'aktif' AND s.status <> 'dihapus'
    UNION ALL
    SELECT sp.jumlah, sp.total_dibayar, MAX(sp.jumlah - sp.total_dibayar, 0), s.tahun_masuk
    FROM fin_spp_saldo_awal sp JOIN siswa s ON s.id = sp.siswa_id
    WHERE s.status <> 'aktif' AND s.status <> 'dihapus'
  ) arrears
  WHERE remaining > 0
`

export const PAYMENT_QUEUE_SQL = `
  SELECT COUNT(*) AS count, COALESCE(SUM(p.jumlah), 0) AS amount,
    MIN(COALESCE(p.bukti_uploaded_at, p.created_at)) AS oldest_at
  FROM fin_payment_submissions p
  JOIN siswa s ON s.id = p.siswa_id AND s.status = 'aktif'
  JOIN fin_dspt d ON d.id = p.dspt_id
  WHERE p.kategori = 'dspt' AND p.status = 'menunggu_konfirmasi'
`

export const APPROVAL_QUEUE_SQL = `
  SELECT COUNT(*) AS count, COALESCE(SUM(nominal), 0) AS amount, MIN(submitted_at) AS oldest_at
  FROM komite_pengajuan
  WHERE status = 'menunggu_bendahara' AND pengaju_id <> ?
`

export const RELEASE_QUEUE_SQL = `
  SELECT COUNT(*) AS count, COALESCE(SUM(nominal), 0) AS amount, MIN(approved_at) AS oldest_at
  FROM komite_pengajuan
  WHERE status = 'disetujui' AND realisasi_status = 'belum' AND komite_cancelled_at IS NULL
`

function number(value: unknown) {
  return Number(value || 0)
}

export function resolveDashboardPeriod(value?: string | null, fallbackDate = todayWIB()) {
  const fallback = fallbackDate.slice(0, 7)
  return value && isValidReportPeriod(value) ? value : fallback
}

export function canAccessFinanceFeature(allowedFeatures: string[], featureId: string) {
  if (allowedFeatures.includes(featureId)) return true
  if (featureId === 'keuangan-transaksi') return allowedFeatures.includes('keuangan-laporan')
  if (featureId === 'keuangan-export' || featureId === 'keuangan-dspt-nonaktif') {
    return allowedFeatures.includes('keuangan-dspt')
  }
  return false
}

export async function settleDashboardSection<T>(label: string, promise: Promise<T>): Promise<DashboardSection<T>> {
  try {
    return { status: 'ready', data: await promise }
  } catch (error) {
    console.error(`[dashboard-bendahara] ${label} tidak tersedia`, error)
    return { status: 'unavailable', data: null }
  }
}

function toCollection(row: any): CollectionSummary {
  const target = number(row?.target)
  const paid = number(row?.paid)
  return {
    totalAccounts: number(row?.total_accounts),
    target,
    paid,
    discount: number(row?.discount),
    remaining: number(row?.remaining),
    paidPercent: target > 0 ? Math.min(100, Math.round((paid / target) * 100)) : 0,
    settled: number(row?.settled),
    partial: number(row?.partial),
    unpaid: number(row?.unpaid),
  }
}

function toArrears(row: any): LegacyArrearsSummary {
  const target = number(row?.target)
  const paid = number(row?.paid)
  return {
    totalAccounts: number(row?.total_accounts),
    target,
    paid,
    remaining: number(row?.remaining),
    paidPercent: target > 0 ? Math.min(100, Math.round((paid / target) * 100)) : 0,
  }
}

function toQueue(row: any): QueueSummary {
  return { count: number(row?.count), amount: number(row?.amount), oldestAt: row?.oldest_at || null }
}

export async function loadBendaharaCashPosition(db: D1Database, period: string, fund?:string): Promise<CashPosition> {
  const report = await getKomiteFinancialReport(db, {
    period,
    scope: 'all', fund,
    openingBalance: { mode: 'cumulative' },
    signatures: { enabled: false },
  }, {
    openingBalanceMode: 'cumulative',
    proofNumberMode: 'source_first',
    signaturesEnabled: false,
    treasurerName: '', chairmanName: '', principalName: '',
  })
  return {
    period: report.period,
    periodLabel: report.periodLabel,
    openingBalance: report.openingBalance,
    totalIncome: report.totalIncome,
    totalExpense: report.totalExpense,
    endingBalance: report.endingBalance,
    recentRows: report.rows.slice(-6).reverse(),
  }
}

export async function loadBendaharaDashboardData(input: {
  db: D1Database
  userId: string
  period?: string | null
  fund?: string
  allowedFeatures: string[]
}): Promise<BendaharaDashboardData> {
  const { db, userId, allowedFeatures } = input
  const period = resolveDashboardPeriod(input.period)
  const fund = isKomiteFundScope(input.fund) && input.fund!=='all' ? input.fund : undefined
  const cohort = fund==='unmapped' ? ' AND s.tahun_masuk IS NULL' : fund==='general' ? ' AND 0' : fund ? ' AND s.tahun_masuk=?' : ''
  const withCohort = (sql:string) => {
    const stmt=db.prepare(sql)
    return fund && /^\d{4}$/.test(fund) ? stmt.bind(Number(fund)) : stmt
  }
  const cacheKey = `dashboard:${userId}:${period}:${fund??'all'}:${[...allowedFeatures].sort().join(',')}`
  return getOrSetFinanceCache(cacheKey, async () => {
  const allowed = (featureId: string) => canAccessFinanceFeature(allowedFeatures, featureId)

  const cashPromise = allowed('keuangan-laporan')
    ? settleDashboardSection('posisi kas', loadBendaharaCashPosition(db, period,fund))
    : Promise.resolve(null)
  const dsptPromise = allowed('keuangan-dspt')
    ? settleDashboardSection('ringkasan DSPT', withCohort(DSPT_COLLECTION_SQL+cohort).first<any>().then(toCollection))
    : Promise.resolve(null)
  const sppPromise = allowed('keuangan-dspt')
    ? settleDashboardSection('tunggakan SPP', withCohort(LEGACY_SPP_SQL+cohort).first<any>().then(toArrears))
    : Promise.resolve(null)
  const inactivePromise = allowed('keuangan-dspt')
    ? settleDashboardSection('tunggakan nonaktif', withCohort(INACTIVE_ARREARS_SQL+cohort.replace('s.tahun_masuk','arrears.tahun_masuk')).first<any>().then(toArrears))
    : Promise.resolve(null)
  const paymentPromise = allowed('keuangan-dspt')
    ? settleDashboardSection('antrean bukti pembayaran', withCohort(PAYMENT_QUEUE_SQL+cohort).first<any>().then(toQueue))
    : Promise.resolve(null)
  const approvalSql=fund && fund!=='unmapped' ? APPROVAL_QUEUE_SQL+' AND 0' : APPROVAL_QUEUE_SQL
  const approvalPromise = allowed('komite-pengajuan')
    ? settleDashboardSection('antrean persetujuan', db.prepare(approvalSql).bind(userId).first<any>().then(toQueue))
    : Promise.resolve(null)
  const releaseSql=fund==='unmapped' ? RELEASE_QUEUE_SQL+` AND NOT EXISTS (
    SELECT 1 FROM fin_komite_allocations a WHERE a.pengajuan_id=komite_pengajuan.id AND a.state='locked'
  )` : fund ? `SELECT COUNT(*) count,COALESCE(SUM(a.amount),0) amount,MIN(p.approved_at) oldest_at
    FROM komite_pengajuan p JOIN (SELECT pengajuan_id,SUM(amount) amount FROM fin_komite_allocations WHERE state='locked' AND source=? GROUP BY pengajuan_id) a ON a.pengajuan_id=p.id
    WHERE p.status='disetujui' AND p.realisasi_status='belum' AND p.komite_cancelled_at IS NULL` : RELEASE_QUEUE_SQL
  const releasePromise = allowed('komite-pengajuan')
    ? settleDashboardSection('antrean pencairan', (fund && fund!=='unmapped' ? db.prepare(releaseSql).bind(fund) : db.prepare(releaseSql)).first<any>().then(toQueue))
    : Promise.resolve(null)

  const [cashPosition, dspt, legacySpp, inactiveArrears, paymentQueue, approvalQueue, releaseQueue] = await Promise.all([
    cashPromise, dsptPromise, sppPromise, inactivePromise, paymentPromise, approvalPromise, releasePromise,
  ])

  return {
    period,
    periodLabel: reportPeriodLabel(period),
    cashPosition,
    dspt,
    legacySpp,
    inactiveArrears,
    paymentQueue,
    approvalQueue,
    releaseQueue,
  }
  })
}
