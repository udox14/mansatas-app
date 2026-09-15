import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'

function baseDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE "user"(id TEXT PRIMARY KEY);
    CREATE TABLE pmb_pendaftar(
      id TEXT PRIMARY KEY,
      tahun_ajaran TEXT,
      nisn TEXT,
      nik TEXT,
      no_pendaftaran TEXT,
      daftar_ulang_status TEXT,
      updated_at TEXT,
      siswa_id TEXT,
      konfirmasi_daftar_ulang TEXT,
      konfirmasi_rapat TEXT,
      alasan_tidak_hadir TEXT
    );
    CREATE TABLE fin_dspt(id TEXT PRIMARY KEY,siswa_id TEXT,nominal_target INTEGER);
    CREATE TABLE fin_dspt_audit_log(id TEXT PRIMARY KEY);
    CREATE TABLE system_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT);
    CREATE TABLE pmb_pengaturan(key TEXT PRIMARY KEY,value TEXT,is_active INTEGER);
  `)
  return db
}

describe('migration 0108 PMB-DSPT', () => {
  const sql = readFileSync(new URL('./0108_pmb_dspt_integration.sql', import.meta.url), 'utf8')

  it('applies additively and seeds finance configuration', () => {
    const db = baseDb()
    db.exec(sql)
    const columns = db.prepare(`PRAGMA table_info('pmb_pendaftar')`).all().map((row: any) => row.name)
    expect(columns).toContain('konfirmasi_daftar_ulang')
    expect(columns).toContain('daftar_ulang_diproses_oleh')
    expect(db.prepare(`SELECT value FROM system_settings WHERE key='keuangan_dspt_entry_mode'`).get()).toEqual({ value: 'manual' })
    db.close()
  })

  it('rejects duplicate PMB identity within the same academic year', () => {
    const db = baseDb()
    db.exec(`INSERT INTO pmb_pendaftar(id,tahun_ajaran,nisn,nik,no_pendaftaran) VALUES ('1','2026/2027','1','11','001'),('2','2026/2027','1','22','002')`)
    expect(() => db.exec(sql)).toThrow(/unique/i)
    db.close()
  })
})
