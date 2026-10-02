import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const { buildArchivedCleanup } = createRequire(import.meta.url)('../scripts/prepare-retired-modules-cleanup.js')

const migration = readFileSync('migrations/0113_remove_sarpras_whatsapp.sql', 'utf8')
const targets = ['sarpras_aset', 'sarpras_kategori', 'wa_daily_locks', 'wa_campaign_recipients', 'wa_outbox', 'wa_campaigns']
let db: DatabaseSync

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE "user" (id TEXT PRIMARY KEY, bottom_nav_override TEXT, nomor_whatsapp TEXT, jabatan_struktural_id TEXT);
    CREATE TABLE siswa (id TEXT PRIMARY KEY, nomor_whatsapp TEXT);
    CREATE TABLE kelas (id TEXT PRIMARY KEY);
    CREATE TABLE master_roles (value TEXT PRIMARY KEY, mobile_nav_links TEXT);
    CREATE TABLE role_features (role TEXT, feature_id TEXT);
    CREATE TABLE role_feature_permissions (role TEXT, feature_id TEXT, can_read INTEGER, can_create INTEGER, can_update INTEGER, can_delete INTEGER);
    CREATE TABLE user_feature_overrides (user_id TEXT, feature_id TEXT, action TEXT);
    CREATE TABLE feature_display_settings (feature_id TEXT PRIMARY KEY, title TEXT);
    CREATE TABLE system_settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE sidebar_template_config (id TEXT PRIMARY KEY, groups_json TEXT, updated_at TEXT);
    CREATE TABLE role_sidebar_configs (role TEXT PRIMARY KEY, groups_json TEXT, updated_at TEXT);
    CREATE TABLE notifications (id TEXT, message TEXT);
    CREATE TABLE audit_log (id TEXT, feature TEXT);
    CREATE TABLE financial_history (id TEXT, amount INTEGER);
    INSERT INTO "user" VALUES ('u', '["sarpras","agenda","whatsapp","sarpras"]', '628123456789', 'jbt_waka_sarpras');
    INSERT INTO siswa VALUES ('s', '628111111111');
    INSERT INTO kelas VALUES ('k');
    INSERT INTO master_roles VALUES ('wakamad', '["whatsapp","monitoring-pramubakti","sarpras"]');
    INSERT INTO role_features VALUES ('wakamad','monitoring-pramubakti'), ('wakamad','sarpras'), ('wakamad','whatsapp');
    INSERT INTO role_feature_permissions (role,feature_id,can_read) VALUES ('wakamad','monitoring-pramubakti',1), ('wakamad','sarpras',1), ('wakamad','whatsapp',1);
    INSERT INTO user_feature_overrides VALUES ('u','agenda','grant'), ('u','whatsapp','grant'), ('u','sarpras','revoke');
    INSERT INTO feature_display_settings VALUES ('agenda','Jurnal'), ('sarpras','Inventaris'), ('whatsapp','Kirim WA');
    INSERT INTO system_settings VALUES ('cron_whatsapp_enabled','1'), ('whatsapp_provider','wablas'), ('wablas_token','test'),
      ('parent_login_help_whatsapp','628123456789'), ('keuangan_komite_whatsapp','628111111111'), ('cron_other_enabled','1');
    INSERT INTO notifications VALUES ('n','Tetap tersimpan');
    INSERT INTO audit_log VALUES ('a','sarpras');
    INSERT INTO financial_history VALUES ('f',125000);
  `)
  db.exec(readFileSync('migrations/schema-migration-sarpras.sql', 'utf8'))
  db.exec(readFileSync('migrations/0055_add_whatsapp_messaging.sql', 'utf8'))
})
afterEach(() => db.close())

function apply(sql = migration) {
  // D1 migration/batch semantics: the whole migration succeeds or rolls back.
  db.exec('BEGIN')
  try {
    db.exec(sql)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function snapshot() {
  const schema = db.prepare("SELECT name, type, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all()
  const data = Object.fromEntries(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .map(row => [String(row.name), db.prepare(`SELECT * FROM "${String(row.name).replaceAll('"', '""')}" ORDER BY rowid`).all()]))
  return { schema, data }
}

describe('retiring unused modules safely', () => {
  it('drops empty module tables, cleans access/settings, and preserves shared data', () => {
    const preserved = Object.fromEntries(['siswa', 'notifications', 'audit_log', 'financial_history']
      .map(table => [table, db.prepare(`SELECT * FROM ${table}`).all()]))
    apply()
    expect(db.prepare("SELECT name FROM sqlite_schema WHERE name LIKE '_retired_module_%'").all()).toEqual([])
    for (const target of targets) expect(db.prepare('SELECT name FROM sqlite_schema WHERE name=?').get(target)).toBeUndefined()
    for (const table of ['role_features', 'role_feature_permissions', 'user_feature_overrides', 'feature_display_settings']) {
      expect(db.prepare(`SELECT * FROM ${table} WHERE feature_id IN ('sarpras','whatsapp')`).all()).toEqual([])
      expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()).toMatchObject({ n: 1 })
    }
    expect(db.prepare('SELECT * FROM "user"').get()).toMatchObject({ bottom_nav_override: '["agenda"]', nomor_whatsapp: '628123456789', jabatan_struktural_id: 'jbt_waka_sarpras' })
    expect(db.prepare('SELECT mobile_nav_links FROM master_roles').get()).toMatchObject({ mobile_nav_links: '["monitoring-pramubakti"]' })
    expect(db.prepare('SELECT key FROM system_settings ORDER BY key').all().map(row => row.key)).toEqual(['cron_other_enabled', 'keuangan_komite_whatsapp', 'parent_login_help_whatsapp'])
    for (const [table, rows] of Object.entries(preserved)) expect(db.prepare(`SELECT * FROM ${table}`).all()).toEqual(rows)
  })

  it('preserves sidebar groups, labels, order, other overrides, and unrelated JSON bytes', () => {
    const template = [{ id: 'sarpras', label: 'whatsapp', items: ['agenda', 'sarpras', 'whatsapp', 'sarpras', 'settings-notifications'] }, { id: 'empty', label: 'Empty', items: ['sarpras'] }]
    const override = { groupOrder: ['sarpras', 'custom'], hiddenGroupIds: ['whatsapp'], groupLabels: { custom: 'whatsapp' }, hiddenItemIds: ['whatsapp', 'agenda', 'sarpras'], itemPlacements: { custom: ['sarpras', 'agenda', 'whatsapp'], 'quoted.group': ['whatsapp', 'surat'] } }
    db.prepare('INSERT INTO sidebar_template_config VALUES (?,?,?)').run('default', JSON.stringify(template), 'before')
    db.prepare('INSERT INTO role_sidebar_configs VALUES (?,?,?)').run('wakamad', JSON.stringify(override), 'before')
    db.prepare('INSERT INTO role_sidebar_configs VALUES (?,?,?)').run('legacy', JSON.stringify(template), 'before')
    const untouched = '[  { "id": "custom", "label": "Unchanged", "items": ["agenda"] }  ]'
    db.prepare('INSERT INTO sidebar_template_config VALUES (?,?,?)').run('untouched', untouched, 'before')
    apply()
    expect(JSON.parse(String(db.prepare("SELECT groups_json FROM sidebar_template_config WHERE id='default'").get()?.groups_json))).toEqual([
      { id: 'sarpras', label: 'whatsapp', items: ['agenda', 'settings-notifications'] }, { id: 'empty', label: 'Empty', items: [] },
    ])
    expect(JSON.parse(String(db.prepare("SELECT groups_json FROM role_sidebar_configs WHERE role='wakamad'").get()?.groups_json))).toEqual({
      ...override, hiddenItemIds: ['agenda'], itemPlacements: { custom: ['agenda'], 'quoted.group': ['surat'] },
    })
    expect(JSON.parse(String(db.prepare("SELECT groups_json FROM role_sidebar_configs WHERE role='legacy'").get()?.groups_json))[0].items).toEqual(['agenda', 'settings-notifications'])
    expect(db.prepare("SELECT groups_json, updated_at FROM sidebar_template_config WHERE id='untouched'").get()).toMatchObject({ groups_json: untouched, updated_at: 'before' })
  })

  it('works with some/all module tables missing and is safe to repeat', () => {
    db.exec('DROP TABLE wa_daily_locks; DROP TABLE wa_campaign_recipients; DROP TABLE sarpras_aset;')
    apply()
    const first = snapshot()
    apply()
    expect(snapshot()).toEqual(first)
  })

  it('accepts null/empty default navigation without resetting it', () => {
    db.exec(`UPDATE "user" SET bottom_nav_override=NULL; UPDATE master_roles SET mobile_nav_links=''; INSERT INTO role_sidebar_configs VALUES ('empty','','before');`)
    apply()
    expect(db.prepare('SELECT bottom_nav_override FROM "user"').get()?.bottom_nav_override).toBeNull()
    expect(db.prepare('SELECT mobile_nav_links FROM master_roles').get()?.mobile_nav_links).toBe('')
    expect(db.prepare('SELECT groups_json FROM role_sidebar_configs').get()?.groups_json).toBe('')
  })

  it.each([
    ['sarpras_kategori', "INSERT INTO sarpras_kategori(id,nama) VALUES ('x','Kategori')"],
    ['sarpras_aset', "PRAGMA foreign_keys=OFF; INSERT INTO sarpras_aset(id,tanggal_pembukuan,kategori_id,nama_barang) VALUES ('x','2026-10-01','missing','Aset'); PRAGMA foreign_keys=ON"],
    ['wa_campaigns', "INSERT INTO wa_campaigns(id,title,body_text) VALUES ('x','Judul','Pesan')"],
    ['wa_campaign_recipients', "PRAGMA foreign_keys=OFF; INSERT INTO wa_campaign_recipients(id,campaign_id,recipient_phone) VALUES ('x','missing','628123456789'); PRAGMA foreign_keys=ON"],
    ['wa_outbox', "INSERT INTO wa_outbox(id,recipient_phone) VALUES ('x','628123456789')"],
    ['wa_daily_locks', "INSERT INTO wa_daily_locks(id,tanggal,recipient_phone,purpose) VALUES ('x','2026-10-01','628123456789','custom')"],
  ])('rolls back everything if %s contains even one row', (_name, seed) => {
    db.exec(seed)
    const before = snapshot()
    expect(() => apply()).toThrow('retired_modules_must_be_empty')
    expect(snapshot()).toEqual(before)
  })

  it.each([
    'CREATE TABLE external_ref (id TEXT, asset_id TEXT REFERENCES sarpras_aset(id))',
    'CREATE VIEW external_view AS SELECT * FROM wa_outbox',
    'CREATE TRIGGER external_trigger AFTER INSERT ON siswa BEGIN DELETE FROM wa_outbox; END',
  ])('rejects external dependencies without making changes: %s', schema => {
    db.exec(schema)
    const before = snapshot()
    expect(() => apply()).toThrow('retired_modules_have_external_dependencies')
    expect(snapshot()).toEqual(before)
  })

  it.each([
    "UPDATE \"user\" SET bottom_nav_override='broken'",
    "UPDATE master_roles SET mobile_nav_links='{}'",
    "INSERT INTO sidebar_template_config VALUES ('default','broken','before')",
    "INSERT INTO role_sidebar_configs VALUES ('wakamad','null','before')",
  ])('rejects invalid navigation before cleanup: %s', seed => {
    db.exec(seed)
    const before = snapshot()
    expect(() => apply()).toThrow('retired_modules_invalid_navigation_json')
    expect(snapshot()).toEqual(before)
  })
})

describe('explicit archived WA cleanup', () => {
  function seedAndArchive() {
    db.exec("INSERT INTO wa_outbox(id,recipient_phone,body_text) VALUES ('message','628123456789','Pesan orang tua')")
    const schema = db.prepare("SELECT sql FROM sqlite_schema WHERE name='wa_outbox'").get()?.sql
    const row = db.prepare('SELECT * FROM wa_outbox').get()!
    const values = Object.values(row).map(value => value === null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`)
    return `${schema}; INSERT INTO wa_outbox VALUES (${values.join(',')});`
  }

  it('removes only exactly archived messages, then runs the guarded migration', () => {
    const sql = buildArchivedCleanup(seedAndArchive(), migration)
    const contact = db.prepare('SELECT nomor_whatsapp FROM siswa').get()
    apply(sql)
    expect(db.prepare("SELECT name FROM sqlite_schema WHERE name='wa_outbox' OR name LIKE '_retired_%'").all()).toEqual([])
    expect(db.prepare('SELECT nomor_whatsapp FROM siswa').get()).toEqual(contact)
  })

  it('supports an archived outbox with its empty campaign/lock tables already missing', () => {
    const sql = buildArchivedCleanup(seedAndArchive(), migration)
    db.exec('DROP TABLE wa_daily_locks; DROP TABLE wa_campaign_recipients; DROP TABLE wa_campaigns;')
    apply(sql)
    expect(db.prepare("SELECT name FROM sqlite_schema WHERE name LIKE 'wa_%'").all()).toEqual([])
  })

  it.each(['new message', 'changed message'])('rolls back if production has a %s after export', kind => {
    const sql = buildArchivedCleanup(seedAndArchive(), migration)
    if (kind === 'new message') db.exec("INSERT INTO wa_outbox(id,recipient_phone) VALUES ('new','628111111111')")
    else db.exec("UPDATE wa_outbox SET body_text='Pesan berubah'")
    const before = snapshot()
    expect(() => apply(sql)).toThrow('wa_archive_must_match_current_outbox')
    expect(snapshot()).toEqual(before)
  })

  it('also rolls back the outbox purge when another module table has data', () => {
    const sql = buildArchivedCleanup(seedAndArchive(), migration)
    db.exec("INSERT INTO sarpras_kategori(id,nama) VALUES ('nonempty','Kategori')")
    const before = snapshot()
    expect(() => apply(sql)).toThrow('retired_modules_must_be_empty')
    expect(snapshot()).toEqual(before)
  })
})
