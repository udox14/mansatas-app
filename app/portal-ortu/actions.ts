'use server'

import { getDB } from '@/utils/db'
import { getAppSession } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'

type SummonResponse = 'hadir' | 'reschedule'

async function ensureParentCommunicationTables(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_notifications (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      source_ref TEXT,
      level TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(siswa_id, type, source_ref)
    )
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_summons (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      source_ref TEXT,
      reason TEXT NOT NULL,
      event_date TEXT,
      event_time TEXT,
      location TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'terkirim',
      parent_response TEXT,
      parent_response_note TEXT,
      parent_responded_at TEXT,
      created_by TEXT REFERENCES "user"(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(siswa_id, source_ref)
    )
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_thread_notes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      siswa_id TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      note_type TEXT NOT NULL DEFAULT 'tindak_lanjut',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
}

async function requireParentSession() {
  const session = await getAppSession()
  if (!session || session.kind !== 'parent') throw new Error('Unauthorized')
  return session
}

export async function respondParentSummons(payload: { summonId: string; response: SummonResponse; note?: string }) {
  const session = await requireParentSession()
  const db = await getDB()
  await ensureParentCommunicationTables(db)

  const row = await db.prepare(`
    SELECT id, siswa_id
    FROM parent_summons
    WHERE id = ? AND siswa_id = ?
  `).bind(payload.summonId, session.user.siswa_id).first<{ id: string; siswa_id: string }>()

  if (!row) return { error: 'Data pemanggilan tidak ditemukan.' }

  await db.prepare(`
    UPDATE parent_summons
    SET parent_response = ?, parent_response_note = ?, parent_responded_at = datetime('now'),
        status = CASE WHEN ? = 'hadir' THEN 'dikonfirmasi' ELSE 'reschedule_diminta' END,
        updated_at = datetime('now')
    WHERE id = ? AND siswa_id = ?
  `).bind(payload.response, payload.note || null, payload.response, payload.summonId, session.user.siswa_id).run()

  const responseText = payload.response === 'hadir'
    ? 'Orang tua mengonfirmasi kehadiran pada jadwal pemanggilan.'
    : `Orang tua meminta penjadwalan ulang.${payload.note ? ` Catatan: ${payload.note}` : ''}`

  await db.prepare(`
    INSERT INTO parent_thread_notes (siswa_id, actor_type, actor_id, note_type, content)
    VALUES (?, 'orang_tua', ?, 'respon_pemanggilan', ?)
  `).bind(session.user.siswa_id, session.user.nisn, responseText).run()

  revalidatePath('/portal-ortu')
  return { success: 'Respon pemanggilan berhasil dikirim.' }
}

export async function markParentNotificationRead(notificationId: string) {
  const session = await requireParentSession()
  const db = await getDB()
  await ensureParentCommunicationTables(db)

  await db.prepare(`
    UPDATE parent_notifications
    SET is_read = 1
    WHERE id = ? AND siswa_id = ?
  `).bind(notificationId, session.user.siswa_id).run()

  revalidatePath('/portal-ortu')
  return { success: true }
}

