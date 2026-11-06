import { sendFcmNotification, type FcmRuntimeEnv } from './fcm'
import { sendParentWebPushBatch } from './web-push'
import { flushNotificationOutbox, type NotificationQueueMessage } from './notification-engine'
import { dsptEligibilitySql, parseDsptAudience } from './dspt-reminder-audience'
import { DSPT_PAYMENT_URL, DSPT_REMINDER_EVENT, type DsptAudience } from './dspt-reminder-config'

type Work = NonNullable<NotificationQueueMessage['dsptWork']>
type Queue = { send: (body: NotificationQueueMessage, options?: { contentType?: 'json'; delaySeconds?: number }) => Promise<void> }
type Runtime = FcmRuntimeEnv & { DB: D1Database; NOTIFICATION_QUEUE: Queue }
type Device = {
  id: string
  siswa_id: string
  attempts: number
  eligible: number
  token: string | null
  endpoint: string | null
  p256dh: string | null
  auth: string | null
}
type DeviceState = 'accepted' | 'failed' | 'skipped' | 'retry'
type DeviceResult = { id: string; state: DeviceState }
type Channel = 'fcm' | 'webpush'

export function prepareDsptWork(db: D1Database, noticeId: string, work: Work, dueAt = new Date(Date.now()).toISOString()) {
  const id = `dspt:${noticeId}:${work.step}`
  const message: NotificationQueueMessage = {
    dispatchId: id, eventKey: DSPT_REMINDER_EVENT, sourceRef: noticeId, dsptWork: work,
    title: '', body: '', url: DSPT_PAYMENT_URL, parentType: DSPT_REMINDER_EVENT, level: 'info',
    target: { kind: 'parent_students', ids: [] }, channels: ['in_app', 'fcm', 'webpush'],
  }
  return db.prepare(`INSERT OR IGNORE INTO notification_dispatches
    (id, dedup_key, event_key, source_ref, target_scope, status, payload_json, available_at)
    SELECT ?, ?, ?, ?, ?, 'queued', ?, ? WHERE EXISTS (SELECT 1 FROM dspt_notices WHERE id = ?)`)
    .bind(id, id, DSPT_REMINDER_EVENT, noticeId, String(work.step), JSON.stringify(message), dueAt, noticeId)
}

function prepareStudentPage(db: D1Database, noticeId: string, ids: string[], payment: DsptAudience['payment']) {
  const page = JSON.stringify(ids)
  return [
    db.prepare(`INSERT OR IGNORE INTO parent_notifications(siswa_id, type, title, message, source_ref, level)
      SELECT s.id, ?, n.title, n.body, n.id, 'info'
      FROM dspt_notices n JOIN siswa s ON s.id IN (SELECT value FROM json_each(?))
      ${payment === 'unpaid' ? 'JOIN fin_dspt d ON d.siswa_id = s.id' : ''}
      WHERE n.id = ? AND ${dsptEligibilitySql(payment)}`).bind(DSPT_REMINDER_EVENT, page, noticeId),
    db.prepare(`UPDATE dspt_notice_recipients SET state = CASE WHEN EXISTS (
      SELECT 1 FROM parent_notifications p WHERE p.siswa_id = dspt_notice_recipients.siswa_id AND p.type = ? AND p.source_ref = ?
    ) THEN 'in_app' ELSE 'skipped' END WHERE notice_id = ? AND siswa_id IN (SELECT value FROM json_each(?))`)
      .bind(DSPT_REMINDER_EVENT, noticeId, noticeId, page),
    db.prepare(`INSERT OR IGNORE INTO dspt_notice_devices(notice_id, siswa_id, channel, device_id)
      SELECT r.notice_id, r.siswa_id, 'fcm', f.id FROM dspt_notice_recipients r
      JOIN fcm_tokens f ON f.siswa_id = r.siswa_id AND f.owner_type = 'parent'
      WHERE r.notice_id = ? AND r.state = 'in_app' AND r.siswa_id IN (SELECT value FROM json_each(?))`).bind(noticeId, page),
    db.prepare(`INSERT OR IGNORE INTO dspt_notice_devices(notice_id, siswa_id, channel, device_id)
      SELECT r.notice_id, r.siswa_id, 'webpush', p.id FROM dspt_notice_recipients r
      JOIN parent_web_push_subscriptions p ON p.siswa_id = r.siswa_id
      WHERE r.notice_id = ? AND r.state = 'in_app' AND r.siswa_id IN (SELECT value FROM json_each(?))`).bind(noticeId, page),
  ]
}

async function getDevicePage(db: D1Database, noticeId: string, work: Work, channel: Channel, payment: DsptAudience['payment'], now: string) {
  const destination = channel === 'fcm' ? 'f.token, NULL AS endpoint, NULL AS p256dh, NULL AS auth'
    : 'NULL AS token, f.endpoint, f.p256dh, f.auth'
  const table = channel === 'fcm' ? "fcm_tokens f ON f.id = j.device_id AND f.siswa_id = j.siswa_id AND f.owner_type = 'parent'"
    : 'parent_web_push_subscriptions f ON f.id = j.device_id AND f.siswa_id = j.siswa_id'
  const rows = await db.prepare(`SELECT j.device_id AS id, j.siswa_id, j.attempts, ${destination},
    CASE WHEN (${dsptEligibilitySql(payment)}) THEN 1 ELSE 0 END AS eligible
    FROM dspt_notice_devices j LEFT JOIN siswa s ON s.id = j.siswa_id
    LEFT JOIN fin_dspt d ON d.siswa_id = s.id LEFT JOIN ${table}
    WHERE j.notice_id = ? AND j.channel = ? AND j.state = 'pending'
      AND j.siswa_id > ? AND j.siswa_id <= ? AND (j.retry_at IS NULL OR j.retry_at <= ?)
    ORDER BY j.siswa_id, j.device_id LIMIT 10`)
    .bind(noticeId, channel, work.cursor, work.end, now).all<Device>()
  return rows.results || []
}

async function deliverFcm(rows: Device[], notification: { title: string; body: string; url: string }, env: Runtime): Promise<DeviceResult[]> {
  const live = rows.filter(row => row.eligible && row.token !== null)
  if (!live.length) return rows.map(row => ({ id: row.id, state: 'skipped' }))
  const result = await sendFcmNotification(notification, {}, { db: env.DB, env, parentBatchTokens: live.map(row => row.token!) })
  const reports = new Map(('report' in result && result.report ? result.report : []).map(report => [report.token, report]))
  const permanent = typeof result.message === 'string' && result.message.includes('not configured')
  return rows.map(row => {
    if (!row.eligible || !row.token) return { id: row.id, state: 'skipped' }
    const report = reports.get(row.token)
    if (report?.success) return { id: row.id, state: 'accepted' }
    const status = report?.status
    return { id: row.id, state: permanent || (status && status !== 429 && status < 500) ? 'failed' : 'retry' }
  })
}

async function deliverWebPush(rows: Device[], notification: { title: string; body: string; url: string }, env: Runtime): Promise<DeviceResult[]> {
  const live = rows.flatMap(row => row.eligible && row.endpoint && row.p256dh && row.auth
    ? [{ id: row.id, siswa_id: row.siswa_id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth }]
    : [])
  if (!live.length) return rows.map(row => ({ id: row.id, state: 'skipped' }))
  const reports = new Map((await sendParentWebPushBatch(notification, live, env.DB, env)).map(row => [row.id, row.state]))
  return rows.map(row => ({ id: row.id, state: reports.get(row.id) ?? 'skipped' }))
}

async function processPushPage(env: Runtime, noticeId: string, work: Work, payment: DsptAudience['payment'], title: string, body: string) {
  const db = env.DB
  const now = new Date(Date.now()).toISOString()
  const [fcm, webpush] = await Promise.all([
    getDevicePage(db, noticeId, work, 'fcm', payment, now),
    getDevicePage(db, noticeId, work, 'webpush', payment, now),
  ])
  const notification = { title, body, url: DSPT_PAYMENT_URL }
  // Persist FCM results before starting VAPID so a VAPID interruption won't repeat FCM.
  for (const channel of ['fcm', 'webpush'] as const) {
    const rows = channel === 'fcm' ? fcm : webpush
    if (!rows.length) continue
    const results = channel === 'fcm' ? await deliverFcm(rows, notification, env) : await deliverWebPush(rows, notification, env)
    const previousAttempts = new Map(rows.map(row => [row.id, row.attempts]))
    const retryAt = new Date(Date.now() + 60_000).toISOString()
    let retries = 0
    let failures = 0
    await db.batch(results.map(({ id, state }) => {
      const retry = state === 'retry' && (previousAttempts.get(id) ?? 0) < 3
      if (retry) retries++
      else if (state === 'failed' || state === 'retry') failures++
      return db.prepare(`UPDATE dspt_notice_devices SET state = ?, attempts = attempts + 1, retry_at = ?
        WHERE notice_id = ? AND channel = ? AND device_id = ? AND state = 'pending'`)
        .bind(retry ? 'pending' : state === 'retry' ? 'failed' : state, retry ? retryAt : null, noticeId, channel, id)
    }))
    if (retries || failures) {
      console.warn(JSON.stringify({ event: 'dspt_notice_push_outcomes', noticeId, step: work.step, channel, retries, failures }))
    }
  }
  const next = await db.prepare(`SELECT MIN(COALESCE(retry_at, ?)) AS due
    FROM dspt_notice_devices WHERE notice_id = ? AND state = 'pending' AND siswa_id > ? AND siswa_id <= ?`)
    .bind(now, noticeId, work.cursor, work.end).first<{ due: string | null }>()
  if (next?.due) return prepareDsptWork(db, noticeId, { ...work, step: work.step + 1 }, next.due)
  return prepareDsptWork(db, noticeId, { cursor: work.end!, step: work.step + 1 })
}

export async function processDsptReminderWork(message: NotificationQueueMessage, env: Runtime, queueAttempt: number) {
  const { dispatchId, sourceRef: noticeId, dsptWork: work } = message
  if (!work || message.eventKey !== DSPT_REMINDER_EVENT) return { retry: false }
  const db = env.DB
  const started = Date.now()
  const claim = await db.prepare(`UPDATE notification_dispatches
    SET status = 'processing', attempts = attempts + 1, updated_at = datetime('now'),
      enqueued_at = COALESCE(enqueued_at, datetime('now'))
    WHERE id = ? AND event_key = ? AND attempts < 4 AND (status IN ('queued','failed')
      OR (status = 'processing' AND updated_at <= datetime('now','-55 seconds')))
    RETURNING attempts`).bind(dispatchId, DSPT_REMINDER_EVENT).first<{ attempts: number }>()
  if (!claim) {
    const row = await db.prepare('SELECT status FROM notification_dispatches WHERE id = ?')
      .bind(dispatchId).first<{ status: string }>()
    return { retry: row?.status === 'processing' || row?.status === 'failed' }
  }

  try {
    const notice = await db.prepare('SELECT title, body, audience_json, finished_at FROM dspt_notices WHERE id = ?')
      .bind(noticeId).first<{ title: string; body: string; audience_json: string; finished_at: string | null }>()
    const audience = notice && parseDsptAudience(JSON.parse(notice.audience_json))
    if (!notice || !audience) throw new Error('Pengiriman tidak ditemukan.')
    const statements: D1PreparedStatement[] = []
    if (!notice.finished_at && work.end) {
      statements.push(await processPushPage(env, noticeId, work, audience.payment, notice.title, notice.body))
    } else if (!notice.finished_at) {
      const rows = await db.prepare(`SELECT siswa_id FROM dspt_notice_recipients
        WHERE notice_id = ? AND siswa_id > ? AND state = 'pending' ORDER BY siswa_id LIMIT 20`)
        .bind(noticeId, work.cursor).all<{ siswa_id: string }>()
      const students = (rows.results || []).map(row => row.siswa_id)
      const end = students.at(-1)
      if (end) {
        statements.push(...prepareStudentPage(db, noticeId, students, audience.payment))
        statements.push(prepareDsptWork(db, noticeId, { ...work, end, step: work.step + 1 }))
      } else {
        statements.push(db.prepare("UPDATE dspt_notices SET finished_at = datetime('now') WHERE id = ?").bind(noticeId))
      }
    }
    statements.push(db.prepare(`UPDATE notification_dispatches SET status = 'sent', last_error = NULL,
      updated_at = datetime('now'), sent_at = datetime('now') WHERE id = ?`).bind(dispatchId))
    await db.batch(statements)
  } catch {
    const terminal = Math.max(claim.attempts, queueAttempt) >= 4
    const statements = [db.prepare(`UPDATE notification_dispatches SET status = 'failed',
      last_error = 'Pekerjaan DSPT gagal diproses.', updated_at = datetime('now') WHERE id = ?`).bind(dispatchId)]
    if (terminal) statements.push(db.prepare("UPDATE dspt_notices SET failed_at = datetime('now') WHERE id = ?").bind(noticeId))
    await db.batch(statements)
    console.warn(JSON.stringify({ event: 'dspt_notice_work_failed', noticeId, step: work.step, attempt: claim.attempts, terminal, durationMs: Date.now() - started }))
    return { retry: true }
  }
  // Next work is durable before publishing. The cron can recover an enqueue failure.
  await flushNotificationOutbox(db, noticeId, env.NOTIFICATION_QUEUE).catch(() => undefined)
  console.info(JSON.stringify({ event: 'dspt_notice_work_completed', noticeId, step: work.step, attempt: claim.attempts, durationMs: Date.now() - started }))
  return { retry: false }
}
