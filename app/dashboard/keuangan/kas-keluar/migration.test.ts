import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(process.cwd(), 'migrations', '0099_add_arus_kas.sql'), 'utf8')

describe('migration Arus Kas', () => {
  it('creates category, ledger, audit, and idempotent legacy mapping', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS fin_cashflow_categories')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS fin_cashflow_entries')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS fin_cashflow_audit')
    expect(sql).toContain('legacy_kas_keluar_id TEXT UNIQUE')
    expect(sql).toContain("'legacy-' || k.id")
    expect(sql).toContain('FROM fin_kas_keluar k')
  })

  it('seeds one income fallback and all eight SNP categories', () => {
    expect(sql).toContain("'Pemasukan Lainnya'")
    expect((sql.match(/'expense-snp-/g) || []).length).toBeGreaterThanOrEqual(8)
    expect(sql).toContain("'Pengembangan Standar Pembiayaan'")
  })
})
