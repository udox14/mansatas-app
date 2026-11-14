import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { DatabaseSync } from 'node:sqlite'
import { buildReportFromRows, getKomiteFinancialReport, parseKomiteReportRequest, periodBounds } from '@/lib/komite-financial-report'
import { buildKomiteFinancialReportHtml } from '@/lib/komite-financial-report-pdf'
import { buildKomiteFinancialReportXlsx } from '@/lib/komite-financial-report-xlsx'

const report = buildReportFromRows({
  period: '2026-08', scope: 'all', openingBalance: 1_000_000,
  signatures: { enabled: true, treasurerName: 'Bendahara', chairmanName: 'Ketua', principalName: 'Kepala' },
  rows: [
    { id: 'b', origin: 'manual', direction: 'expense', transactionDate: '2026-08-02', createdAt: '2026-08-02 09:00:00', description: 'Belanja ATK', proofNumber: 'KK-202608-0001', amount: 250_000 },
    { id: 'a', origin: 'student', direction: 'income', transactionDate: '2026-08-01', createdAt: '2026-08-01 08:00:00', description: 'Pembayaran DSPT', proofNumber: 'KWT-1', amount: 500_000 },
  ],
})

describe('laporan keuangan komite bulanan', () => {
  it('menghitung saldo berjalan dan rekonsiliasi secara kronologis', () => {
    expect(report.rows.map(row => row.id)).toEqual(['a','b'])
    expect(report.rows.map(row => row.balance)).toEqual([1_500_000,1_250_000])
    expect(report.totalIncome).toBe(500_000)
    expect(report.totalExpense).toBe(250_000)
    expect(report.endingBalance).toBe(1_250_000)
  })

  it('menggunakan batas bulan eksklusif yang benar', () => {
    expect(periodBounds('2026-12')).toEqual({ start: '2026-12-01', next: '2027-01-01' })
    expect(() => periodBounds('2026-13')).toThrow('Periode laporan tidak valid')
  })

  it('menolak konfigurasi ekspor yang tidak lengkap', () => {
    expect(() => parseKomiteReportRequest({ period: '2026-08', scope: 'all' })).toThrow('Sumber saldo awal')
    expect(() => parseKomiteReportRequest({ period: '2026-08', scope: 'lain', openingBalance: { mode: 'cumulative' }, signatures: { enabled: false } })).toThrow('Cakupan')
  })

  it('mengambil ledger resmi, mengecualikan transaksi batal, dan menghormati cakupan siswa', async () => {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec(`
      CREATE TABLE siswa(id TEXT PRIMARY KEY,nama_lengkap TEXT,status TEXT,kelas_id TEXT,kelas_id_sebelum_keluar TEXT,tahun_masuk INTEGER,nisn TEXT);
      CREATE TABLE kelas(id TEXT,tingkat INTEGER,nomor_kelas INTEGER,kelompok TEXT);
      CREATE TABLE user(id TEXT PRIMARY KEY,nama_lengkap TEXT,name TEXT);
      CREATE TABLE fin_transaksi(id TEXT PRIMARY KEY,siswa_id TEXT,kategori TEXT,created_at TEXT,jumlah_total INTEGER,nomor_kuitansi TEXT,is_void INTEGER,metode_bayar TEXT,bukti_transfer_url TEXT,input_oleh TEXT,void_alasan TEXT);
      CREATE TABLE fin_transaksi_detail(transaksi_id TEXT,ref_type TEXT,ref_id TEXT,jumlah INTEGER);
      CREATE TABLE fin_dspt(id TEXT PRIMARY KEY,siswa_id TEXT,total_dibayar INTEGER,created_at TEXT,updated_at TEXT);
      CREATE TABLE fin_spp_saldo_awal(id TEXT PRIMARY KEY,siswa_id TEXT,total_dibayar INTEGER,created_at TEXT,updated_at TEXT);
      CREATE TABLE fin_cashflow_categories(id TEXT PRIMARY KEY,name TEXT,direction TEXT,sort_order INTEGER,is_system INTEGER);
      CREATE TABLE fin_cashflow_entries(id TEXT PRIMARY KEY,direction TEXT,category_id TEXT,transaction_date TEXT,created_at TEXT,counterparty TEXT,description TEXT,proof_number TEXT,amount INTEGER,is_void INTEGER,method TEXT,proof_url TEXT,created_by TEXT,void_reason TEXT);
      CREATE TABLE fin_monthly_opening_balances(period TEXT PRIMARY KEY,amount INTEGER);
      INSERT INTO siswa(id,nama_lengkap,status,tahun_masuk) VALUES('aktif','Siswa Aktif','aktif',2026),('keluar','Alumni','keluar',2025);
      INSERT INTO fin_transaksi(id,siswa_id,kategori,created_at,jumlah_total,nomor_kuitansi,is_void) VALUES('prior','keluar','dspt','2026-07-10 08:00:00',100000,'KWT-0',0),('masuk','aktif','dspt','2026-08-01 08:00:00',500000,'KWT-1',0),('batal','aktif','dspt','2026-08-01 09:00:00',999999,'KWT-X',1);
      INSERT INTO fin_cashflow_categories(id,name) VALUES('atk','ATK');
      INSERT INTO fin_cashflow_entries(id,direction,category_id,transaction_date,created_at,counterparty,description,proof_number,amount,is_void) VALUES('keluar','expense','atk','2026-08-02','2026-08-02 08:00:00','Toko','Belanja','KK-1',250000,0);
    `)
    sqlite.exec('CREATE TABLE komite_pengajuan(id TEXT PRIMARY KEY,status TEXT,nominal INTEGER); CREATE TABLE komite_pengajuan_reviews(pengajuan_id TEXT,version_number INTEGER,stage TEXT,workflow_version INTEGER);')
    sqlite.exec(readFileSync(new URL('../migrations/0123_add_rapbm.sql',import.meta.url),'utf8').split('INSERT OR IGNORE INTO role_features')[0])
    sqlite.exec(readFileSync(new URL('../migrations/0127_komite_fund_sources.sql',import.meta.url),'utf8'))
    const d1 = { prepare(sql: string) { let params: any[]=[]; const statement = { bind(...values: any[]){params=values;return statement}, async all(){return {results:sqlite.prepare(sql).all(...params)}}, async first(){return sqlite.prepare(sql).get(...params) ?? null} }; return statement } } as unknown as D1Database
    const defaults = { openingBalanceMode:'cumulative',proofNumberMode:'automatic',signaturesEnabled:false,treasurerName:'',chairmanName:'',principalName:'' } as const
    const request = { period:'2026-08',scope:'all',openingBalance:{mode:'cumulative'},signatures:{enabled:false} } as const
    const all = await getKomiteFinancialReport(d1,request,defaults)
    const funds = await Promise.all(['2026','2025','general','unmapped'].map(fund=>getKomiteFinancialReport(d1,{...request,fund},defaults)))
    expect(funds.map(fund=>fund.endingBalance)).toEqual([500000,100000,0,-250000])
    expect(funds.reduce((sum,fund)=>sum+fund.endingBalance,0)).toBe(all.endingBalance)
    const active = await getKomiteFinancialReport(d1,{...request,scope:'active_students'},defaults)
    expect(all.openingBalance).toBe(100000)
    expect(active.openingBalance).toBe(0)
    expect(all.rows.map(row=>row.id)).toEqual(['student-masuk','keluar'])
    expect(all.endingBalance).toBe(350000)
    sqlite.close()
  })

  it('membentuk HTML PDF lengkap dan aman', () => {
    const html = buildKomiteFinancialReportHtml(report)
    expect(html).toContain('LAPORAN KEUANGAN KOMITE MADRASAH')
    expect(html).toContain('Rincian Penerimaan')
    expect(html).toContain('BKU (Buku Kas Umum) / Rekonsiliasi')
    expect(html).toContain('1.250.000')
    expect(html).toContain('size:A4 landscape')
  })

  it.each([
    ['four_sheets',['Ringkasan','Penerimaan','Pengeluaran','BKU']],
    ['summary_bku',['Ringkasan','BKU']],
    ['single_sheet',['Laporan Keuangan']],
  ] as const)('membentuk workbook %s yang dapat dibuka', (layout, names) => {
    const bytes = buildKomiteFinancialReportXlsx(report,layout)
    const workbook = XLSX.read(bytes,{type:'array',cellFormula:true})
    expect(workbook.SheetNames).toEqual(names)
    const first = workbook.Sheets[names[0]]
    expect(first.A1.v).toBe('LAPORAN KEUANGAN KOMITE MADRASAH')
    if (layout === 'four_sheets') {
      expect(workbook.Sheets.BKU.F10.f).toBe('$B$7+D10-E10')
      expect(workbook.Sheets.BKU.F12.v).toBe(1_250_000)
    }
  })
})
