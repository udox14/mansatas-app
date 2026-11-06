import { ensureSchemaOnce } from './schema-guard'
import { ATTENDANCE_CORRECTION_REQUEST_EVENT, KELAS_BINAAN_NOTIFICATION_EVENTS } from './notification-catalog'

export const ATTENDANCE_CORRECTION_INBOX = '/dashboard/kelas-binaan/notifikasi?scope=koreksi'

function inboxEvents(corrections = false) {
  const events = corrections ? [ATTENDANCE_CORRECTION_REQUEST_EVENT] : KELAS_BINAAN_NOTIFICATION_EVENTS
  return { events, predicate: `event_key IN (${events.map(() => '?').join(',')})` }
}

export type StaffInboxItem = {
  id: string; event_key: string; title: string; message: string; url: string;
  level: string; created_at: string; read_at: string | null;
}

export async function ensureStaffNotificationInbox(db: D1Database) {
  await ensureSchemaOnce('staff-notification-inbox-v1', async () => {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS staff_notifications (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES "user"(id),
        event_key TEXT NOT NULL, source_ref TEXT NOT NULL,
        title TEXT NOT NULL, message TEXT NOT NULL, url TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        created_at TEXT NOT NULL DEFAULT (datetime('now')), read_at TEXT,
        UNIQUE(user_id, event_key, source_ref)
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_staff_notifications_user_date ON staff_notifications(user_id, created_at DESC, id DESC)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_staff_notifications_unread ON staff_notifications(user_id, created_at DESC, id DESC) WHERE read_at IS NULL'),
    ])
  })
}

export function staffNotificationHref(url: string) {
  return (url === '/dashboard' || url.startsWith('/dashboard/')) && !/[\\\r\n]/.test(url) ? url : '/dashboard/kelas-binaan'
}

export async function writeStaffNotifications(db: D1Database, userIds: string[], eventKey: string, sourceRef: string,
  title: string, message: string, url: string, level: string) {
  await ensureStaffNotificationInbox(db)
  const ids = [...new Set(userIds)]
  for (let start = 0; start < ids.length; start += 25) {
    await db.batch(ids.slice(start, start + 25).map(id => db.prepare(`INSERT OR IGNORE INTO staff_notifications
      (user_id,event_key,source_ref,title,message,url,level) VALUES (?,?,?,?,?,?,?)`)
      .bind(id,eventKey,sourceRef,title,message,staffNotificationHref(url),level)))
  }
}

export async function getStaffInbox(db: D1Database, userId: string, options: { before?: string; unread?: boolean; corrections?: boolean } = {}) {
  await ensureStaffNotificationInbox(db)
  const { events, predicate } = inboxEvents(options.corrections)
  const cursor = options.before?.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})~([a-f0-9]{32})$/)
  const conditions = ['user_id = ?', predicate, ...(options.unread ? ['read_at IS NULL'] : []),
    ...(cursor ? ['(created_at, id) < (?, ?)'] : [])]
  const bindings = [userId, ...events, ...(cursor ? [cursor[1], cursor[2]] : [])]
  const [rows, count] = await Promise.all([
    db.prepare(`SELECT id,event_key,title,message,url,level,created_at,read_at FROM staff_notifications
      WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT 21`).bind(...bindings).all<StaffInboxItem>(),
    getUnreadStaffNotificationCount(db, userId, options.corrections),
  ])
  const items = (rows.results || []).slice(0,20)
  const last = items.at(-1)
  return { items, unreadCount: count,
    nextCursor: (rows.results || []).length > 20 && last ? `${last.created_at}~${last.id}` : null }
}

export async function readStaffNotification(db: D1Database, userId: string, id: string, corrections = false) {
  await ensureStaffNotificationInbox(db)
  const { events, predicate } = inboxEvents(corrections)
  return db.prepare(`UPDATE staff_notifications SET read_at = COALESCE(read_at,datetime('now'))
    WHERE id = ? AND user_id = ? AND ${predicate} RETURNING url`).bind(id,userId,...events).first<{url:string}>()
}

export async function getUnreadStaffNotificationCount(db: D1Database, userId: string, corrections = false) {
  await ensureStaffNotificationInbox(db)
  const { events, predicate } = inboxEvents(corrections)
  const row = await db.prepare(`SELECT COUNT(*) AS total FROM staff_notifications WHERE user_id = ? AND ${predicate} AND read_at IS NULL`)
    .bind(userId,...events).first<{total:number}>()
  return row?.total || 0
}
