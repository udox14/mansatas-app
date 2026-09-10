import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('migrations/0102_optimize_finance_reads.sql', 'utf8')

describe('finance read optimization migration', () => {
  it('menambahkan indeks komposit untuk query laporan dan ledger', () => {
    expect(sql).toContain('fin_transaksi_detail(ref_type, ref_id, transaksi_id)')
    expect(sql).toContain('fin_transaksi(is_void, created_at DESC)')
    expect(sql).toContain('fin_cashflow_entries(direction, is_void, transaction_date DESC)')
    expect(sql).toContain('riwayat_kelas(siswa_id, created_at DESC)')
    expect(sql).toContain('siswa(status, tahun_masuk)')
  })

  it('dapat diterapkan dua kali tanpa mengubah data', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`
      CREATE TABLE fin_transaksi_detail (ref_type TEXT, ref_id TEXT, transaksi_id TEXT);
      CREATE TABLE fin_transaksi (siswa_id TEXT, is_void INTEGER, created_at TEXT);
      CREATE TABLE fin_cashflow_entries (direction TEXT, is_void INTEGER, transaction_date TEXT);
      CREATE TABLE riwayat_kelas (siswa_id TEXT, created_at TEXT);
      CREATE TABLE siswa (status TEXT, tahun_masuk INTEGER);
    `)
    db.exec(sql)
    db.exec(sql)

    const count = db.prepare("SELECT COUNT(*) total FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").get() as { total: number }
    expect(count.total).toBe(6)
  })
})
