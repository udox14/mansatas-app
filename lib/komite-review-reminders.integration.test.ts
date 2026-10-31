import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dispatchConfiguredReminders, getNotificationSettings, processNotificationQueueMessage, emitConfiguredNotification,
  type NotificationQueueMessage } from './notification-engine'
import { KOMITE_REVIEW_REMINDER_EVENT } from './komite-review-reminders'

const mocks = vi.hoisted(() => ({ send: vi.fn(), fcm: vi.fn(), push: vi.fn() }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: { NOTIFICATION_QUEUE: { send: mocks.send } } }) }))
vi.mock('./schema-guard', () => ({ ensureSchemaOnce: async (_key: string, ensure: () => Promise<unknown>) => ensure() }))
vi.mock('./fcm', () => ({ sendFcmNotification: mocks.fcm }))
vi.mock('./web-push', () => ({ sendPushNotification: mocks.push }))

let sqlite: DatabaseSync
let db: D1Database
const now = Date.parse('2026-10-04T09:00:00+07:00')

beforeEach(async () => {
  vi.spyOn(Date, 'now').mockReturnValue(now)
  mocks.send.mockReset().mockResolvedValue(undefined)
  mocks.fcm.mockReset().mockResolvedValue({ success: true, sent: 1 })
  mocks.push.mockReset().mockResolvedValue({ success: true, sent: 1 })
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`CREATE TABLE "user" (id TEXT PRIMARY KEY, role TEXT, banned INTEGER, name TEXT, nama_lengkap TEXT, email TEXT);
    CREATE TABLE user_roles (user_id TEXT, role TEXT);
    CREATE TABLE system_settings (key TEXT PRIMARY KEY,value TEXT);
    INSERT INTO system_settings VALUES ('komite_verifier_user_id','delegate');
    CREATE TABLE komite_pengajuan (id TEXT, judul TEXT, nominal INTEGER, pengaju_id TEXT, status TEXT,
      current_version INTEGER, updated_at TEXT, ketua_delegate_id TEXT);
    INSERT INTO "user" (id,role,banned,name) VALUES ('applicant','wakamad',0,'Pengaju'),
      ('treasurer','bendahara_komite',0,'Bendahara'), ('chair','ketua_komite',0,'Ketua'),
      ('principal','kepsek',0,'Kepala'), ('delegate','anggota_komite',0,'Anggota');
    INSERT INTO komite_pengajuan VALUES ('p1','Kegiatan',100000,'applicant','menunggu_bendahara',1,'2026-10-03 00:00:00',NULL);`)
  db = { prepare(sql: string) {
    let args: (string | number | null)[] = []
    return { bind(...values: typeof args) { args = values; return this },
      async all() { return { results: sqlite.prepare(sql).all(...args) } },
      async first() { return sqlite.prepare(sql).get(...args) || null },
      async run() { return { meta: { changes: sqlite.prepare(sql).run(...args).changes } } } }
  }, async batch(statements: { run(): Promise<unknown> }[]) {
    const results = []
    for (const statement of statements) results.push(await statement.run())
    return results
  } } as unknown as D1Database
  await getNotificationSettings(db)
  sqlite.prepare('UPDATE notification_event_settings SET enabled=CASE WHEN event_key=? THEN 1 ELSE 0 END').run(KOMITE_REVIEW_REMINDER_EVENT)
})
afterEach(() => { sqlite.close(); vi.restoreAllMocks() })

const queuedMessage = () => mocks.send.mock.calls[0][0] as NotificationQueueMessage
const env = () => ({ DB: db }) as Parameters<typeof processNotificationQueueMessage>[1]

describe('Komite cron and queue delivery', () => {
  it('queues the actual active reviewer once and delivers through both channels', async () => {
    await dispatchConfiguredReminders(db)
    await dispatchConfiguredReminders(db)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(queuedMessage().target).toEqual({ kind: 'staff_users', ids: ['treasurer'] })
    expect(await processNotificationQueueMessage(queuedMessage(), env())).toMatchObject({ sent: 2, retry: false })
    expect(mocks.fcm).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledTimes(1)
    await processNotificationQueueMessage(queuedMessage(), env())
    expect(mocks.fcm).toHaveBeenCalledTimes(1)
  })

  it.each(['review', 'delegation', 'disabled', 'night', 'expired'])('cancels a queued reminder after %s', async change => {
    await dispatchConfiguredReminders(db)
    if (change === 'review') sqlite.exec("UPDATE komite_pengajuan SET status='menunggu_ketua'")
    if (change === 'delegation') sqlite.exec("UPDATE komite_pengajuan SET ketua_delegate_id='delegate'")
    if (change === 'disabled') {
      sqlite.exec('UPDATE notification_event_settings SET enabled=0')
      vi.mocked(Date.now).mockReturnValue(now + 20_000) // expire settings cache
    }
    if (change === 'night') vi.mocked(Date.now).mockReturnValue(Date.parse('2026-10-04T18:00:00+07:00'))
    if (change === 'expired') vi.mocked(Date.now).mockReturnValue(now + 120 * 60_000)
    expect(await processNotificationQueueMessage(queuedMessage(), env())).toMatchObject({ skipped: true, sent: 0 })
    expect(mocks.fcm).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('routes a delegated chairman stage to the delegate and retries temporary delivery failures', async () => {
    sqlite.exec("UPDATE komite_pengajuan SET status='menunggu_ketua',ketua_delegate_id='delegate'")
    await dispatchConfiguredReminders(db)
    expect(queuedMessage().target.ids).toEqual(['delegate'])
    mocks.fcm.mockResolvedValueOnce({ success: false, error: '503 service unavailable' })
    mocks.push.mockResolvedValueOnce({ success: false, error: '503 service unavailable' })
    expect(await processNotificationQueueMessage(queuedMessage(), env())).toMatchObject({ retry: true, sent: 0 })
    expect(sqlite.prepare('SELECT status FROM notification_dispatches').get()?.status).toBe('failed')
    expect(await processNotificationQueueMessage(queuedMessage(), env())).toMatchObject({ retry: false, sent: 2 })
  })

  it('cancels a queued verifier reminder immediately after changing the configured verifier', async () => {
    sqlite.exec("UPDATE komite_pengajuan SET status='menunggu_ketua'")
    await dispatchConfiguredReminders(db)
    expect(queuedMessage().target.ids).toEqual(['delegate'])
    sqlite.exec("UPDATE system_settings SET value='principal'")
    expect(await processNotificationQueueMessage(queuedMessage(),env())).toMatchObject({ skipped:true,sent:0 })
  })
  it('revalidates the initial verifier review request before queue delivery', async () => {
    sqlite.exec("UPDATE komite_pengajuan SET status='menunggu_ketua'")
    sqlite.exec("UPDATE notification_event_settings SET enabled=1 WHERE event_key='komite_verifier_review_requested'")
    await emitConfiguredNotification({ db,eventKey:'komite_verifier_review_requested',sourceRef:'komite:p1:request',
      context:{ userIds:['delegate'],judul_pengajuan:'Kegiatan' },targetOverride:{ kind:'staff_users' },
      validation:{ kind:'komite_review_request',pengajuanId:'p1',version:1,status:'menunggu_ketua',
        sourceUpdatedAt:'2026-10-03 00:00:00',delegateId:null,slot:'' } })
    expect(queuedMessage().target.ids).toEqual(['delegate'])
    sqlite.exec("UPDATE system_settings SET value='principal'")
    expect(await processNotificationQueueMessage(queuedMessage(),env())).toMatchObject({ skipped:true,sent:0 })
    expect(mocks.fcm).not.toHaveBeenCalled()
  })

  it('repeats next interval until reviewed and sends nothing outside the working window', async () => {
    await dispatchConfiguredReminders(db)
    sqlite.prepare('UPDATE notification_dispatches SET queued_at=?').run('2026-10-04 02:00:00')
    vi.mocked(Date.now).mockReturnValue(now + 120 * 60_000)
    await dispatchConfiguredReminders(db)
    expect(mocks.send).toHaveBeenCalledTimes(2)
    sqlite.exec("UPDATE komite_pengajuan SET status='disetujui'")
    vi.mocked(Date.now).mockReturnValue(now + 240 * 60_000)
    await dispatchConfiguredReminders(db)
    expect(mocks.send).toHaveBeenCalledTimes(2)
    sqlite.exec("UPDATE komite_pengajuan SET status='menunggu_bendahara'")
    vi.mocked(Date.now).mockReturnValue(Date.parse('2026-10-04T18:00:00+07:00'))
    await dispatchConfiguredReminders(db)
    expect(mocks.send).toHaveBeenCalledTimes(2)
  })
})
