export type FundAllocation = { source: string; groupId: string | null; amount: number }
export type BudgetPosition = { group_id: string; cohort: number; label: string; account: string | null; available: number }

export function isKomiteFundSource(value: unknown): value is string {
  return typeof value === 'string' && (value === 'general' || /^(20|21)\d{2}$/.test(value))
}

export function isKomiteFundScope(value: unknown): value is string {
  return isKomiteFundSource(value) || value === 'unmapped' || value === 'all'
}

export function komiteFundLabel(source?: string | null) {
  if (source === 'general') return 'Kas Umum'
  if (source === 'unmapped') return 'Belum Dipetakan'
  return source && source !== 'all' ? `Angkatan ${source}` : 'Semua Angkatan'
}

export function parseFundAllocations(rows: unknown, amount: number, income = false): FundAllocation[] {
  if (!Array.isArray(rows) || !rows.length || rows.length > 20) throw new Error('Pilih 1–20 alokasi sumber dana.')
  const parsed = rows.map(row => {
    if (!row || !isKomiteFundSource(row.source) || !Number.isSafeInteger(row.amount) || row.amount <= 0) {
      throw new Error('Sumber dana dan nominal alokasi wajib diisi.')
    }
    const groupId = typeof row.groupId === 'string' && row.groupId.trim() ? row.groupId.trim() : null
    if ((!income && Number(row.source) >= 2026) !== Boolean(groupId)) throw new Error('Pilih pos RAPBM yang sesuai dengan sumber dana.')
    return { source: row.source, groupId, amount: row.amount }
  })
  if (parsed.reduce((sum, row) => sum + row.amount, 0) !== amount) throw new Error('Total alokasi wajib sama dengan nominal transaksi.')
  return parsed
}

export async function validateKomiteFundSources(db: D1Database, allocations: FundAllocation[]) {
  const years=[...new Set(allocations.map(row=>row.source).filter(source=>source!=='general'))]
  if (!years.length) return
  const missing=await db.prepare(`SELECT src.value source FROM json_each(?) src WHERE
    NOT EXISTS(SELECT 1 FROM siswa WHERE tahun_masuk=CAST(src.value AS INTEGER))
    AND NOT EXISTS(SELECT 1 FROM fin_komite_rapbm_versions WHERE cohort=CAST(src.value AS INTEGER))
    AND NOT EXISTS(SELECT 1 FROM fin_rapbm_versions WHERE komite_cohort=CAST(src.value AS INTEGER) AND status='published') LIMIT 1`)
    .bind(JSON.stringify(years)).first<{source:string}>()
  if(missing) throw new Error(`${komiteFundLabel(missing.source)} belum tersedia sebagai sumber dana.`)
}

export async function listKomiteFundOptions(db: D1Database) {
  const [years, positions, historicalPositions] = await db.batch([
    db.prepare(`SELECT tahun_masuk AS year FROM siswa WHERE tahun_masuk BETWEEN 2000 AND 2199
      UNION SELECT cohort FROM fin_komite_rapbm_versions
      UNION SELECT komite_cohort FROM fin_rapbm_versions WHERE status='published' AND komite_cohort IS NOT NULL
      ORDER BY year DESC`),
    db.prepare('SELECT group_id,cohort,label,account,available FROM fin_komite_budget_balances WHERE active=1 ORDER BY cohort DESC,label,account'),
    db.prepare('SELECT group_id,cohort,label,account,available FROM fin_komite_budget_balances WHERE active=1 OR enabled=0 ORDER BY cohort DESC,label,account'),
  ])
  return {
    years: (years.results as { year: number }[]).map(row => row.year),
    positions: positions.results as BudgetPosition[],
    historicalPositions: historicalPositions.results as BudgetPosition[],
  }
}

export function checkKomiteWrite(db: D1Database) {
  return db.prepare('INSERT INTO fin_komite_transaction_guard SELECT 1,0 WHERE changes()<>1')
}

export function checkKomiteCash(db: D1Database, sources: string[]) {
  return db.prepare(`INSERT INTO fin_komite_transaction_guard
    SELECT 0,1 FROM json_each(?) src
    LEFT JOIN fin_komite_fund_settings s ON s.source=src.value
    LEFT JOIN fin_komite_fund_balances b ON b.source=src.value
    WHERE COALESCE(s.allow_negative,0)=0 AND COALESCE(b.amount,0)<0 LIMIT 1`)
    .bind(JSON.stringify([...new Set(sources)]))
}

export function cashLedgerSql(source?: string) {
  const scoped = source && source !== 'all'
  const columns = `l.id,l.origin,l.direction,l.source,l.category_id,l.category_name,l.transaction_date,l.method,l.counterparty,l.description,l.proof_url,l.proof_number,l.recorder_id,l.recorder_name,l.student_id,l.student_name,l.student_class,l.angkatan,l.status,l.void_reason,l.created_at,l.kelas_id,l.student_status,(SELECT s.nisn FROM siswa s WHERE s.id=l.student_id) student_nisn, (SELECT e.komite_pengajuan_id FROM fin_cashflow_entries e WHERE e.id=l.id AND l.origin='manual') komite_pengajuan_id, (SELECT a.group_id FROM fin_komite_allocations a WHERE a.cashflow_id=l.id AND a.state='realized' LIMIT 1) group_id`
  return `WITH ledger AS (
    SELECT ${columns}, ${scoped ? 'p.amount,p.source AS fund_source' : `l.amount,
      CASE WHEN l.origin='student' THEN COALESCE(CAST(l.angkatan AS TEXT),'unmapped') ELSE (SELECT group_concat(p.source,'|') FROM fin_komite_cash_parts p WHERE p.id=l.id) END AS fund_source`}
    FROM fin_komite_cash_ledger l
    ${scoped ? 'JOIN fin_komite_cash_parts p ON p.id=l.id AND p.source=?' : ''}
  )`
}

export async function komiteCashError(db: D1Database, error: unknown, changes: Array<{ source: string; amount: number }>) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('komite_write_conflict')) return 'Data sudah berubah. Muat ulang sebelum mencoba lagi.'
  if (!message.includes('komite_cash_insufficient')) return message
  const net = new Map<string, number>()
  for (const row of changes) net.set(row.source, (net.get(row.source) ?? 0) + row.amount)
  const results = await db.prepare(`SELECT src.key source,src.value delta,COALESCE(b.amount,0) balance
    FROM json_each(?) src LEFT JOIN fin_komite_fund_balances b ON b.source=src.key
    LEFT JOIN fin_komite_fund_settings s ON s.source=src.key
    WHERE COALESCE(s.allow_negative,0)=0 AND COALESCE(b.amount,0)+src.value<0`)
    .bind(JSON.stringify(Object.fromEntries(net))).all<{ source: string; delta: number; balance: number }>()
  const shortages = results.results.map(row => `${komiteFundLabel(row.source)} kurang Rp ${(-row.balance - row.delta).toLocaleString('id-ID')}`)
  return shortages.length ? shortages.join(', ') : 'Saldo kas sumber dana tidak cukup. Muat ulang sebelum mencoba lagi.'
}
