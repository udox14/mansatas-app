import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'

const migration = readFileSync('migrations/0121_merge_discipline_modules.sql', 'utf8')
let db: DatabaseSync

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE "user" (id TEXT PRIMARY KEY, role TEXT, bottom_nav_override TEXT);
    CREATE TABLE user_roles (user_id TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY(user_id, role));
    CREATE TABLE master_roles (value TEXT PRIMARY KEY, mobile_nav_links TEXT);
    CREATE TABLE role_features (role TEXT NOT NULL, feature_id TEXT NOT NULL, PRIMARY KEY(role, feature_id));
    CREATE TABLE role_feature_permissions (
      role TEXT NOT NULL, feature_id TEXT NOT NULL, can_create INTEGER NOT NULL DEFAULT 1,
      can_read INTEGER NOT NULL DEFAULT 1, can_update INTEGER NOT NULL DEFAULT 1,
      can_delete INTEGER NOT NULL DEFAULT 1, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(role, feature_id)
    );
    CREATE TABLE user_feature_overrides (
      user_id TEXT NOT NULL, feature_id TEXT NOT NULL, action TEXT NOT NULL,
      PRIMARY KEY(user_id, feature_id)
    );
    CREATE TABLE feature_display_settings (feature_id TEXT PRIMARY KEY, title TEXT NOT NULL, updated_at TEXT);
    CREATE TABLE sidebar_template_config (id TEXT PRIMARY KEY, groups_json TEXT NOT NULL, updated_at TEXT);
    CREATE TABLE role_sidebar_configs (role TEXT PRIMARY KEY, groups_json TEXT NOT NULL, updated_at TEXT);
    CREATE TABLE user_dashboard_preferences (user_id TEXT PRIMARY KEY, shortcut_ids TEXT NOT NULL, updated_at TEXT);
    CREATE TABLE siswa_pelanggaran (id TEXT PRIMARY KEY, siswa_id TEXT NOT NULL, poin_snapshot INTEGER);

    INSERT INTO role_features VALUES
      ('ked_only', 'kedisiplinan'),
      ('monitor_only', 'monitoring-kedisiplinan'),
      ('both', 'kedisiplinan'),
      ('both', 'monitoring-kedisiplinan');
    INSERT INTO role_feature_permissions (role, feature_id, can_create, can_read, can_update, can_delete)
      VALUES ('monitor_only', 'monitoring-kedisiplinan', 0, 1, 0, 0),
        ('both', 'kedisiplinan', 1, 1, 1, 1),
        ('both', 'monitoring-kedisiplinan', 0, 1, 0, 0);

    INSERT INTO "user" VALUES
      ('u-ked', 'ked_only', '["kedisiplinan"]'),
      ('u-monitor', 'monitor_only', '["monitoring-kedisiplinan"]'),
      ('u-one-revoke', 'both', NULL),
      ('u-both-revoke', 'both', NULL),
      ('u-grant', 'none', NULL),
      ('u-none', 'none', NULL);
    INSERT INTO user_roles VALUES
      ('u-ked', 'ked_only'), ('u-monitor', 'monitor_only'),
      ('u-one-revoke', 'both'), ('u-both-revoke', 'both'),
      ('u-grant', 'none'), ('u-none', 'none');
    INSERT INTO user_feature_overrides VALUES
      ('u-one-revoke', 'kedisiplinan', 'revoke'),
      ('u-both-revoke', 'kedisiplinan', 'revoke'),
      ('u-both-revoke', 'monitoring-kedisiplinan', 'revoke'),
      ('u-grant', 'monitoring-kedisiplinan', 'grant');

    INSERT INTO master_roles VALUES ('monitor_only', '["monitoring-kedisiplinan", "kedisiplinan", "agenda"]');
    INSERT INTO sidebar_template_config VALUES ('default',
      '[{"id":"monitoring-rekap","label":"Monitoring & Rekap","items":["monitoring-agenda","monitoring-kedisiplinan"]},{"id":"kesiswaan-bk","label":"Kesiswaan & BK","items":["kedisiplinan","bk"]}]', 'before');
    INSERT INTO role_sidebar_configs VALUES ('monitor_only',
      '{"groupOrder":["monitoring-rekap","custom"],"itemPlacements":{"monitoring-rekap":["monitoring-kedisiplinan"],"custom":["agenda"]},"hiddenItemIds":[]}', 'before');
    INSERT INTO user_dashboard_preferences VALUES ('u-monitor', '["monitoring-kedisiplinan", "kedisiplinan", "agenda"]', 'before');
    INSERT INTO feature_display_settings VALUES ('monitoring-kedisiplinan', 'Monitoring Kedisiplinan', 'before');
    INSERT INTO siswa_pelanggaran VALUES ('case-1', 'student-1', 5);
  `)
})

afterEach(() => db.close())

function applyMigration() {
  db.exec('BEGIN')
  try {
    db.exec(migration)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

describe('merging the discipline modules', () => {
  it('unions role access, keeps the read-only monitoring grant, and preserves write permissions', () => {
    applyMigration()

    expect(db.prepare("SELECT role, feature_id FROM role_features WHERE feature_id='monitoring-kedisiplinan'").all()).toEqual([])
    expect(db.prepare("SELECT feature_id FROM role_features WHERE role='monitor_only'").all()).toEqual([{ feature_id: 'kedisiplinan' }])
    expect(db.prepare("SELECT can_create, can_read, can_update, can_delete FROM role_feature_permissions WHERE role='monitor_only' AND feature_id='kedisiplinan'").get())
      .toMatchObject({ can_create: 0, can_read: 1, can_update: 0, can_delete: 0 })
    expect(db.prepare("SELECT can_create, can_read, can_update, can_delete FROM role_feature_permissions WHERE role='both' AND feature_id='kedisiplinan'").get())
      .toMatchObject({ can_create: 1, can_read: 1, can_update: 1, can_delete: 1 })
    expect(db.prepare("SELECT can_read, can_create, can_update, can_delete FROM role_feature_permissions WHERE role='ked_only' AND feature_id='kedisiplinan'").get())
      .toMatchObject({ can_read: 1, can_create: 0, can_update: 0, can_delete: 0 })
  })

  it('preserves effective access when combining per-user grants and revokes', () => {
    applyMigration()

    expect(db.prepare("SELECT feature_id, action FROM user_feature_overrides WHERE user_id='u-one-revoke'").all()).toEqual([])
    expect(db.prepare("SELECT feature_id, action FROM user_feature_overrides WHERE user_id='u-both-revoke'").all())
      .toEqual([{ feature_id: 'kedisiplinan', action: 'revoke' }])
    expect(db.prepare("SELECT feature_id, action FROM user_feature_overrides WHERE user_id='u-grant'").all())
      .toEqual([{ feature_id: 'kedisiplinan', action: 'grant' }])
    expect(db.prepare("SELECT COUNT(*) AS count FROM user_feature_overrides WHERE user_id='u-none'").get()).toMatchObject({ count: 0 })
  })

  it('normalizes saved menu, sidebar, mobile, and favorite placements without duplicates', () => {
    applyMigration()

    expect(JSON.parse(String(db.prepare("SELECT groups_json FROM sidebar_template_config WHERE id='default'").get()?.groups_json))).toEqual([
      { id: 'monitoring-rekap', label: 'Monitoring & Rekap', items: ['monitoring-agenda'] },
      { id: 'kesiswaan-bk', label: 'Kesiswaan & BK', items: ['kedisiplinan', 'bk'] },
    ])
    expect(JSON.parse(String(db.prepare("SELECT groups_json FROM role_sidebar_configs WHERE role='monitor_only'").get()?.groups_json))).toEqual({
      groupOrder: ['monitoring-rekap', 'custom'],
      itemPlacements: { 'monitoring-rekap': ['kedisiplinan'], custom: ['agenda'] },
      hiddenItemIds: [],
    })
    expect(JSON.parse(String(db.prepare("SELECT mobile_nav_links FROM master_roles WHERE value='monitor_only'").get()?.mobile_nav_links)))
      .toEqual(['kedisiplinan', 'agenda'])
    expect(JSON.parse(String(db.prepare('SELECT bottom_nav_override FROM "user" WHERE id=\'u-monitor\'').get()?.bottom_nav_override)))
      .toEqual(['kedisiplinan'])
    expect(JSON.parse(String(db.prepare("SELECT shortcut_ids FROM user_dashboard_preferences WHERE user_id='u-monitor'").get()?.shortcut_ids)))
      .toEqual(['kedisiplinan', 'agenda'])
  })

  it('sets one canonical feature label, preserves discipline records, and is safe to rerun', () => {
    applyMigration()
    const beforeSecondRun = {
      features: db.prepare('SELECT role, feature_id FROM role_features ORDER BY role, feature_id').all(),
      permissions: db.prepare('SELECT role, feature_id, can_create, can_read, can_update, can_delete FROM role_feature_permissions ORDER BY role, feature_id').all(),
      overrides: db.prepare('SELECT user_id, feature_id, action FROM user_feature_overrides ORDER BY user_id, feature_id').all(),
      label: db.prepare("SELECT feature_id, title FROM feature_display_settings WHERE feature_id='kedisiplinan'").get(),
      cases: db.prepare('SELECT * FROM siswa_pelanggaran').all(),
    }
    expect(beforeSecondRun.label).toMatchObject({ feature_id: 'kedisiplinan', title: 'Kedisiplinan' })

    applyMigration()
    expect({
      features: db.prepare('SELECT role, feature_id FROM role_features ORDER BY role, feature_id').all(),
      permissions: db.prepare('SELECT role, feature_id, can_create, can_read, can_update, can_delete FROM role_feature_permissions ORDER BY role, feature_id').all(),
      overrides: db.prepare('SELECT user_id, feature_id, action FROM user_feature_overrides ORDER BY user_id, feature_id').all(),
      label: db.prepare("SELECT feature_id, title FROM feature_display_settings WHERE feature_id='kedisiplinan'").get(),
      cases: db.prepare('SELECT * FROM siswa_pelanggaran').all(),
    }).toEqual(beforeSecondRun)
  })
})
