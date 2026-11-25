import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RAPBM_SCHEMA } from '@/lib/rapbm-schema'

const migration0127 = readFileSync(new URL('../migrations/0127_komite_fund_sources.sql', import.meta.url), 'utf8')
const replaceSql = readFileSync(new URL('./replace-rapbm-2026.sql', import.meta.url), 'utf8')
const enableSql = readFileSync(new URL('./enable-rapbm-2026.sql', import.meta.url), 'utf8')

const oldId = 'b18f2231-995c-4ea5-b3cc-de9b73076ff7'
const oldSha = 'f3005a3c814857c2b02c38e4c7551b94a7b1f15fd6a143442e11e321be16293e'
const newId = 'c26a2026-1125-4e60-95a8-63ce80123b4b'

let db: DatabaseSync

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE "user" (id TEXT PRIMARY KEY, name TEXT, nama_lengkap TEXT);
    INSERT INTO "user" VALUES ('dd3f7cfea48304d777433295a671c3db', 'M. Iqbal Abdul Wakil, M.Pd.', 'M. Iqbal Abdul Wakil, M.Pd.');
    INSERT INTO "user" VALUES ('21a62b5b-cfb3-4fb0-8744-25c1f26b448d', 'Dindin Solahudin', 'Dindin Solahudin');
    CREATE TABLE siswa (id TEXT PRIMARY KEY, nama_lengkap TEXT, tahun_masuk INTEGER, kelas_id TEXT, kelas_id_sebelum_keluar TEXT, status TEXT);
    CREATE TABLE kelas (id TEXT PRIMARY KEY, tingkat TEXT, nomor_kelas TEXT, kelompok TEXT);
    CREATE TABLE fin_transaksi (id TEXT PRIMARY KEY, siswa_id TEXT, kategori TEXT, jumlah_total INTEGER, metode_bayar TEXT, nomor_kuitansi TEXT, bukti_transfer_url TEXT, input_oleh TEXT, is_void INTEGER, void_alasan TEXT, created_at TEXT);
    CREATE TABLE fin_transaksi_detail (id TEXT PRIMARY KEY, transaksi_id TEXT, ref_type TEXT, ref_id TEXT, jumlah INTEGER);
    CREATE TABLE fin_dspt (id TEXT PRIMARY KEY, siswa_id TEXT, total_dibayar INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE fin_spp_saldo_awal (id TEXT PRIMARY KEY, siswa_id TEXT, total_dibayar INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE fin_cashflow_categories (id TEXT PRIMARY KEY, direction TEXT, name TEXT, sort_order INTEGER, is_system INTEGER);
    CREATE TABLE fin_cashflow_entries (id TEXT PRIMARY KEY, direction TEXT, category_id TEXT, transaction_date TEXT, amount INTEGER, method TEXT, counterparty TEXT, description TEXT, proof_url TEXT, proof_number TEXT, created_by TEXT, is_void INTEGER, void_reason TEXT, created_at TEXT);
    CREATE TABLE komite_pengajuan (id TEXT PRIMARY KEY, judul TEXT, status TEXT, nominal INTEGER, nomor_spb TEXT, updated_at TEXT);
    CREATE TABLE komite_pengajuan_reviews (pengajuan_id TEXT, version_number INTEGER, stage TEXT, workflow_version INTEGER);
    CREATE TABLE activity_logs (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      actor_user_id TEXT, actor_name TEXT, actor_roles TEXT NOT NULL DEFAULT '[]',
      module TEXT NOT NULL, action TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'info',
      summary TEXT NOT NULL, entity_type TEXT, entity_id TEXT, entity_label TEXT,
      before_json TEXT, after_json TEXT, metadata_json TEXT
    );
    INSERT INTO fin_rapbm_years_placeholder SELECT 1 WHERE 0;
  `.replace('INSERT INTO fin_rapbm_years_placeholder SELECT 1 WHERE 0;', ''))

  for (const stmt of RAPBM_SCHEMA) db.exec(stmt)
  db.exec(`
    INSERT INTO fin_rapbm_years (year) VALUES (2026);
    INSERT INTO fin_rapbm_versions (
      id, year, version, status, title, institution, sheet,
      income_totals_json, expense_totals_json, notes_json,
      original_filename, r2_key, source_sha256, created_by, created_by_name
    ) VALUES (
      '${oldId}', 2026, 1, 'draft',
      'RENCANA  ANGGARAN  PENDAPATAN DAN BELANJA  MADRASAH ( RAPBM )',
      'MADRASAH  ALIYAH  NEGERI  1  TASIKMALAYA', 'Sheet1',
      '{"apbn":2443436000,"komite":2095500000,"total":4538936000}',
      '{"apbn":2443436000,"komite":2095500000,"total":4538936000}', '[]',
      'RAPBM 2026.xlsx', 'private/rapbm/2026/${oldId}.xlsx', '${oldSha}',
      'dd3f7cfea48304d777433295a671c3db', 'M. Iqbal Abdul Wakil, M.Pd.'
    );
    UPDATE fin_rapbm_versions SET status = 'published', published_at = '2026-11-01 12:56:30', published_by = '21a62b5b-cfb3-4fb0-8744-25c1f26b448d', notes_acknowledged = 1 WHERE id = '${oldId}';
    UPDATE fin_rapbm_years SET active_version_id = '${oldId}', publication_revision = 1 WHERE year = 2026;
  `)
  db.exec(migration0127)
  db.exec(`
    INSERT INTO fin_komite_rapbm_versions (version_id, cohort, previous_version_id, activated_by, enabled)
    VALUES ('${oldId}', 2026, NULL, '21a62b5b-cfb3-4fb0-8744-25c1f26b448d', 0);
  `)
  db.exec(replaceSql)
})

afterEach(() => db.close())

describe('Enable RAPBM 2026 for operational and historical mapping use', () => {
  it('activates all 17 positions, returns unallocated menunggu_ketua proposals to bendahara, and allows both historical and new allocations', () => {
    db.exec(`
      INSERT INTO komite_pengajuan (id, judul, status, nominal, nomor_spb, updated_at, komite_pre_migration, fund_review_cycle)
      VALUES
        ('spb-old', 'SPB Historis', 'disetujui', 1000000, 'SPB / 001 / KOMITE / X / 2026', '2026-10-01', 1, 0),
        ('spb-queue', 'KEMBAK 2026', 'menunggu_ketua', 500000, 'SPB / 018 / KOMITE / XI / 2026', '2026-11-20', 0, 0);
    `)

    db.exec(enableSql)

    expect(db.prepare('SELECT enabled FROM fin_komite_rapbm_versions WHERE version_id=?').get(newId)).toEqual({ enabled: 1 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM fin_komite_budget_balances WHERE active=1 AND cohort=2026').get()).toEqual({ n: 17 })
    expect(db.prepare('SELECT status, fund_review_cycle FROM komite_pengajuan WHERE id=?').get('spb-queue')).toEqual({
      status: 'menunggu_bendahara',
      fund_review_cycle: 1,
    })

    const pos = db.prepare('SELECT group_id FROM fin_komite_budget_balances WHERE active=1 AND available >= 2000000 LIMIT 1').get() as { group_id: string }

    // Historical SPB mapping still succeeds when enabled = 1
    db.prepare(`INSERT INTO fin_komite_allocations (id, pengajuan_id, source, group_id, amount, state, actor_id, historical, mapping_note)
      VALUES ('alloc-hist', 'spb-old', '2026', ?, 1000000, 'locked', '21a62b5b-cfb3-4fb0-8744-25c1f26b448d', 1, 'Pemetaan SPB lama')`).run(pos.group_id)

    // New review & cashflow allocation also succeeds when enabled = 1
    db.prepare(`INSERT INTO fin_komite_allocations (id, pengajuan_id, source, group_id, amount, state, actor_id, historical)
      VALUES ('alloc-new', 'spb-queue', '2026', ?, 500000, 'review', '21a62b5b-cfb3-4fb0-8744-25c1f26b448d', 0)`).run(pos.group_id)

    expect(() => db.exec(enableSql)).toThrow(/komite_write_conflict/)
  })
})
