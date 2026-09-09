import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'

const migration = readFileSync('migrations/0098_merge_dspt_spp.sql', 'utf8')
let db: DatabaseSync

afterEach(() => db?.close())

describe('migrasi izin DSPT & SPP', () => {
  it('menggabungkan izin terluas dan menghapus struktur SPP bulanan', () => {
    db = new DatabaseSync(':memory:')
    db.exec(`
      CREATE TABLE role_features (role TEXT, feature_id TEXT, PRIMARY KEY(role, feature_id));
      CREATE TABLE role_feature_permissions (role TEXT, feature_id TEXT, can_create INTEGER, can_read INTEGER, can_update INTEGER, can_delete INTEGER, updated_at TEXT, PRIMARY KEY(role, feature_id));
      CREATE TABLE user_feature_overrides (user_id TEXT, feature_id TEXT, action TEXT, PRIMARY KEY(user_id, feature_id));
      CREATE TABLE fin_spp_tagihan (id TEXT);
      CREATE TABLE fin_spp_mulai (id TEXT);
      CREATE TABLE fin_spp_setting (id TEXT);
      INSERT INTO role_features VALUES ('bendahara', 'keuangan-spp');
      INSERT INTO role_feature_permissions VALUES ('bendahara', 'keuangan-dspt', 0, 1, 0, 0, NULL);
      INSERT INTO role_feature_permissions VALUES ('bendahara', 'keuangan-spp', 1, 1, 1, 0, NULL);
      INSERT INTO user_feature_overrides VALUES ('user-1', 'keuangan-dspt', 'revoke');
      INSERT INTO user_feature_overrides VALUES ('user-1', 'keuangan-spp', 'grant');
    `)

    db.exec(migration)

    expect(db.prepare("SELECT feature_id FROM role_features WHERE role='bendahara'").get()).toEqual({ feature_id: 'keuangan-dspt' })
    expect(db.prepare("SELECT can_create, can_read, can_update, can_delete FROM role_feature_permissions WHERE role='bendahara'").get())
      .toEqual({ can_create: 1, can_read: 1, can_update: 1, can_delete: 0 })
    expect(db.prepare("SELECT action FROM user_feature_overrides WHERE user_id='user-1'").get()).toEqual({ action: 'grant' })
    expect(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name IN ('fin_spp_tagihan','fin_spp_mulai','fin_spp_setting')").get())
      .toEqual({ count: 0 })
  })
})
