import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  APPROVAL_QUEUE_SQL,
  canAccessFinanceFeature,
  DSPT_COLLECTION_SQL,
  LEGACY_SPP_SQL,
  PAYMENT_QUEUE_SQL,
  RELEASE_QUEUE_SQL,
  resolveDashboardPeriod,
  settleDashboardSection,
} from './bendahara-dashboard'

let db: DatabaseSync | undefined
afterEach(() => {
  db?.close()
  db = undefined
})

describe('dashboard Bendahara Komite', () => {
  it('menghindari status ambigu pada ringkasan DSPT dan SPP', () => {
    db = new DatabaseSync(':memory:')
    db.exec(`
      CREATE TABLE siswa (id TEXT PRIMARY KEY, status TEXT NOT NULL);
      CREATE TABLE fin_dspt (id TEXT, siswa_id TEXT, nominal_target INTEGER, total_dibayar INTEGER, total_diskon INTEGER, status TEXT);
      CREATE TABLE fin_spp_saldo_awal (id TEXT, siswa_id TEXT, jumlah INTEGER, total_dibayar INTEGER, status TEXT);
      INSERT INTO siswa VALUES ('s1','aktif');
      INSERT INTO fin_dspt VALUES ('d1','s1',1000000,400000,100000,'nyicil');
      INSERT INTO fin_spp_saldo_awal VALUES ('sp1','s1',300000,100000,'belum_bayar');
    `)

    expect(db.prepare(DSPT_COLLECTION_SQL).get()).toMatchObject({
      total_accounts: 1, target: 1000000, paid: 400000, discount: 100000,
      remaining: 500000, partial: 1,
    })
    expect(db.prepare(LEGACY_SPP_SQL).get()).toMatchObject({
      total_accounts: 1, target: 300000, paid: 100000, remaining: 200000,
    })
  })

  it('menghitung tiga antrean operasional sesuai status dan mengabaikan pengajuan sendiri', () => {
    db = new DatabaseSync(':memory:')
    db.exec(`
      CREATE TABLE siswa (id TEXT, status TEXT);
      CREATE TABLE fin_dspt (id TEXT);
      CREATE TABLE fin_payment_submissions (jumlah INTEGER, status TEXT, kategori TEXT, siswa_id TEXT, dspt_id TEXT, bukti_uploaded_at TEXT, created_at TEXT);
      CREATE TABLE komite_pengajuan (nominal INTEGER, status TEXT, pengaju_id TEXT, submitted_at TEXT, approved_at TEXT, realisasi_status TEXT);
      INSERT INTO siswa VALUES ('s1','aktif'), ('s2','lulus');
      INSERT INTO fin_dspt VALUES ('d1'), ('d2');
      INSERT INTO fin_payment_submissions VALUES (150000,'menunggu_konfirmasi','dspt','s1','d1','2026-09-02', '2026-09-01'), (50000,'terkonfirmasi','dspt','s1','d1',NULL,'2026-09-03'), (90000,'menunggu_konfirmasi','dspt','s2','d2','2026-09-02','2026-09-02');
      INSERT INTO komite_pengajuan VALUES
        (700000,'menunggu_bendahara','orang-lain','2026-09-04',NULL,'belum'),
        (900000,'menunggu_bendahara','bendahara','2026-09-03',NULL,'belum'),
        (1200000,'disetujui','orang-lain','2026-09-01','2026-09-05','belum'),
        (800000,'disetujui','orang-lain','2026-09-01','2026-09-06','sudah');
    `)

    expect(db.prepare(PAYMENT_QUEUE_SQL).get()).toMatchObject({ count: 1, amount: 150000 })
    expect(db.prepare(APPROVAL_QUEUE_SQL).get('bendahara')).toMatchObject({ count: 1, amount: 700000 })
    db.exec('ALTER TABLE komite_pengajuan ADD COLUMN komite_cancelled_at TEXT')
    expect(db.prepare(RELEASE_QUEUE_SQL).get()).toMatchObject({ count: 1, amount: 1200000 })
  })

  it('memvalidasi periode termasuk perpindahan Desember ke Januari', () => {
    expect(resolveDashboardPeriod('2026-12', '2027-01-03')).toBe('2026-12')
    expect(resolveDashboardPeriod('2026-13', '2027-01-03')).toBe('2027-01')
    expect(resolveDashboardPeriod(undefined, '2027-01-03')).toBe('2027-01')
  })

  it('memetakan fitur turunan tanpa membuka fitur yang tidak diizinkan', () => {
    expect(canAccessFinanceFeature(['keuangan-laporan'], 'keuangan-transaksi')).toBe(true)
    expect(canAccessFinanceFeature(['keuangan-dspt'], 'keuangan-export')).toBe(true)
    expect(canAccessFinanceFeature(['keuangan-dspt'], 'keuangan-dspt-nonaktif')).toBe(true)
    expect(canAccessFinanceFeature([], 'keuangan-pengaturan')).toBe(false)
  })

  it('mengisolasi kegagalan satu bagian data', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(settleDashboardSection('uji', Promise.reject(new Error('gagal')))).resolves.toEqual({ status: 'unavailable', data: null })
    await expect(settleDashboardSection('uji', Promise.resolve({ ok: true }))).resolves.toEqual({ status: 'ready', data: { ok: true } })
    consoleSpy.mockRestore()
  })
})
