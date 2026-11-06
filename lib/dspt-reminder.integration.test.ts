import { readFileSync } from 'node:fs'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  archiveDsptReminderTemplate, listDsptReminderHistory, loadDsptReminderOptions,
  previewDsptReminder, saveDsptReminderTemplate, sendDsptReminder,
} from '@/app/dashboard/keuangan/dspt/reminder-actions'
import { POST as registerWebPush, DELETE as unregisterWebPush } from '@/app/api/web-push/register/route'
import { processDsptReminderWork } from './dspt-reminder-queue'
import { flushNotificationOutbox, type NotificationQueueMessage } from './notification-engine'
import { DSPT_PAYMENT_URL, DSPT_TEMPLATES, type DsptAudience } from './dspt-reminder-config'

const mocks = vi.hoisted(() => ({
  db: null as D1Database | null,
  actor: 'bendahara',
  roles: ['bendahara_komite'],
  canRead: true,
  enabled: true,
  appSession: null as unknown,
  enqueue: vi.fn(),
  fcm: vi.fn(),
  webpush: vi.fn(),
}))
vi.mock('@/utils/db-server', () => ({ getDB: async () => mocks.db }))
vi.mock('@/utils/auth/server', () => ({
  getSession: async () => mocks.actor ? { user: { id: mocks.actor } } : null,
  getAppSession: async () => mocks.appSession,
}))
vi.mock('@/lib/features', () => ({
  getUserRoles: async () => mocks.roles,
  checkFeatureAccess: async () => mocks.canRead,
}))
vi.mock('@/lib/system-settings', () => ({
  getSystemSettingBoolean: async () => mocks.enabled,
  getSystemSetting: async () => '',
}))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: { NOTIFICATION_QUEUE: { send: mocks.enqueue } } }) }))
vi.mock('./fcm', () => ({ sendFcmNotification: mocks.fcm }))
vi.mock('./web-push', () => ({ sendPushNotification: vi.fn(), sendParentWebPushBatch: mocks.webpush }))

let sqlite: DatabaseSync
let db: D1Database
let now: number
let queued: { message: NotificationQueueMessage; due: number }[]
const defaultAudience: DsptAudience = { payment: 'unpaid', scope: { kind: 'all' } }
const migration = (file: string) => readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8')

beforeEach(() => {
  now = Date.now()
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  queued = []
  mocks.actor = 'bendahara'
  mocks.roles = ['bendahara_komite']
  mocks.canRead = true
  mocks.enabled = true
  mocks.appSession = null
  mocks.enqueue.mockReset().mockImplementation(async (message, options) => {
    queued.push({ message, due: now + (options?.delaySeconds ?? 0) * 1000 })
  })
  mocks.fcm.mockReset().mockImplementation(async (_notification, _target, options) => ({
    success: true, report: options.parentBatchTokens.map((token: string) => ({ token, success: true })),
  }))
  mocks.webpush.mockReset().mockImplementation(async (_notification, destinations: { id: string }[]) =>
    destinations.map(({ id }) => ({ id, state: 'accepted' })))
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`
    CREATE TABLE "user" (id TEXT PRIMARY KEY, name TEXT, nama_lengkap TEXT);
    INSERT INTO "user" VALUES ('bendahara', 'Bendahara', NULL), ('admin','Super Admin',NULL);
    CREATE TABLE kelas (id TEXT PRIMARY KEY, tingkat INTEGER, nomor_kelas TEXT, kelompok TEXT);
    INSERT INTO kelas VALUES ('10a',10,'1',NULL), ('10b',10,'2',NULL), ('11a',11,'1',NULL);
    CREATE TABLE siswa (id TEXT PRIMARY KEY, status TEXT, nama_lengkap TEXT, nisn TEXT, kelas_id TEXT);
    INSERT INTO siswa VALUES
      ('cicil','aktif','Siswa Cicil','01','10a'), ('baru','aktif','Siswa Baru','02',NULL),
      ('lunas','aktif','Siswa Lunas','03','10a'), ('review','aktif','Siswa Review','04','10a'),
      ('diskon','aktif','Siswa Diskon','05','10b'), ('tanpa','aktif','Siswa Tanpa','06','11a'),
      ('keluar','lulus','Siswa Lulus','07','10a'), ('nol','aktif','Siswa Nol','08','11a');
    CREATE TABLE fin_dspt (siswa_id TEXT UNIQUE, nominal_target INTEGER, total_dibayar INTEGER, total_diskon INTEGER);
    INSERT INTO fin_dspt VALUES ('cicil',100,40,20), ('baru',100,0,0), ('lunas',100,100,0),
      ('review',100,0,0), ('diskon',100,0,100), ('keluar',100,0,0), ('nol',0,0,0);
    CREATE TABLE fin_payment_submissions (siswa_id TEXT, kategori TEXT, status TEXT);
    INSERT INTO fin_payment_submissions VALUES ('review','dspt','menunggu_konfirmasi'), ('cicil','dspt','belum_upload');
    ${migration('0001_add_web_push_subscriptions.sql')}
    ${migration('0060_add_fcm_tokens.sql')}
    ${migration('0086_add_notification_engine.sql')}
    ALTER TABLE notification_dispatches ADD COLUMN payload_json TEXT;
    ALTER TABLE notification_dispatches ADD COLUMN available_at TEXT;
    ALTER TABLE notification_dispatches ADD COLUMN enqueued_at TEXT;
    ALTER TABLE notification_dispatches ADD COLUMN enqueue_claim_until TEXT;
    ${migration('0021_add_parent_communication.sql')}
    ${migration('0124_dspt_parent_reminders.sql')}
  `)
  db = {
    prepare(sql: string) {
      let args: SQLInputValue[] = []
      return {
        bind(...values: SQLInputValue[]) { args = values; return this },
        async all() { return { results: sqlite.prepare(sql).all(...args) } },
        async first() { return sqlite.prepare(sql).get(...args) ?? null },
        async run() {
          if (/^SELECT /i.test(sql.trim())) return { results: sqlite.prepare(sql).all(...args), meta: { changes: 0 } }
          return { results: [], meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }
        },
      }
    },
    async batch(statements: { run(): Promise<unknown> }[]) {
      sqlite.exec('BEGIN')
      try {
        const results = []
        for (const statement of statements) results.push(await statement.run())
        sqlite.exec('COMMIT')
        return results
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  } as unknown as D1Database
  mocks.db = db
})
afterEach(() => { sqlite.close(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function submit(audience = defaultAudience, templateId = audience.payment === 'all' ? 'informasi' : 'pengingat') {
  const preview = await previewDsptReminder(audience, templateId)
  if (preview.error || !preview.count) throw new Error('Pratinjau uji tidak tersedia')
  const confirmation = { id: crypto.randomUUID(), count: preview.count, title: preview.title!, body: preview.body! }
  expect(await sendDsptReminder(audience, templateId, confirmation)).toEqual({ id: confirmation.id })
  return confirmation
}

async function runNext() {
  const job = queued.shift()
  if (!job) throw new Error('Antrean uji kosong')
  now = Math.max(now, job.due)
  const env = { DB: db, NOTIFICATION_QUEUE: { send: mocks.enqueue } }
  expect(await processDsptReminderWork(job.message, env, 1)).toEqual({ retry: false })
  return job.message
}

async function drain() {
  let steps = 0
  while (queued.length && steps < 1000) {
    await runNext()
    steps++
  }
  expect(queued).toHaveLength(0)
  return steps
}

describe('Pengingat DSPT', () => {
  it.each([
    ['unpaid', { kind: 'all' }, 2], ['all', { kind: 'all' }, 7],
    ['unpaid', { kind: 'grade', grade: 10 }, 1], ['all', { kind: 'grade', grade: 10 }, 4],
    ['unpaid', { kind: 'class', classId: '10a' }, 1], ['all', { kind: 'class', classId: '10a' }, 3],
    ['unpaid', { kind: 'students', studentIds: ['baru', 'review', 'baru', 'keluar'] }, 1],
    ['all', { kind: 'students', studentIds: ['baru', 'review', 'baru', 'keluar'] }, 2],
  ] as const)('filters %s by %j', async (payment, scope, count) => {
    expect(await previewDsptReminder({ payment, scope }, payment === 'all' ? 'informasi' : 'pengingat')).toMatchObject({ count })
  })

  it('guards preview, send, and shared templates separately from the dashboard', async () => {
    mocks.actor = ''
    await expect(previewDsptReminder(defaultAudience, 'pengingat')).rejects.toThrow('Sesi berakhir')
    mocks.actor = 'bendahara'
    mocks.roles = ['kepsek']
    await expect(listDsptReminderHistory()).rejects.toThrow('tidak memiliki akses')
    mocks.roles = ['super_admin', 'play_reviewer']
    await expect(loadDsptReminderOptions()).rejects.toThrow('tidak memiliki akses')
    mocks.roles = ['bendahara_komite']
    mocks.canRead = false
    await expect(saveDsptReminderTemplate(null, DSPT_TEMPLATES[0])).rejects.toThrow('tidak memiliki akses')
  })

  it('requires reconfirmation after the recipient count changes and respects the rollout gate', async () => {
    const preview = await previewDsptReminder(defaultAudience, 'pengingat')
    const confirmation = { id: crypto.randomUUID(), count: preview.count!, title: preview.title!, body: preview.body! }
    mocks.enabled = false
    expect(await sendDsptReminder(defaultAudience, 'pengingat', confirmation)).toMatchObject({ error: 'Pengiriman DSPT belum diaktifkan.' })
    mocks.enabled = true
    sqlite.exec("UPDATE fin_dspt SET total_dibayar = 100 WHERE siswa_id = 'baru'")
    expect(await sendDsptReminder(defaultAudience, 'pengingat', confirmation)).toMatchObject({ refresh: true })
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM dspt_notices').get()?.count).toBe(0)
    expect(queued).toHaveLength(0)
  })

  it('keeps one confirmation and revalidates student status after queueing', async () => {
    const confirmation = await submit()
    expect(await sendDsptReminder(defaultAudience, 'pengingat', confirmation)).toEqual({ id: confirmation.id })
    expect(queued).toHaveLength(1)
    sqlite.exec("INSERT INTO fin_payment_submissions VALUES ('baru','dspt','menunggu_konfirmasi')")
    const first = await runNext()
    expect(await processDsptReminderWork(first, { DB: db, NOTIFICATION_QUEUE: { send: mocks.enqueue } }, 2)).toEqual({ retry: false })
    await drain()
    expect(sqlite.prepare('SELECT siswa_id, type FROM parent_notifications').all()).toEqual([{ siswa_id: 'cicil', type: 'finance_dspt_reminder' }])
    expect((await listDsptReminderHistory())[0]).toMatchObject({ recipient_count: 2, in_app: 1, skipped: 1, no_fcm: 1, no_webpush: 1 })
  })

  it('preserves the stored message after a shared template changes', async () => {
    const fields = { name: 'DSPT semester ini', title: 'Cek pembayaran', body: 'Silakan periksa portal.' }
    const created = await saveDsptReminderTemplate(null, fields)
    const templateId = created.template!.id
    mocks.actor = 'admin'
    mocks.roles = ['super_admin']
    expect((await loadDsptReminderOptions()).templates).toEqual([{ id: templateId, ...fields }])
    await submit(defaultAudience, templateId)
    await saveDsptReminderTemplate(templateId, { ...fields, body: 'Pesan baru' })
    expect(await archiveDsptReminderTemplate(templateId)).toEqual({ ok: true })
    expect((await loadDsptReminderOptions()).templates).toEqual([])
    expect((await listDsptReminderHistory())[0]).toMatchObject({ sender: 'Super Admin', body: fields.body })
  })

  it('recovers an enqueue failure and retries only the failed destination', async () => {
    sqlite.exec(`INSERT INTO fcm_tokens(id,token,owner_type,siswa_id) VALUES ('f1','token-1','parent','cicil'),('f2','token-2','parent','cicil');
      INSERT INTO parent_web_push_subscriptions(id,siswa_id,endpoint,p256dh,auth) VALUES ('w1','cicil','test','test','test');`)
    mocks.enqueue.mockRejectedValueOnce(new Error('Queue unavailable'))
    mocks.fcm.mockResolvedValueOnce({ success: true, report: [
      { token: 'token-1', success: true }, { token: 'token-2', success: false, status: 503 },
    ] })
    const { id } = await submit()
    expect(queued).toHaveLength(0)
    now += 61_000
    expect(await flushNotificationOutbox(db, id)).toEqual({ queued: 1 })
    await drain()
    expect(mocks.fcm.mock.calls.map(([notice, , opts]) => [notice.url, opts.parentBatchTokens])).toEqual([
      [DSPT_PAYMENT_URL, ['token-1', 'token-2']], [DSPT_PAYMENT_URL, ['token-2']],
    ])
    expect(mocks.webpush.mock.calls[0][0].url).toBe(DSPT_PAYMENT_URL)
    expect(mocks.webpush).toHaveBeenCalledTimes(1)
    expect((await listDsptReminderHistory())[0]).toMatchObject({ fcm_accepted: 2, webpush_accepted: 1, in_app: 2 })
  })

  it('skips push when payment becomes settled or the registered device changes owner', async () => {
    sqlite.exec(`INSERT INTO fcm_tokens(id,token,owner_type,siswa_id) VALUES ('f1','token-1','parent','cicil');
      INSERT INTO parent_web_push_subscriptions(id,siswa_id,endpoint,p256dh,auth) VALUES ('w1','baru','test','test','test');`)
    await submit()
    await runNext()
    sqlite.exec(`UPDATE fin_dspt SET total_dibayar = nominal_target WHERE siswa_id = 'cicil';
      UPDATE parent_web_push_subscriptions SET siswa_id = 'cicil' WHERE id = 'w1';`)
    await drain()
    expect(mocks.fcm).not.toHaveBeenCalled()
    expect(mocks.webpush).not.toHaveBeenCalled()
    expect((await listDsptReminderHistory())[0]).toMatchObject({ in_app: 2, fcm_skipped: 1, webpush_skipped: 1 })
  })

  it('handles 1200 students with bounded batches and no request-time delivery', async () => {
    sqlite.exec(`
      WITH RECURSIVE seq(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM seq WHERE i < 1200)
      INSERT INTO siswa SELECT printf('load%04d',i),'aktif','Load Test',NULL,'10a' FROM seq;
      INSERT INTO fcm_tokens(id,token,owner_type,siswa_id) SELECT 'f'||id, 'token'||id,'parent',id FROM siswa WHERE id LIKE 'load%';
      INSERT INTO parent_web_push_subscriptions(id,siswa_id,endpoint,p256dh,auth)
        SELECT 'w'||id,id,'test'||id,'test','test' FROM siswa WHERE id LIKE 'load%';
    `)
    await submit({ payment: 'all', scope: { kind: 'all' } })
    expect(mocks.fcm).not.toHaveBeenCalled()
    expect(mocks.webpush).not.toHaveBeenCalled()
    const steps = await drain()
    expect(steps).toBeGreaterThan(120)
    expect(Math.max(...mocks.fcm.mock.calls.map(([, , opts]) => opts.parentBatchTokens.length))).toBe(10)
    expect(Math.max(...mocks.webpush.mock.calls.map(([, destinations]) => destinations.length))).toBe(10)
    expect((await listDsptReminderHistory())[0]).toMatchObject({ in_app: 1207, fcm_accepted: 1200, webpush_accepted: 1200 })
  }, 15_000)
})

describe('Kepemilikan VAPID orang tua', () => {
  const endpoint = 'https://fcm.googleapis.com/fcm/send/subscription'
  const keys = { p256dh: 'B' + 'a'.repeat(86), auth: 'a'.repeat(22) }
  const request = (method: 'POST' | 'DELETE', data: unknown, origin = 'https://example.test') =>
    new Request('https://example.test/api/web-push/register', {
      method, headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })

  it('moves an existing browser subscription between parents, then to staff, only with matching keys', async () => {
    mocks.appSession = { kind: 'parent', user: { siswa_id: 'baru' } }
    expect((await registerWebPush(request('POST', { endpoint, keys }))).status).toBe(200)
    mocks.appSession = { kind: 'parent', user: { siswa_id: 'cicil' } }
    expect((await registerWebPush(request('POST', { endpoint, keys: { ...keys, auth: 'b'.repeat(22) } }))).status).toBe(409)
    expect((await registerWebPush(request('POST', { endpoint, keys }))).status).toBe(200)
    expect(sqlite.prepare('SELECT siswa_id FROM parent_web_push_subscriptions').all()).toEqual([{ siswa_id: 'cicil' }])
    mocks.appSession = { kind: 'staff', user: { id: 'admin' } }
    expect((await registerWebPush(request('POST', { endpoint, keys }))).status).toBe(200)
    expect(sqlite.prepare('SELECT siswa_id FROM parent_web_push_subscriptions').all()).toEqual([])
    expect(sqlite.prepare('SELECT user_id FROM web_push_subscriptions').all()).toEqual([{ user_id: 'admin' }])
  })

  it('rejects unsafe endpoints and cross-site writes and only removes the session owner', async () => {
    mocks.appSession = { kind: 'parent', user: { siswa_id: 'baru' } }
    expect((await registerWebPush(request('POST', { endpoint: 'https://fcm.googleapis.com.evil.test/fcm/send/x', keys }))).status).toBe(400)
    expect((await registerWebPush(request('POST', { endpoint, keys }, 'https://evil.test'))).status).toBe(403)
    expect((await registerWebPush(request('POST', { endpoint, keys }))).status).toBe(200)
    mocks.appSession = { kind: 'parent', user: { siswa_id: 'cicil' } }
    await unregisterWebPush(request('DELETE', { endpoint }))
    expect(sqlite.prepare('SELECT siswa_id FROM parent_web_push_subscriptions').get()?.siswa_id).toBe('baru')
    mocks.appSession = { kind: 'parent', user: { siswa_id: 'baru' } }
    await unregisterWebPush(request('DELETE', { endpoint }))
    expect(sqlite.prepare('SELECT siswa_id FROM parent_web_push_subscriptions').get()).toBeUndefined()
  })

  it('encrypts real VAPID payloads with bounded requests and forbids redirects', async () => {
    const { sendParentWebPushBatch } = await vi.importActual<typeof import('./web-push')>('./web-push')
    const serverKeys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const browserKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const encodePublic = async (key: CryptoKey) => Buffer.from(await crypto.subtle.exportKey('raw', key)).toString('base64url')
    const serverPrivate = await crypto.subtle.exportKey('jwk', serverKeys.privateKey)
    const browserPublic = await encodePublic(browserKeys.publicKey)
    const auth = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url')
    let active = 0
    let peak = 0
    const send = vi.fn(async (_endpoint: string, init: RequestInit) => {
      expect(init.redirect).toBe('error')
      expect(init.body).toBeInstanceOf(Uint8Array)
      active++
      peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 5))
      active--
      return new Response(null, { status: 201 })
    })
    vi.stubGlobal('fetch', send)
    const destinations = Array.from({ length: 10 }, (_, index) => ({
      id: String(index), siswa_id: 'cicil', p256dh: browserPublic, auth,
      endpoint: index === 0 ? 'https://invalid.test/unsafe' : `${endpoint}-${index}`,
    }))
    const results = await sendParentWebPushBatch({ title: 'DSPT', body: 'Cek Portal', url: DSPT_PAYMENT_URL }, destinations, db, {
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: await encodePublic(serverKeys.publicKey), VAPID_PRIVATE_KEY: serverPrivate.d,
    })
    expect(send).toHaveBeenCalledTimes(9)
    expect(peak).toBeLessThanOrEqual(4)
    expect(results[0].state).toBe('failed')
    expect(results.slice(1).every(result => result.state === 'accepted')).toBe(true)
  })
})
