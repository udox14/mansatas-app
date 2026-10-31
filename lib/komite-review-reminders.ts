import { stageForStatus } from './komite-pengajuan'
import type { NotificationReminderConfig } from './notification-catalog'

export const KOMITE_REVIEW_REMINDER_EVENT = 'komite_review_pending_reminder'

export type KomiteReminderRow = {
  id: string
  judul: string
  nominal: number
  pengaju_id: string
  pengaju_name?: string
  status: string
  current_version: number
  updated_at: string
  ketua_delegate_id: string | null
}

export type KomiteReminderValidation = {
  kind: 'komite_review' | 'komite_review_request'
  pengajuanId: string
  version: number
  status: string
  sourceUpdatedAt: string
  delegateId: string | null
  slot: string
}

// WIB, anchored to the start of the working window (07, 09, 11, 13, 15, 17).
export function komiteReminderSlot(now: number, reminder: NotificationReminderConfig): string | null {
  const local = new Date(now + 7 * 60 * 60_000)
  const parse = (value: string | undefined, fallback: number) => {
    if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return fallback
    const [hour, minute] = value.split(':').map(Number)
    return hour * 60 + minute
  }
  const start = parse(reminder.windowStart, 420)
  const end = parse(reminder.windowEnd, 1020)
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes()
  if (minute < start || minute > end || end < start) return null
  const frequency = Math.max(5, reminder.frequencyMinutes)
  const bucket = Math.floor((minute - start) / frequency)
  return `${local.toISOString().slice(0, 10)}:${bucket}`
}

export function komiteReminderSource(row: KomiteReminderRow, slot: string) {
  return `komite-reminder:${row.id}:${row.current_version}:${row.status}:${row.updated_at}:${slot}`
}

// Shared by the backlog scan and delivery-time routing. Aliases p and u refer
// to the proposal and recipient respectively.
const REVIEWER_PREDICATE = `COALESCE(u.banned,0)=0
  AND (p.status='menunggu_bendahara' OR u.id<>p.pengaju_id)
  AND ((p.status='menunggu_bendahara' AND (u.role='bendahara_komite' OR EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='bendahara_komite')))
  OR (p.status='menunggu_ketua' AND u.id=(SELECT value FROM system_settings WHERE key='komite_verifier_user_id')
    AND (u.role='anggota_komite' OR EXISTS (
      SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='anggota_komite'))))`


// A bounded scan excludes already claimed dispatches so later cron runs can reach
// the rest of the backlog rather than repeatedly scanning the first 200 rows.
export async function pendingKomiteReminders(db: D1Database, slot: string, frequencyMinutes: number, now: number) {
  const cutoff = new Date(now - frequencyMinutes * 60_000).toISOString()
  const rows = await db.prepare(`SELECT p.*, COALESCE(u.nama_lengkap,u.name,u.email) AS pengaju_name
    FROM komite_pengajuan p JOIN "user" u ON u.id=p.pengaju_id
    WHERE p.status IN ('menunggu_bendahara','menunggu_ketua')
      AND datetime(p.updated_at) <= datetime(?)
      AND EXISTS (SELECT 1 FROM "user" u WHERE ${REVIEWER_PREDICATE})
      AND NOT EXISTS (SELECT 1 FROM notification_dispatches d
        WHERE d.event_key=? AND d.source_ref=
          'komite-reminder:' || p.id || ':' || p.current_version || ':' || p.status || ':' || p.updated_at || ':' || ?)
      AND NOT EXISTS (SELECT 1 FROM notification_dispatches d
        WHERE d.event_key=? AND datetime(d.queued_at)>datetime(?)
          AND substr(d.source_ref,1,length('komite-reminder:' || p.id || ':' || p.current_version || ':' || p.status || ':' || p.updated_at || ':'))=
            'komite-reminder:' || p.id || ':' || p.current_version || ':' || p.status || ':' || p.updated_at || ':')
    ORDER BY p.updated_at,p.id LIMIT 200`)
    .bind(cutoff, KOMITE_REVIEW_REMINDER_EVENT, slot, KOMITE_REVIEW_REMINDER_EVENT, cutoff).all<KomiteReminderRow>()
  return rows.results || []
}

export async function komiteReminderRecipients(db: D1Database, row: KomiteReminderRow): Promise<string[]> {
  const stage = stageForStatus(row.status)
  if (!stage) return []
  const rows = await db.prepare(`SELECT DISTINCT u.id FROM "user" u
    CROSS JOIN (SELECT ? AS status, ? AS pengaju_id, ? AS ketua_delegate_id) p
    WHERE ${REVIEWER_PREDICATE} ORDER BY u.id`)
    .bind(row.status, row.pengaju_id, row.ketua_delegate_id || null).all<{ id: string }>()
  return (rows.results || []).map(user => user.id)
}

export async function validKomiteReminderRecipients(
  db: D1Database, validation: KomiteReminderValidation, queuedIds: string[],
) {
  const row = await db.prepare('SELECT * FROM komite_pengajuan WHERE id=?')
    .bind(validation.pengajuanId).first<KomiteReminderRow>()
  if (!row || row.status !== validation.status || row.current_version !== validation.version ||
    row.updated_at !== validation.sourceUpdatedAt || (row.ketua_delegate_id || null) !== validation.delegateId) return []
  return (await komiteReminderRecipients(db, row)).filter(id => queuedIds.includes(id))
}
