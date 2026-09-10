import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('migrasi laporan keuangan bulanan', () => {
  const sql = readFileSync(join(process.cwd(),'migrations','0101_add_komite_monthly_report.sql'),'utf8')
  it('menambahkan nomor bukti unik, sequence bulanan, dan saldo awal', () => {
    expect(sql).toContain('ADD COLUMN proof_number TEXT')
    expect(sql).toContain('fin_cashflow_proof_sequences')
    expect(sql).toContain('PRIMARY KEY (direction, period)')
    expect(sql).toContain('fin_monthly_opening_balances')
  })
})

