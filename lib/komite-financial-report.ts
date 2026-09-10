import type { KomiteReportSettings, OpeningBalanceMode } from '@/lib/komite-report-settings'

export type KomiteReportScope = 'all' | 'active_students'
export type KomiteExcelLayout = 'four_sheets' | 'single_sheet' | 'summary_bku'

export interface KomiteReportRequest {
  period: string
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
  const mode = input.openingBalance?.mode
  if (!mode || !['cumulative','manual','stored'].includes(mode)) throw new Error('Sumber saldo awal tidak valid.')
  if (!input.signatures || typeof input.signatures.enabled !== 'boolean') throw new Error('Pengaturan tanda tangan tidak valid.')
  const excelLayout = input.excelLayout
  if (excelLayout !== undefined && !['four_sheets','single_sheet','summary_bku'].includes(excelLayout)) throw new Error('Layout Excel tidak valid.')
  const cleanName = (name: unknown) => String(name || '').trim().slice(0,120)
  return {
    period: String(input.period), scope: input.scope as KomiteReportScope,
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

function ledgerSql(scope: KomiteReportScope) {
  const studentScope = scope === 'active_students' ? "AND s.status='aktif'" : ''
  return `
    WITH ledger AS (
      SELECT 'student-' || t.id id, 'student' origin, 'income' direction,
        substr(t.created_at,1,10) transaction_date, t.created_at created_at,
        ('Pembayaran ' || upper(t.kategori) || ' - ' || s.nama_lengkap) description,
        t.nomor_kuitansi proof_number, t.jumlah_total amount
      FROM fin_transaksi t JOIN siswa s ON s.id=t.siswa_id
      WHERE t.kategori IN ('dspt','spp') AND t.is_void=0 ${studentScope}
      UNION ALL
      SELECT 'legacy-dspt-' || d.id, 'legacy', 'income', substr(COALESCE(d.updated_at,d.created_at),1,10),
        COALESCE(d.updated_at,d.created_at), 'Saldo DSPT tanpa rincian transaksi - ' || s.nama_lengkap, NULL,
        d.total_dibayar-COALESCE(r.total_recorded,0)
      FROM fin_dspt d JOIN siswa s ON s.id=d.siswa_id
      LEFT JOIN (SELECT td.ref_id,SUM(td.jumlah) total_recorded FROM fin_transaksi_detail td JOIN fin_transaksi t ON t.id=td.transaksi_id WHERE td.ref_type='dspt' AND t.is_void=0 GROUP BY td.ref_id) r ON r.ref_id=d.id
      WHERE d.total_dibayar-COALESCE(r.total_recorded,0)>0 ${studentScope}
      UNION ALL
      SELECT 'legacy-spp-' || sp.id, 'legacy', 'income', substr(COALESCE(sp.updated_at,sp.created_at),1,10),
        COALESCE(sp.updated_at,sp.created_at), 'Saldo SPP tanpa rincian transaksi - ' || s.nama_lengkap, NULL,
        sp.total_dibayar-COALESCE(r.total_recorded,0)
      FROM fin_spp_saldo_awal sp JOIN siswa s ON s.id=sp.siswa_id
      LEFT JOIN (SELECT td.ref_id,SUM(td.jumlah) total_recorded FROM fin_transaksi_detail td JOIN fin_transaksi t ON t.id=td.transaksi_id WHERE td.ref_type='spp_saldo_awal' AND t.is_void=0 GROUP BY td.ref_id) r ON r.ref_id=sp.id
      WHERE sp.total_dibayar-COALESCE(r.total_recorded,0)>0 ${studentScope}
      UNION ALL
      SELECT e.id, 'manual', e.direction, e.transaction_date, e.created_at,
        trim(c.name || CASE WHEN e.counterparty<>'' THEN ' - ' || e.counterparty ELSE '' END || ': ' || e.description),
        e.proof_number, e.amount
      FROM fin_cashflow_entries e JOIN fin_cashflow_categories c ON c.id=e.category_id
      WHERE e.is_void=0
    )`
}

export async function getKomiteFinancialReport(
  db: D1Database,
  request: KomiteReportRequest,
  defaults: KomiteReportSettings,
): Promise<KomiteFinancialReport> {
  const { start, next } = periodBounds(request.period)
  if (!['all', 'active_students'].includes(request.scope)) throw new Error('Cakupan laporan tidak valid.')
  if (!['cumulative','manual','stored'].includes(request.openingBalance.mode)) throw new Error('Sumber saldo awal tidak valid.')
  const result = await db.prepare(`${ledgerSql(request.scope)} SELECT * FROM ledger WHERE transaction_date>=? AND transaction_date<? ORDER BY transaction_date,created_at,id`)
    .bind(start, next).all<any>()
  let openingBalance: number
  if (request.openingBalance.mode === 'manual') {
    const amount = Number(request.openingBalance.amount)
    if (!Number.isSafeInteger(amount)) throw new Error('Saldo awal manual wajib berupa bilangan rupiah.')
    openingBalance = amount
  } else if (request.openingBalance.mode === 'stored') {
    const stored = await db.prepare('SELECT amount FROM fin_monthly_opening_balances WHERE period=?').bind(request.period).first<{ amount: number }>()
    if (!stored) throw new Error(`Saldo awal tersimpan untuk ${reportPeriodLabel(request.period)} belum diatur.`)
    openingBalance = Number(stored.amount)
  } else {
    const prior = await db.prepare(`${ledgerSql(request.scope)} SELECT COALESCE(SUM(CASE WHEN direction='income' THEN amount ELSE -amount END),0) balance FROM ledger WHERE transaction_date<?`)
      .bind(start).first<{ balance: number }>()
    openingBalance = Number(prior?.balance || 0)
  }
  const rows: KomiteLedgerSourceRow[] = (result.results ?? []).map(row => ({
    id: String(row.id), origin: row.origin, direction: row.direction,
    transactionDate: String(row.transaction_date), createdAt: String(row.created_at || row.transaction_date),
    description: String(row.description || '-'), proofNumber: row.proof_number ? String(row.proof_number) : null,
    amount: Number(row.amount || 0),
  }))
  return buildReportFromRows({
    period: request.period,
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
