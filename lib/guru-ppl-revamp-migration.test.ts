import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'

let sqlite: DatabaseSync

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE "user" (id TEXT PRIMARY KEY);
    CREATE TABLE role_features (role TEXT, feature_id TEXT);
    CREATE TABLE role_feature_permissions (role TEXT, feature_id TEXT, can_create INTEGER, can_read INTEGER, can_update INTEGER, can_delete INTEGER, PRIMARY KEY(role, feature_id));
    CREATE TABLE penugasan_mengajar (id TEXT PRIMARY KEY, guru_id TEXT);
    CREATE TABLE jadwal_mengajar (id TEXT PRIMARY KEY, penugasan_id TEXT REFERENCES penugasan_mengajar(id), hari INTEGER, jam_ke INTEGER);
    CREATE TABLE pengaturan_shift_piket (id INTEGER PRIMARY KEY, nama_shift TEXT, jam_mulai INTEGER, jam_selesai INTEGER);
    CREATE TABLE jadwal_guru_piket (id TEXT PRIMARY KEY, user_id TEXT, hari INTEGER, shift_id INTEGER);
    CREATE TABLE guru_ppl_mapping (
      id TEXT PRIMARY KEY, guru_ppl_id TEXT REFERENCES "user"(id), guru_utama_id TEXT REFERENCES "user"(id),
      jadwal_mengajar_id TEXT REFERENCES jadwal_mengajar(id), jadwal_piket_id TEXT REFERENCES jadwal_guru_piket(id), created_at TEXT
    );
    CREATE TABLE agenda_guru (id TEXT PRIMARY KEY, tanggal TEXT);
    CREATE TABLE nilai_harian_header (id TEXT PRIMARY KEY, created_by TEXT REFERENCES "user"(id));
    INSERT INTO "user" VALUES ('guru'), ('ppl-a'), ('ppl-b'), ('admin');
    INSERT INTO role_features VALUES ('super_admin', 'kelola-ppl');
    INSERT INTO penugasan_mengajar VALUES ('pen', 'guru');
    INSERT INTO jadwal_mengajar VALUES ('jam', 'pen', 1, 1);
    INSERT INTO pengaturan_shift_piket VALUES (1, 'Shift 1', 1, 5);
    INSERT INTO jadwal_guru_piket VALUES ('piket', 'guru', 1, 1);
    INSERT INTO guru_ppl_mapping VALUES
      ('lama', 'ppl-a', 'guru', 'jam', NULL, '2026-01-02 03:00:00'),
      ('piket-lama', 'ppl-a', 'guru', NULL, 'piket', '2026-01-02 03:00:00');
    INSERT INTO nilai_harian_header VALUES ('nilai', 'guru');
  `)
  sqlite.exec(readFileSync(new URL('../migrations/0105_consolidate_guru_ppl_delegation.sql', import.meta.url), 'utf8'))
  sqlite.exec(readFileSync(new URL('../migrations/0106_revamp_guru_ppl.sql', import.meta.url), 'utf8'))
  // Simulasikan migrasi yang terputus di Console D1 dan kehilangan trigger INSERT.
  sqlite.exec('DROP TRIGGER trg_guru_ppl_mapping_validate_insert')
  sqlite.exec(readFileSync(new URL('../migrations/0107_finish_guru_ppl_revamp.sql', import.meta.url), 'utf8'))
  sqlite.exec(readFileSync(new URL('../migrations/0108_simplify_guru_ppl_mapping.sql', import.meta.url), 'utf8'))
  sqlite.exec(readFileSync(new URL('../migrations/0109_remove_ppl_piket_mapping.sql', import.meta.url), 'utf8'))
})

afterEach(() => sqlite.close())

describe('migrasi revamp Guru PPL', () => {
  it('memulihkan kedua trigger validasi setelah eksekusi Console D1 terputus', () => {
    expect(sqlite.prepare(`SELECT count(*) AS total FROM sqlite_master WHERE type='trigger' AND name IN ('trg_guru_ppl_mapping_validate_insert','trg_guru_ppl_mapping_validate_update')`).get())
      .toMatchObject({ total: 2 })
  })

  it('memigrasikan tanggal lama dan menjaga satu kampus per akun', () => {
    expect(sqlite.prepare('SELECT berlaku_mulai, berlaku_selesai FROM guru_ppl_mapping WHERE id=?').get('lama'))
      .toMatchObject({ berlaku_mulai: '2026-01-02', berlaku_selesai: null })
    expect(sqlite.prepare('SELECT jadwal_snapshot FROM guru_ppl_mapping WHERE id=?').get('lama'))
      .toMatchObject({ jadwal_snapshot: '[{"hari":1,"jamKe":1}]' })
    expect(sqlite.prepare('SELECT diinput_oleh, diubah_oleh FROM nilai_harian_header WHERE id=?').get('nilai'))
      .toMatchObject({ diinput_oleh: 'guru', diubah_oleh: 'guru' })
    expect(sqlite.prepare('SELECT id FROM guru_ppl_mapping WHERE id=?').get('piket-lama')).toBeUndefined()
    sqlite.exec(`INSERT INTO guru_ppl_kampus(id,nama,singkatan) VALUES ('k1','Universitas Contoh','UC')`)
    sqlite.exec(`INSERT INTO guru_ppl_profile(user_id,kampus_id) VALUES ('ppl-a','k1')`)
    expect(() => sqlite.exec(`INSERT INTO guru_ppl_profile(user_id,kampus_id) VALUES ('ppl-a',NULL)`)).toThrow()
    expect(() => sqlite.exec(`INSERT INTO guru_ppl_kampus(id,nama) VALUES ('k2','universitas contoh')`)).toThrow()
  })

  it('menjaga satu PPL aktif per KBM dan menolak mapping piket', () => {
    expect(() => sqlite.exec(`INSERT INTO guru_ppl_mapping(id,guru_ppl_id,guru_utama_id,penugasan_mengajar_id,berlaku_mulai,berlaku_selesai) VALUES ('bentrok','ppl-b','guru','pen','0001-01-01',NULL)`)).toThrow(/UNIQUE/)
    expect(() => sqlite.exec(`INSERT INTO guru_ppl_mapping(id,guru_ppl_id,guru_utama_id,jadwal_piket_id,berlaku_mulai,berlaku_selesai) VALUES ('piket-b','ppl-b','guru','piket','0001-01-01',NULL)`)).toThrow(/hanya menerima penugasan KBM/)
  })

  it('menjaga validitas pemilik tugas dan audit koreksi unik per kewajiban', () => {
    expect(() => sqlite.exec(`INSERT INTO guru_ppl_mapping(id,guru_ppl_id,guru_utama_id,penugasan_mengajar_id,berlaku_mulai,berlaku_selesai) VALUES ('diri','guru','guru','pen','0001-01-01',NULL)`)).toThrow(/dirinya sendiri/)
    sqlite.exec(`INSERT INTO guru_ppl_kehadiran_override(id,mapping_id,tanggal,status,catatan,diubah_oleh) VALUES ('o1','lama','2026-01-05','IZIN','Surat kampus','admin')`)
    expect(() => sqlite.exec(`INSERT INTO guru_ppl_kehadiran_override(id,mapping_id,tanggal,status,diubah_oleh) VALUES ('o2','lama','2026-01-05','HADIR','admin')`)).toThrow()
  })
})
