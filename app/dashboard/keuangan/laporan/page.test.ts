import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Execute the actual page SQL: mocks of D1 cannot detect invalid compound SELECTs.
const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')
const queries = [...page.matchAll(/db\.prepare\(`([\s\S]*?)`\)/g)].map(match => match[1])

describe('Laporan Keuangan page queries', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = new DatabaseSync(':memory:')
    for (const file of ['schema.sql', 'schema-migration-keuangan.sql', '0099_add_arus_kas.sql']) {
      const migration = readFileSync(new URL(`../../../../migrations/${file}`, import.meta.url), 'utf8')
      for (const statement of migration.matchAll(/CREATE TABLE IF NOT EXISTS[\s\S]*?;/g)) {
        db.exec(statement[0])
      }
    }
    db.exec('ALTER TABLE siswa ADD COLUMN tahun_masuk INTEGER')
  })

  afterEach(() => db.close())

  it('executes all four report queries on an empty database', () => {
    expect(queries).toHaveLength(4)
    for (const query of queries) expect(db.prepare(query).all()).toEqual([])
  })

  it('sorts all income sources together and subtracts recorded payments from opening balances', () => {
    db.exec(`
      INSERT INTO user (id, name, email) VALUES ('u', 'Bendahara', 'test@example.com');
      INSERT INTO siswa (id, nisn, nama_lengkap, tahun_masuk) VALUES ('s', '001', 'Siswa', 2025);
      INSERT INTO fin_dspt (id, siswa_id, nominal_target, total_dibayar, updated_at)
        VALUES ('d', 's', 1000, 500, '2026-09-02 08:00:00');
      INSERT INTO fin_spp_saldo_awal (id, siswa_id, jumlah, total_dibayar, updated_at)
        VALUES ('sp', 's', 1000, 400, '2026-09-03 08:00:00');
      INSERT INTO fin_transaksi (id, siswa_id, kategori, jumlah_total, input_oleh, created_at)
        VALUES ('t', 's', 'dspt', 200, 'u', '2026-09-01 08:00:00');
      INSERT INTO fin_transaksi_detail (id, transaksi_id, ref_type, ref_id, jumlah)
        VALUES ('td', 't', 'dspt', 'd', 200);
      INSERT INTO fin_cashflow_categories (id, direction, name) VALUES ('c', 'income', 'Donasi');
      INSERT INTO fin_cashflow_entries
        (id, direction, category_id, transaction_date, amount, description, created_by, created_at)
        VALUES ('e', 'income', 'c', '2026-09-04', 600, 'Donasi', 'u', '2026-09-04 08:00:00');
    `)

    const rows = db.prepare(queries[1]).all()
    expect(rows.map(row => [row.id, row.jumlah_total])).toEqual([
      ['e', 600], ['spp-balance-sp', 400], ['dspt-balance-d', 300], ['t', 200],
    ])
    expect(rows.map(row => row.created_at)).toEqual([
      '2026-09-04 08:00:00', '2026-09-03 08:00:00', '2026-09-02 08:00:00', '2026-09-01 08:00:00',
    ])
  })
})
