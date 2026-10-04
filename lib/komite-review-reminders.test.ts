import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getNotificationDefinition } from './notification-catalog'
import { KOMITE_REVIEW_REMINDER_EVENT, komiteReminderSlot, komiteReminderSource,
  pendingKomiteReminders, komiteReminderRecipients, validKomiteReminderRecipients,
  type KomiteReminderRow, type KomiteReminderValidation } from './komite-review-reminders'

let sqlite: DatabaseSync
let db: D1Database
const now = Date.parse('2026-10-04T09:00:00+07:00')
const reminder = getNotificationDefinition(KOMITE_REVIEW_REMINDER_EVENT)!.reminder
const row: KomiteReminderRow = { id: 'p1', judul: 'Kegiatan', nominal: 100000,
  pengaju_id: 'applicant', status: 'menunggu_bendahara', current_version: 1,
  updated_at: '2026-10-03 00:00:00', ketua_delegate_id: null }

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`CREATE TABLE "user" (id TEXT, role TEXT, banned INTEGER, name TEXT, nama_lengkap TEXT, email TEXT);
    CREATE TABLE user_roles (user_id TEXT, role TEXT);
    CREATE TABLE komite_pengajuan (id TEXT, judul TEXT, nominal INTEGER, pengaju_id TEXT, status TEXT,
      current_version INTEGER, updated_at TEXT, ketua_delegate_id TEXT);
    CREATE TABLE notification_dispatches (event_key TEXT, source_ref TEXT, queued_at TEXT);
    INSERT INTO "user" (id,role,banned) VALUES ('applicant','wakamad',0),('treasurer','bendahara_komite',0),
      ('chair','ketua_komite',0),('principal','kepsek',0),('delegate','anggota_komite',0),
      ('blocked','bendahara_komite',1),('multi','guru',0);
    INSERT INTO user_roles VALUES ('multi','bendahara_komite');`)
  sqlite.prepare('INSERT INTO komite_pengajuan VALUES (?,?,?,?,?,?,?,?)')
    .run(row.id, row.judul, row.nominal, row.pengaju_id, row.status, row.current_version, row.updated_at, row.ketua_delegate_id)
  db = { prepare(sql: string) {
    let args: (string | number | null)[] = []
    return { bind(...values: typeof args) { args = values; return this },
      async all() { return { results: sqlite.prepare(sql).all(...args) } },
      async first() { return sqlite.prepare(sql).get(...args) || null } }
  } } as unknown as D1Database
})
afterEach(() => sqlite.close())

describe('Komite review reminders', () => {
  it('uses enabled FCM/Web Push defaults, 2-hour intervals, and the WIB working window', () => {
    expect(getNotificationDefinition(KOMITE_REVIEW_REMINDER_EVENT)).toMatchObject({
      defaultEnabled: true, defaultChannels: ['fcm', 'webpush'], reminder: { frequencyMinutes: 120, windowStart: '07:00', windowEnd: '17:00' },
    })
    for (const clock of ['06:59', '17:01', '23:00']) {
      expect(komiteReminderSlot(Date.parse(`2026-10-04T${clock}:00+07:00`), reminder)).toBeNull()
    }
    expect(komiteReminderSlot(Date.parse('2026-10-04T07:00:00+07:00'), reminder)).toBe('2026-10-04:0')
    expect(komiteReminderSlot(now, reminder)).toBe('2026-10-04:1')
    expect(komiteReminderSlot(Date.parse('2026-10-04T17:00:00+07:00'), reminder)).toBe('2026-10-04:5')
  })

  it('routes each stage including secondary roles, blocked accounts, and delegates', async () => {
    expect(await komiteReminderRecipients(db, row)).toEqual(['multi', 'treasurer'])
    expect(await komiteReminderRecipients(db, { ...row, status: 'menunggu_ketua' })).toEqual(['chair'])
    expect(await komiteReminderRecipients(db, { ...row, status: 'menunggu_kepala' })).toEqual(['principal'])
    expect(await komiteReminderRecipients(db, { ...row, status: 'menunggu_ketua', ketua_delegate_id: 'delegate' })).toEqual(['delegate'])
    expect(await komiteReminderRecipients(db, { ...row, status: 'menunggu_ketua', pengaju_id: 'chair' })).toEqual([])
    expect(await komiteReminderRecipients(db, { ...row, pengaju_id: 'treasurer' })).toContain('treasurer')
    for (const status of ['draft', 'perlu_revisi', 'ditolak', 'disetujui']) {
      expect(await komiteReminderRecipients(db, { ...row, status })).toEqual([])
    }
  })

  it('waits a full interval after entering review and excludes completed proposals', async () => {
    sqlite.prepare('UPDATE komite_pengajuan SET updated_at=?').run('2026-10-04 01:01:00')
    expect(await pendingKomiteReminders(db, '2026-10-04:1', 120, now)).toEqual([])
    sqlite.prepare('UPDATE komite_pengajuan SET updated_at=?').run('2026-10-04 00:00:00')
    expect(await pendingKomiteReminders(db, '2026-10-04:1', 120, now)).toHaveLength(1)
    sqlite.exec("UPDATE komite_pengajuan SET status='disetujui'")
    expect(await pendingKomiteReminders(db, '2026-10-04:1', 120, now)).toEqual([])
  })

  it('deduplicates a slot and prevents rapid repeat sends across slot boundaries', async () => {
    const slot = komiteReminderSlot(now, reminder)!
    sqlite.prepare('INSERT INTO notification_dispatches VALUES (?,?,?)').run(KOMITE_REVIEW_REMINDER_EVENT,
      komiteReminderSource(row, slot), '2026-10-04 02:00:00')
    expect(await pendingKomiteReminders(db, slot, 120, now)).toEqual([])
    // Different slot does not allow another send until the full interval has passed.
    expect(await pendingKomiteReminders(db, '2026-10-04:2', 120, now + 119 * 60_000)).toEqual([])
    expect(await pendingKomiteReminders(db, '2026-10-04:2', 120, now + 120 * 60_000)).toHaveLength(1)
  })

  it('revalidates queued recipients after review, resubmission, delegation and role revocation', async () => {
    const validation: KomiteReminderValidation = { kind: 'komite_review', pengajuanId: row.id,
      version: 1, status: row.status, sourceUpdatedAt: row.updated_at, delegateId: null, slot: '2026-10-04:1' }
    expect(await validKomiteReminderRecipients(db, validation, ['treasurer'])).toEqual(['treasurer'])
    for (const sql of ["status='disetujui'", 'current_version=2', "ketua_delegate_id='delegate'", "updated_at='2026-10-04 02:00:00'"]) {
      sqlite.exec(`UPDATE komite_pengajuan SET ${sql}`)
      expect(await validKomiteReminderRecipients(db, validation, ['treasurer'])).toEqual([])
      sqlite.prepare('UPDATE komite_pengajuan SET status=?,current_version=1,ketua_delegate_id=NULL,updated_at=?').run(row.status, row.updated_at)
    }
    sqlite.exec("UPDATE \"user\" SET role='guru' WHERE id='treasurer'")
    expect(await validKomiteReminderRecipients(db, validation, ['treasurer'])).toEqual([])
  })
})
