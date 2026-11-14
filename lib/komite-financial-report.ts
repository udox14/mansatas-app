import { cashLedgerSql, isKomiteFundScope } from '@/lib/komite-funds'
import type { KomiteReportSettings, OpeningBalanceMode } from '@/lib/komite-report-settings'

export type KomiteReportScope = 'all' | 'active_students'
export type KomiteExcelLayout = 'four_sheets' | 'single_sheet' | 'summary_bku'

export interface KomiteReportRequest {
  period: string
  fund?: string
  scope: KomiteReportScope
  openingBalance: { mode: OpeningBalanceMode; amount?: number }
  signatures: {
    enabled: boolean
    treasurerName?: string
    chairmanName?: string
    principalName?: string
  }
  excelLayout?: KomiteExcelLayout
}

export interface KomiteLedgerSourceRow {
  id: string
  origin: 'student' | 'manual' | 'legacy'
  direction: 'income' | 'expense'
  transactionDate: string
  createdAt: string
  description: string
  fundSource?: string
  proofNumber: string | null
  amount: number
}

export interface KomiteLedgerRow extends KomiteLedgerSourceRow {
  debit: number
  credit: number
  balance: number
}

export interface KomiteFinancialReport {
  period: string
  periodLabel: string
  fund?: string
  scope: KomiteReportScope
  openingBalance: number
  totalIncome: number
  totalExpense: number
  endingBalance: number
  rows: KomiteLedgerRow[]
  incomeRows: KomiteLedgerRow[]
  expenseRows: KomiteLedgerRow[]
  signatures: { enabled: boolean; treasurerName: string; chairmanName: string; principalName: string }
}

export function isValidReportPeriod(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function parseKomiteReportRequest(value: unknown): KomiteReportRequest {
  const input = value as Partial<KomiteReportRequest> | null
  if (!input || !isValidReportPeriod(String(input.period || ''))) throw new Error('Periode laporan tidak valid.')
  if (!['all','active_students'].includes(String(input.scope))) throw new Error('Cakupan laporan tidak valid.')
  if (input.fund !== undefined && !isKomiteFundScope(input.fund)) throw new Error('Sumber dana tidak valid.')
  const mode = input.openingBalance?.mode
  if (!mode || !['cumulative','manual','stored'].includes(mode)) throw new Error('Sumber saldo awal tidak valid.')
  if (!input.signatures || typeof input.signatures.enabled !== 'boolean') throw new Error('Pengaturan tanda tangan tidak valid.')
  const excelLayout = input.excelLayout
  if (excelLayout !== undefined && !['four_sheets','single_sheet','summary_bku'].includes(excelLayout)) throw new Error('Layout Excel tidak valid.')
  const cleanName = (name: unknown) => String(name || '').trim().slice(0,120)
  return {
    period: String(input.period), fund: input.fund, scope: input.scope as KomiteReportScope,
    openingBalance: { mode, amount: input.openingBalance?.amount },
    signatures: {
      enabled: input.signatures.enabled,
      treasurerName: cleanName(input.signatures.treasurerName),
      chairmanName: cleanName(input.signatures.chairmanName),
      principalName: cleanName(input.signatures.principalName),
    },
    excelLayout,
  }
}

export function periodBounds(period: string) {
  if (!isValidReportPeriod(period)) throw new Error('Periode laporan tidak valid.')
  const [year, month] = period.split('-').map(Number)
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  return { start: `${period}-01`, next: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01` }
}

export function reportPeriodLabel(period: string) {
  const [year, month] = period.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
    .format(new Date(Date.UTC(year, month - 1, 1))).toUpperCase()
}

export function buildReportFromRows(params: {
  period: string
  fund?: string
  scope: KomiteReportScope
  openingBalance: number
  rows: KomiteLedgerSourceRow[]
  signatures: KomiteFinancialReport['signatures']
}): KomiteFinancialReport {
  const sorted = [...params.rows].sort((a, b) =>
    a.transactionDate.localeCompare(b.transactionDate)
      || a.createdAt.localeCompare(b.createdAt)
      || a.id.localeCompare(b.id))
  let balance = params.openingBalance
  const rows = sorted.map((row): KomiteLedgerRow => {
    const amount = Number(row.amount || 0)
    const debit = row.direction === 'income' ? amount : 0
    const credit = row.direction === 'expense' ? amount : 0
    balance += debit - credit
    return { ...row, amount, debit, credit, balance }
  })
  const totalIncome = rows.reduce((sum, row) => sum + row.debit, 0)
  const totalExpense = rows.reduce((sum, row) => sum + row.credit, 0)
  return {
    period: params.period,
    periodLabel: reportPeriodLabel(params.period),
    scope: params.scope,
    fund: params.fund,
    openingBalance: params.openingBalance,
    totalIncome,
    totalExpense,
    endingBalance: params.openingBalance + totalIncome - totalExpense,
    rows,
    incomeRows: rows.filter(row => row.direction === 'income'),
    expenseRows: rows.filter(row => row.direction === 'expense'),
    signatures: params.signatures,
  }
}

export async function getKomiteFinancialReport(
  db: D1Database,
  request: KomiteReportRequest,
  defaults: KomiteReportSettings,
): Promise<KomiteFinancialReport> {
  const { start, next } = periodBounds(request.period)
  if (!['all', 'active_students'].includes(request.scope)) throw new Error('Cakupan laporan tidak valid.')
  if (!['cumulative','manual','stored'].includes(request.openingBalance.mode)) throw new Error('Sumber saldo awal tidak valid.')
  if (request.fund !== undefined && !isKomiteFundScope(request.fund)) throw new Error('Sumber dana tidak valid.')
  const fund = request.fund && request.fund!=='all' ? request.fund : undefined
  const binds = fund ? [fund] : []
  const criteria = "status='active'" + (request.scope==='active_students' ? " AND (student_status='aktif' OR student_id IS NULL)" : '')
  const result = await db.prepare(`${cashLedgerSql(fund)} SELECT * FROM ledger WHERE ${criteria} AND transaction_date>=? AND transaction_date<? ORDER BY transaction_date,created_at,id`)
    .bind(...binds,start,next).all<any>()
  let openingBalance: number
  if (request.openingBalance.mode === 'manual') {
    const amount = Number(request.openingBalance.amount)
    if (!Number.isSafeInteger(amount)) throw new Error('Saldo awal manual wajib berupa bilangan rupiah.')
    openingBalance = amount
  } else if (request.openingBalance.mode === 'stored') {
    const stored = await (fund
      ? db.prepare('SELECT amount FROM fin_komite_opening_balances WHERE period=? AND source=?').bind(request.period,fund)
      : db.prepare('SELECT amount FROM fin_monthly_opening_balances WHERE period=?').bind(request.period)).first<{ amount: number }>()
    if (!stored) throw new Error(`Saldo awal tersimpan untuk ${reportPeriodLabel(request.period)} belum diatur.`)
    openingBalance = Number(stored.amount)
  } else {
    const prior = await db.prepare(`${cashLedgerSql(fund)} SELECT COALESCE(SUM(CASE WHEN direction='income' THEN amount ELSE -amount END),0) balance FROM ledger WHERE ${criteria} AND transaction_date<?`)
      .bind(...binds,start).first<{ balance: number }>()
    openingBalance = Number(prior?.balance || 0)
  }
  const rows: KomiteLedgerSourceRow[] = (result.results ?? []).map(row => ({
    id: String(row.id), origin: row.origin, direction: row.direction,
    transactionDate: String(row.transaction_date), createdAt: String(row.created_at || row.transaction_date),
    description: row.origin==='student' && row.proof_number ? `Pembayaran ${String(row.source).toUpperCase()} - ${row.student_name}`
      : row.origin==='manual' ? `${row.category_name}${row.counterparty ? ' - '+row.counterparty : ''}: ${row.description}`
      : `${row.description} - ${row.student_name}`, proofNumber: row.proof_number ? String(row.proof_number) : null,
    fundSource: String(row.fund_source ?? 'unmapped'),
    amount: Number(row.amount || 0),
  }))
  return buildReportFromRows({
    period: request.period,
    fund: request.fund,
    scope: request.scope,
    openingBalance,
    rows,
    signatures: {
      enabled: request.signatures.enabled,
      treasurerName: request.signatures.treasurerName?.trim() || defaults.treasurerName || '................................',
      chairmanName: request.signatures.chairmanName?.trim() || defaults.chairmanName || '................................',
      principalName: request.signatures.principalName?.trim() || defaults.principalName || '................................',
    },
  })
}
