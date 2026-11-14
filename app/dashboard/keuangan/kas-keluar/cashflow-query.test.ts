import { readFileSync } from 'node:fs'
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
    async batch(statements: { all(): Promise<unknown> }[]) { return Promise.all(statements.map(stmt=>stmt.all())) },
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
      CREATE TABLE siswa (id TEXT PRIMARY KEY, nama_lengkap TEXT, status TEXT, kelas_id TEXT, tahun_masuk INTEGER,kelas_id_sebelum_keluar TEXT,nisn TEXT);
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
      INSERT INTO siswa VALUES ('s1','Siswa Satu','aktif','k1',2026,NULL,NULL);
      INSERT INTO fin_dspt VALUES ('d1','s1',100,'2026-09-01','2026-09-01');
      INSERT INTO fin_transaksi VALUES ('t1','s1','dspt','tunai',100,'K-1',NULL,'u1',0,NULL,'2026-09-01 08:00:00');
      INSERT INTO fin_transaksi_detail VALUES ('t1','dspt','d1',100);
      INSERT INTO fin_cashflow_categories VALUES ('income-other','income','Lainnya',10,1,1);
      INSERT INTO fin_cashflow_categories VALUES ('expense-other','expense','Operasional',10,1,1);
      INSERT INTO fin_cashflow_entries VALUES ('i1','income','income-other','2026-09-02',50,'transfer','Donatur','Donasi',NULL,'M-1','u1',0,NULL,'2026-09-02 09:00:00');
      INSERT INTO fin_cashflow_entries VALUES ('e1','expense','expense-other','2026-09-03',40,'tunai','Toko','ATK',NULL,'M-2','u1',0,NULL,'2026-09-03 09:00:00');
    `)
    db.exec('CREATE TABLE komite_pengajuan(id TEXT PRIMARY KEY,status TEXT,nominal INTEGER); CREATE TABLE komite_pengajuan_reviews(pengajuan_id TEXT,version_number INTEGER,stage TEXT,workflow_version INTEGER);')
    db.exec(readFileSync(new URL('../../../../migrations/0123_add_rapbm.sql',import.meta.url),'utf8').split('INSERT OR IGNORE INTO role_features')[0])
    db.exec(readFileSync(new URL('../../../../migrations/0127_komite_fund_sources.sql',import.meta.url),'utf8'))
    mocks.getDB.mockResolvedValue(d1Adapter(db, executedSql))
  })

  it('menghasilkan daftar, total, dan seluruh seri analitik yang sama', async () => {
    const { getCashflowPage, getCashflowPrintRows } = await import('./actions')
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
    expect(executedSql).toHaveLength(8)
    expect((await getCashflowPage({angkatan:'2026'})).summary).toEqual({totalIncome:100,manualIncome:0,totalExpense:0})
    const unmapped=await getCashflowPrintRows({angkatan:'unmapped'},true)
    expect(unmapped).toMatchObject({income:50,expense:40})
    expect(unmapped.entries.map(row=>row.id)).toEqual(['i1','e1'])
    expect(executedSql.some(sql => sql.includes('filtered AS MATERIALIZED'))).toBe(true)
  })
  it('mencetak seluruh hasil filter, termasuk lebih dari satu halaman dan kondisi kosong', async () => {
    const {getCashflowPage,getCashflowPrintRows}=await import('./actions')
    db.exec(`WITH RECURSIVE counter(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM counter WHERE i<25)
      INSERT INTO fin_cashflow_entries(id,direction,category_id,transaction_date,amount,description,created_by,is_void,created_at)
      SELECT 'repeat-'||i,'income','income-other','2026-09-04',10,'Donasi','u1',0,'2026-09-04' FROM counter`)
    const filter={angkatan:'unmapped',direction:'income' as const,page:1,pageSize:10}
    expect((await getCashflowPage(filter)).entries).toHaveLength(10)
    expect(await getCashflowPrintRows(filter,true)).toMatchObject({income:300,expense:0})
    expect((await getCashflowPrintRows(filter,true)).entries).toHaveLength(26)
    expect(await getCashflowPrintRows({angkatan:'general'},true)).toEqual({income:0,expense:0,entries:[]})
  })

  it('mengunci pagu secara atomik dan menahan pembayaran dari sumber yang kurang', () => {
    db.exec(`
      INSERT INTO fin_rapbm_years(year) VALUES(2026);
      INSERT INTO fin_rapbm_versions(id,year,version,title,institution,sheet,income_totals_json,expense_totals_json,notes_json,original_filename,r2_key,source_sha256,created_by_name)
      VALUES('v1',2026,1,'R','M','S','{}','{}','[]','r.xlsx','v1','hash','Bendahara');
      INSERT INTO fin_rapbm_groups(id,version_id,section,sort_order,label,account,source_ref)
      VALUES('g1','v1','expense',1,'ATK','521111','S!A1'),('g2','v1','expense',2,'Kegiatan','521111','S!A2');
      INSERT INTO fin_komite_rapbm_versions(version_id,cohort,activated_by,enabled) VALUES('v1',2026,'u1',1);
      INSERT INTO fin_komite_budget_positions(group_id,amount) VALUES('g1',200),('g2',100);
      INSERT INTO komite_pengajuan(id,status,nominal) VALUES('p1','menunggu_ketua',150),('p2','menunggu_ketua',150);
      INSERT INTO fin_komite_allocations(id,pengajuan_id,source,group_id,amount,state,actor_id)
      VALUES('a1','p1','2026','g1',150,'review','u1'),('a2','p2','2026','g1',150,'review','u1');
      INSERT INTO fin_komite_allocations(id,cashflow_id,source,amount,state,actor_id)
      VALUES('other-cash','i1','general',50,'realized','u1');
    `)
    function atomically(operation: () => void) {
      db.exec('BEGIN')
      try { operation(); db.exec('COMMIT') }
      catch (error) { db.exec('ROLLBACK'); throw error }
    }
    function approve(id:string) {
      atomically(()=>{
        db.prepare("UPDATE fin_komite_allocations SET state='locked' WHERE pengajuan_id=?").run(id)
        db.prepare("UPDATE komite_pengajuan SET status='disetujui' WHERE id=?").run(id)
      })
    }
    approve('p1')
    expect(()=>approve('p2')).toThrow(/sisa pagu/)
    expect(db.prepare("SELECT status FROM komite_pengajuan WHERE id='p2'").get()?.status).toBe('menunggu_ketua')
    function pay(id:string) {
      atomically(()=> {
        db.prepare(`INSERT INTO fin_cashflow_entries(id,direction,category_id,transaction_date,amount,description,created_by,is_void,created_at,komite_pengajuan_id)
          VALUES (?,'expense','expense-komite-spb','2026-09-04',150,'ATK','u1',0,'2026-09-04','p1')`).run(id)
        db.prepare("INSERT INTO fin_komite_spb_cash_parts VALUES (?,'2026',150)").run(id)
        db.exec("UPDATE fin_komite_allocations SET state='realized' WHERE id='a1'")
        db.exec(`INSERT INTO fin_komite_transaction_guard
          SELECT 0,1 FROM fin_komite_fund_balances b LEFT JOIN fin_komite_fund_settings s ON s.source=b.source
          WHERE b.source='2026' AND b.amount<0 AND COALESCE(s.allow_negative,0)=0`)
      })
    }
    expect(()=>pay('payment')).toThrow(/komite_cash_insufficient/)
    expect(db.prepare("SELECT id FROM fin_cashflow_entries WHERE id='payment'").get()).toBeUndefined()
    expect(db.prepare("SELECT available,locked,realized FROM fin_komite_budget_balances WHERE group_id='g1'").get()).toEqual({available:50,locked:150,realized:0})
    db.exec("INSERT INTO fin_komite_fund_settings(source,allow_negative,updated_by) VALUES('2026',1,'u1')")
    pay('payment')
    expect(()=>pay('duplicate')).toThrow(/UNIQUE/)
    expect(db.prepare("SELECT * FROM fin_komite_fund_balances WHERE source IN ('2026','general') ORDER BY source").all()).toEqual([{source:'2026',amount:-50},{source:'general',amount:50}])
    expect(()=>approve('p2')).toThrow(/sisa pagu/)
    db.exec(`
      UPDATE fin_cashflow_entries SET is_void=1 WHERE id='payment';
      UPDATE fin_komite_allocations SET state='locked' WHERE id='a1';
      INSERT INTO fin_rapbm_years(year) VALUES(2027);
      INSERT INTO fin_rapbm_versions(id,year,version,title,institution,sheet,income_totals_json,expense_totals_json,notes_json,original_filename,r2_key,source_sha256,created_by_name)
      VALUES('v2',2027,1,'R','M','S','{}','{}','[]','r.xlsx','v2','hash','Bendahara');
      INSERT INTO fin_rapbm_groups(id,version_id,section,sort_order,label,account,source_ref)
      VALUES('g3','v2','expense',1,'Pagu lanjutan','521111','S!A1');
      INSERT INTO fin_komite_rapbm_versions(version_id,cohort,previous_version_id,activated_by,enabled,prior_unspent,carry_forward)
      VALUES('v2',2026,'v1','u1',1,150,150);
      INSERT INTO fin_komite_budget_positions(group_id,amount) VALUES('g3',150);
    `)
    pay('after-revision')
    expect(db.prepare("SELECT active,realized FROM fin_komite_budget_balances WHERE group_id='g1'").get()).toEqual({active:0,realized:150})
    expect(db.prepare("SELECT available FROM fin_komite_revision_balance WHERE cohort=2026").get()).toEqual({available:150})
    expect(db.prepare("SELECT source,amount FROM fin_komite_spb_cash_parts WHERE cashflow_id='payment'").get()).toEqual({source:'2026',amount:150})
  })

})
