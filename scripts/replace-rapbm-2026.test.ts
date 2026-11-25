import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RAPBM_SCHEMA } from '@/lib/rapbm-schema'

const migration0127 = readFileSync(new URL('../migrations/0127_komite_fund_sources.sql', import.meta.url), 'utf8')
const oldId = 'b18f2231-995c-4ea5-b3cc-de9b73076ff7'
const oldSha = 'f3005a3c814857c2b02c38e4c7551b94a7b1f15fd6a143442e11e321be16293e'
const newId = 'c26a2026-1125-4e60-95a8-63ce80123b4b'
const newSha = '63ce80123b4b2dff0cc8cbc5ca0d0b48f57f2c25f4e7515fcee694cb97eb0505'

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
    CREATE TABLE komite_pengajuan (id TEXT PRIMARY KEY, judul TEXT, status TEXT, nominal INTEGER, nomor_spb TEXT);
    CREATE TABLE komite_pengajuan_reviews (pengajuan_id TEXT, version_number INTEGER, stage TEXT, workflow_version INTEGER);
    CREATE TABLE activity_logs (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      actor_user_id TEXT, actor_name TEXT, actor_roles TEXT NOT NULL DEFAULT '[]',
      module TEXT NOT NULL, action TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'info',
      summary TEXT NOT NULL, entity_type TEXT, entity_id TEXT, entity_label TEXT,
      before_json TEXT, after_json TEXT, metadata_json TEXT
    );
  `)
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
    INSERT INTO fin_rapbm_groups (id, version_id, section, sort_order, label, account, source_ref, subtotal_ref, apbn, komite, total)
    VALUES ('old-group-1', '${oldId}', 'expense', 1, 'Belanja Keperluan Perkantoran', '521111', 'Sheet1!B22:J22', 'Sheet1!H31:J31', 343293000, 360320000, 699413000);
    INSERT INTO fin_rapbm_items (id, group_id, sort_order, description, account, volume, unit, source_ref, apbn, komite, total)
    VALUES ('old-item-1', 'old-group-1', 1, '1. Belanja Internet', '521111', '12', 'Bulan', 'Sheet1!E23:J23', 46440000, 0, 46440000);
    UPDATE fin_rapbm_versions SET status = 'published', published_at = '2026-11-01 12:56:30', published_by = '21a62b5b-cfb3-4fb0-8744-25c1f26b448d', notes_acknowledged = 1 WHERE id = '${oldId}';
    UPDATE fin_rapbm_years SET active_version_id = '${oldId}', publication_revision = 1 WHERE year = 2026;
  `)

  db.exec(migration0127)

  db.exec(`
    INSERT INTO fin_komite_rapbm_versions (version_id, cohort, previous_version_id, activated_by, enabled)
    VALUES ('${oldId}', 2026, NULL, '21a62b5b-cfb3-4fb0-8744-25c1f26b448d', 0);
    INSERT INTO fin_komite_budget_positions (group_id, amount, reason)
    VALUES ('old-group-1', 360320000, NULL);
  `)
})

afterEach(() => db.close())

function runReplacement() {
  const sql = readFileSync(new URL('./replace-rapbm-2026.sql', import.meta.url), 'utf8')
  db.exec('BEGIN')
  try {
    db.exec(sql)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

describe('Authorized replacement of unactivated RAPBM 2026', () => {
  it('replaces the unactivated 2026 version atomically, restores all immutability triggers, and records an audit entry', () => {
    const triggersBefore = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all()
    runReplacement()

    const versions = db.prepare('SELECT id, year, version, status, komite_cohort, sheet, source_sha256, notes_acknowledged FROM fin_rapbm_versions').all()
    expect(versions).toEqual([
      {
        id: newId,
        year: 2026,
        version: 1,
        status: 'published',
        komite_cohort: 2026,
        sheet: 'RAPBM 2026',
        source_sha256: newSha,
        notes_acknowledged: 1,
      },
    ])

    expect(db.prepare('SELECT * FROM fin_rapbm_years WHERE year=2026').get()).toEqual({
      year: 2026,
      active_version_id: newId,
      publication_revision: 1,
    })

    expect(db.prepare('SELECT COUNT(*) AS n FROM fin_rapbm_groups WHERE version_id=? AND section=?').get(newId, 'income')?.n).toBe(2)
    expect(db.prepare('SELECT COUNT(*) AS n FROM fin_rapbm_groups WHERE version_id=? AND section=?').get(newId, 'expense')?.n).toBe(17)
    expect(db.prepare(`SELECT COUNT(*) AS n FROM fin_rapbm_items i JOIN fin_rapbm_groups g ON g.id=i.group_id WHERE g.version_id=? AND g.section='expense'`).get(newId)?.n).toBe(105)

    expect(db.prepare('SELECT version_id, cohort, enabled FROM fin_komite_rapbm_versions').all()).toEqual([
      { version_id: newId, cohort: 2026, enabled: 0 },
    ])
    expect(db.prepare('SELECT COUNT(*) AS n, SUM(amount) AS total FROM fin_komite_budget_positions').get()).toEqual({
      n: 17,
      total: 2212200000,
    })

    const logs = db.prepare("SELECT action, entity_id, before_json, after_json FROM activity_logs WHERE module='rapbm'").all()
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('replace_unactivated_version')
    expect(logs[0].entity_id).toBe(newId)
    expect(JSON.parse(String(logs[0].before_json)).version_id).toBe(oldId)
    expect(JSON.parse(String(logs[0].after_json)).expense_komite).toBe(2212200000)

    const triggersAfter = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all()
    expect(triggersAfter).toEqual(triggersBefore)
    expect(() => db.prepare('DELETE FROM fin_rapbm_versions WHERE id=?').run(newId)).toThrow(/tidak boleh dihapus/)
    expect(() => db.exec('DELETE FROM fin_rapbm_groups')).toThrow(/tidak boleh dihapus/)
    expect(() => db.exec('DELETE FROM fin_rapbm_items')).toThrow(/tidak boleh dihapus/)
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])

    // Idempotency / replay guard: running a second time aborts without touching the new version
    expect(() => runReplacement()).toThrow(/komite_write_conflict/)
    expect(db.prepare('SELECT id FROM fin_rapbm_versions').all()).toEqual([{ id: newId }])
  })

  it.each(['enabled', 'allocated', 'sha_mismatch'])('aborts without changing anything if %s', scenario => {
    if (scenario === 'enabled') {
      db.exec(`UPDATE fin_komite_rapbm_versions SET enabled = 1 WHERE version_id = '${oldId}'`)
    } else if (scenario === 'allocated') {
      db.exec(`
        INSERT INTO fin_cashflow_categories (id, direction, name, sort_order, is_system) VALUES ('cat1', 'expense', 'Belanja', 1, 0);
        INSERT INTO fin_cashflow_entries (id, direction, category_id, transaction_date, amount, method, counterparty, description, is_void, created_at)
        VALUES ('cf1', 'expense', 'cat1', '2026-11-20', 100000, 'tunai', 'Vendor', 'Beli ATK', 0, '2026-11-20');
        INSERT INTO fin_komite_allocations (id, cashflow_id, source, group_id, amount, state, actor_id, historical)
        VALUES ('alloc1', 'cf1', '2026', 'old-group-1', 100000, 'realized', 'dd3f7cfea48304d777433295a671c3db', 1);
      `)
    } else if (scenario === 'sha_mismatch') {
      db.exec('DROP TRIGGER rapbm_version_immutable')
      db.exec(`UPDATE fin_rapbm_versions SET source_sha256 = 'other' WHERE id = '${oldId}'`)
    }

    expect(() => runReplacement()).toThrow(/komite_write_conflict/)
    expect(db.prepare('SELECT id FROM fin_rapbm_versions').all()).toEqual([{ id: oldId }])
  })
})
