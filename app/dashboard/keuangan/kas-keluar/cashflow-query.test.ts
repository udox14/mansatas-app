import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invalidateFinanceCache } from '@/lib/finance-cache'

const mocks = vi.hoisted(() => ({ getDB: vi.fn() }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/auth/server', () => ({ getSession: vi.fn(async () => ({ user: { id: 'u1' } })) }))
vi.mock('@/utils/db-server', () => ({ getDB: mocks.getDB }))
vi.mock('@/lib/features', () => ({ checkFeatureCrudAccess: vi.fn(async () => true) }))
vi.mock('@/utils/r2', () => ({ uploadCashflowProof: vi.fn() }))
vi.mock('@/lib/komite-report-settings', () => ({ getKomiteReportSettings: vi.fn() }))

function d1Adapter(db: DatabaseSync, executedSql: string[]) {
  return {
    prepare(sql: string) {
      executedSql.push(sql)
      let params: any[] = []
      const api = {
        bind(...values: any[]) { params = values; return api },
        async all<T>() { return { results: db.prepare(sql).all(...params) as T[] } },
        async first<T>() { return (db.prepare(sql).get(...params) as T | undefined) ?? null },
      }
      return api
    },
  } as unknown as D1Database
}

describe('optimized cashflow query', () => {
  let db: DatabaseSync
  let executedSql: string[]

  beforeEach(() => {
    invalidateFinanceCache()
    executedSql = []
    db = new DatabaseSync(':memory:')
    db.exec(`
      CREATE TABLE "user" (id TEXT PRIMARY KEY, name TEXT, nama_lengkap TEXT);
      CREATE TABLE kelas (id TEXT PRIMARY KEY, tingkat INTEGER, nomor_kelas INTEGER, kelompok TEXT);
      CREATE TABLE siswa (id TEXT PRIMARY KEY, nama_lengkap TEXT, status TEXT, kelas_id TEXT, tahun_masuk INTEGER);
      CREATE TABLE fin_transaksi (
        id TEXT PRIMARY KEY, siswa_id TEXT, kategori TEXT, metode_bayar TEXT, jumlah_total INTEGER,
        nomor_kuitansi TEXT, bukti_transfer_url TEXT, input_oleh TEXT, is_void INTEGER,
        void_alasan TEXT, created_at TEXT
      );
      CREATE TABLE fin_transaksi_detail (transaksi_id TEXT, ref_type TEXT, ref_id TEXT, jumlah INTEGER);
      CREATE TABLE fin_dspt (id TEXT PRIMARY KEY, siswa_id TEXT, total_dibayar INTEGER, created_at TEXT, updated_at TEXT);
      CREATE TABLE fin_spp_saldo_awal (id TEXT PRIMARY KEY, siswa_id TEXT, total_dibayar INTEGER, created_at TEXT, updated_at TEXT);
      CREATE TABLE fin_cashflow_categories (
        id TEXT PRIMARY KEY, direction TEXT, name TEXT, sort_order INTEGER, is_active INTEGER, is_system INTEGER
      );
      CREATE TABLE fin_cashflow_entries (
        id TEXT PRIMARY KEY, direction TEXT, category_id TEXT, transaction_date TEXT, amount INTEGER,
        method TEXT, counterparty TEXT, description TEXT, proof_url TEXT, proof_number TEXT,
        created_by TEXT, is_void INTEGER, void_reason TEXT, created_at TEXT
      );
      INSERT INTO "user" VALUES ('u1','Bendahara','Bendahara');
      INSERT INTO kelas VALUES ('k1',10,1,'A');
      INSERT INTO siswa VALUES ('s1','Siswa Satu','aktif','k1',2026);
      INSERT INTO fin_dspt VALUES ('d1','s1',100,'2026-09-01','2026-09-01');
      INSERT INTO fin_transaksi VALUES ('t1','s1','dspt','tunai',100,'K-1',NULL,'u1',0,NULL,'2026-09-01 08:00:00');
      INSERT INTO fin_transaksi_detail VALUES ('t1','dspt','d1',100);
      INSERT INTO fin_cashflow_categories VALUES ('income-other','income','Lainnya',10,1,1);
      INSERT INTO fin_cashflow_categories VALUES ('expense-other','expense','Operasional',10,1,1);
      INSERT INTO fin_cashflow_entries VALUES ('i1','income','income-other','2026-09-02',50,'transfer','Donatur','Donasi',NULL,'M-1','u1',0,NULL,'2026-09-02 09:00:00');
      INSERT INTO fin_cashflow_entries VALUES ('e1','expense','expense-other','2026-09-03',40,'tunai','Toko','ATK',NULL,'M-2','u1',0,NULL,'2026-09-03 09:00:00');
    `)
    mocks.getDB.mockResolvedValue(d1Adapter(db, executedSql))
  })

  it('menghasilkan daftar, total, dan seluruh seri analitik yang sama', async () => {
    const { getCashflowPage } = await import('./actions')
    const result = await getCashflowPage({ page: 1, pageSize: 20 })

    expect(result.totalRows).toBe(3)
    expect(result.entries).toHaveLength(3)
    expect(result.summary).toEqual({ totalIncome: 150, manualIncome: 50, totalExpense: 40 })
    expect(result.analytics.income).toMatchObject({ total: 150, count: 2, largest: 100 })
    expect(result.analytics.expense).toMatchObject({ total: 40, count: 1, largest: 40 })
    expect(result.analytics.monthlyIncome).toEqual([{ key: '2026-09', label: '2026-09', total: 150, count: 2 }])
    expect(result.analytics.incomeSources).toEqual([
      { key: 'dspt', label: 'DSPT', total: 100, count: 1 },
      { key: 'manual', label: 'Manual', total: 50, count: 1 },
    ])
    expect(executedSql).toHaveLength(6)
    expect(executedSql.some(sql => sql.includes('filtered AS MATERIALIZED'))).toBe(true)
  })
})
