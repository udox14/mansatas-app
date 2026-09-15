import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'

let sqlite: DatabaseSync

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE "user" (id TEXT PRIMARY KEY);
    CREATE TABLE penugasan_mengajar (id TEXT PRIMARY KEY, guru_id TEXT);
    CREATE TABLE jadwal_mengajar (id TEXT PRIMARY KEY, penugasan_id TEXT REFERENCES penugasan_mengajar(id));
    CREATE TABLE jadwal_guru_piket (id TEXT PRIMARY KEY, user_id TEXT);
    CREATE TABLE guru_ppl_mapping (
      id TEXT PRIMARY KEY, guru_ppl_id TEXT REFERENCES "user"(id), guru_utama_id TEXT REFERENCES "user"(id),
      jadwal_mengajar_id TEXT REFERENCES jadwal_mengajar(id), jadwal_piket_id TEXT REFERENCES jadwal_guru_piket(id), created_at TEXT
    );
    CREATE TABLE agenda_guru (id TEXT PRIMARY KEY, tanggal TEXT);
    CREATE TABLE nilai_harian_header (id TEXT PRIMARY KEY, created_by TEXT REFERENCES "user"(id));
    INSERT INTO "user" VALUES ('guru'), ('ppl');
    INSERT INTO penugasan_mengajar VALUES ('pen', 'guru');
    INSERT INTO jadwal_mengajar VALUES ('jam-1', 'pen'), ('jam-2', 'pen');
    INSERT INTO jadwal_guru_piket VALUES ('piket', 'guru');
    INSERT INTO guru_ppl_mapping VALUES
      ('m1', 'ppl', 'guru', 'jam-1', NULL, CURRENT_TIMESTAMP),
      ('m2', 'ppl', 'guru', 'jam-2', NULL, CURRENT_TIMESTAMP),
      ('m3', 'ppl', 'guru', NULL, 'piket', CURRENT_TIMESTAMP),
      ('m4', 'ppl', 'guru', NULL, 'piket', CURRENT_TIMESTAMP);
    INSERT INTO nilai_harian_header VALUES ('nilai', 'guru');
  `)
})

afterEach(() => sqlite.close())

describe('migrasi konsolidasi Guru PPL', () => {
  it('menggabungkan mapping per jam menjadi satu penugasan dan mempertahankan piket', () => {
    const migration = readFileSync(new URL('../migrations/0105_consolidate_guru_ppl_delegation.sql', import.meta.url), 'utf8')
    sqlite.exec(migration)
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM guru_ppl_mapping WHERE penugasan_mengajar_id=?').get('pen')).toMatchObject({ n: 1 })
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM guru_ppl_mapping WHERE jadwal_piket_id=?').get('piket')).toMatchObject({ n: 1 })
    expect(sqlite.prepare('SELECT diinput_oleh, diubah_oleh FROM nilai_harian_header WHERE id=?').get('nilai')).toMatchObject({ diinput_oleh: 'guru', diubah_oleh: null })
    expect(() => sqlite.exec(`INSERT INTO guru_ppl_mapping (id,guru_ppl_id,guru_utama_id,penugasan_mengajar_id) VALUES ('dup','ppl','guru','pen')`)).toThrow()
  })
})
