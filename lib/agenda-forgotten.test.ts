import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import {
  canReviewForgottenAgendaForRoles,
  isForgottenAgendaRequestWindow,
  normalizeForgottenMonthlyLimit,
} from './agenda-forgotten'

describe('forgotten agenda policy', () => {
  it('normalizes monthly limits without allowing negative values', () => {
    expect(normalizeForgottenMonthlyLimit(2)).toBe(2)
    expect(normalizeForgottenMonthlyLimit(2.9)).toBe(2)
    expect(normalizeForgottenMonthlyLimit(-4)).toBe(0)
    expect(normalizeForgottenMonthlyLimit('invalid', 2)).toBe(2)
  })

  it('opens only after the block ends on the same WIB date', () => {
    const base = { tanggal: '2026-09-21', today: '2026-09-21', endMinutes: 600, timeRestrictionEnabled: true }
    expect(isForgottenAgendaRequestWindow({ ...base, currentMinutes: 599 })).toBe(false)
    expect(isForgottenAgendaRequestWindow({ ...base, currentMinutes: 600 })).toBe(true)
    expect(isForgottenAgendaRequestWindow({ ...base, tanggal: '2026-09-20', currentMinutes: 700 })).toBe(false)
    expect(isForgottenAgendaRequestWindow({ ...base, currentMinutes: 700, timeRestrictionEnabled: false })).toBe(false)
  })

  it('allows only super admin and curriculum vice principal to review', () => {
    expect(canReviewForgottenAgendaForRoles(['super_admin'], null)).toBe(true)
    expect(canReviewForgottenAgendaForRoles(['wakamad'], 'jbt_waka_kurikulum')).toBe(true)
    expect(canReviewForgottenAgendaForRoles(['wakamad'], 'jbt_waka_sarpras')).toBe(false)
    expect(canReviewForgottenAgendaForRoles(['admin_tu'], null)).toBe(false)
    expect(canReviewForgottenAgendaForRoles(['kepsek'], null)).toBe(false)
    expect(canReviewForgottenAgendaForRoles(['guru'], null)).toBe(false)
  })
})

describe('forgotten agenda migration and quota contract', () => {
  let sqlite: DatabaseSync

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:')
    sqlite.exec(`PRAGMA foreign_keys = ON;
      CREATE TABLE "user" (id TEXT PRIMARY KEY);
      CREATE TABLE penugasan_mengajar (id TEXT PRIMARY KEY, guru_id TEXT REFERENCES "user"(id));
      CREATE TABLE agenda_guru (id TEXT PRIMARY KEY, penugasan_id TEXT, tanggal TEXT, UNIQUE(penugasan_id, tanggal));
      CREATE TABLE system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT);
      CREATE TABLE role_features (role TEXT, feature_id TEXT, PRIMARY KEY(role, feature_id));
      CREATE TABLE role_feature_permissions (
        role TEXT, feature_id TEXT, can_create INTEGER, can_read INTEGER,
        can_update INTEGER, can_delete INTEGER, PRIMARY KEY(role, feature_id)
      );
      INSERT INTO "user" VALUES ('guru'), ('reviewer');
      INSERT INTO penugasan_mengajar VALUES ('p1', 'guru'), ('p2', 'guru'), ('p3', 'guru');`)
    sqlite.exec(readFileSync(new URL('../migrations/0112_add_agenda_lupa_requests.sql', import.meta.url), 'utf8'))
  })

  afterEach(() => sqlite.close())

  it('creates constraints, indexes, default setting, and curriculum role permissions', () => {
    expect(sqlite.prepare("SELECT value FROM system_settings WHERE key='agenda_forgotten_monthly_limit'").get()).toEqual({ value: '2' })
    expect(sqlite.prepare("SELECT can_read, can_update FROM role_feature_permissions WHERE role='wakamad' AND feature_id='monitoring-agenda'").get())
      .toEqual({ can_read: 1, can_update: 1 })
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type='index' AND name LIKE 'idx_agenda_lupa_%'").get())
      .toEqual({ total: 3 })

    const insert = sqlite.prepare(`INSERT INTO agenda_lupa_pengajuan
      (guru_id, penugasan_id, tanggal, jam_ke_mulai, jam_ke_selesai, materi, submitted_at)
      VALUES ('guru', 'p1', '2026-09-21', 1, 2, 'Materi', '2026-09-21T10:00:00+07:00')`)
    insert.run()
    expect(() => insert.run()).toThrow()
    expect(() => sqlite.prepare(`INSERT INTO agenda_lupa_pengajuan
      (guru_id, penugasan_id, tanggal, jam_ke_mulai, jam_ke_selesai, materi, status, submitted_at)
      VALUES ('guru', 'p2', '2026-09-21', 3, 4, 'Materi', 'INVALID', '2026-09-21T10:00:00+07:00')`).run()).toThrow()
  })

  it('counts rejected requests against the monthly submission limit and resets next month', () => {
    const conditionalInsert = sqlite.prepare(`INSERT INTO agenda_lupa_pengajuan
      (guru_id, penugasan_id, tanggal, jam_ke_mulai, jam_ke_selesai, materi, status, submitted_at)
      SELECT 'guru', ?, ?, 1, 2, 'Materi', 'PENDING', ?
      WHERE (SELECT COUNT(*) FROM agenda_lupa_pengajuan
             WHERE guru_id='guru' AND substr(tanggal,1,7)=substr(?,1,7)) < 2`)

    expect(conditionalInsert.run('p1', '2026-09-21', '2026-09-21T10:00:00+07:00', '2026-09-21').changes).toBe(1)
    sqlite.prepare("UPDATE agenda_lupa_pengajuan SET status='REJECTED' WHERE penugasan_id='p1'").run()
    expect(conditionalInsert.run('p2', '2026-09-22', '2026-09-22T10:00:00+07:00', '2026-09-22').changes).toBe(1)
    expect(conditionalInsert.run('p3', '2026-09-23', '2026-09-23T10:00:00+07:00', '2026-09-23').changes).toBe(0)
    expect(conditionalInsert.run('p3', '2026-10-01', '2026-10-01T10:00:00+07:00', '2026-10-01').changes).toBe(1)
  })
})
