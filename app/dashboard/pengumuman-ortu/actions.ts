'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'

async function ensureTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_announcements (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      target_scope TEXT NOT NULL DEFAULT 'all',
      kelas_id TEXT REFERENCES kelas(id) ON DELETE SET NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      publish_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
}

async function guard() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', user: null, db: null as any }
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'pengumuman-ortu')
  if (!allowed) return { error: 'Akses ditolak.', user: null, db: null as any }
  await ensureTable(db)
  return { error: null, user, db }
}

export async function createParentAnnouncement(formData: FormData) {
  const { error, user, db } = await guard()
  if (error) return
  const currentUser = user!

  const title = String(formData.get('title') || '').trim()
  const body = String(formData.get('body') || '').trim()
  const targetScope = String(formData.get('target_scope') || 'all').trim() === 'kelas' ? 'kelas' : 'all'
  const kelasIdRaw = String(formData.get('kelas_id') || '').trim()
  const kelasId = targetScope === 'kelas' ? kelasIdRaw : null
  const expiresAt = String(formData.get('expires_at') || '').trim() || null
  const publishAt = String(formData.get('publish_at') || '').trim() || null

  if (!title || !body) return
  if (targetScope === 'kelas' && !kelasId) return

  await db.prepare(`
    INSERT INTO parent_announcements
      (title, body, target_scope, kelas_id, is_active, publish_at, expires_at, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, COALESCE(?, datetime('now')), ?, ?, datetime('now'), datetime('now'))
  `).bind(title, body, targetScope, kelasId, publishAt, expiresAt, currentUser.id).run()

  revalidatePath('/dashboard/pengumuman-ortu')
  revalidatePath('/portal-ortu')
}

export async function toggleParentAnnouncement(formData: FormData) {
  const { error, db } = await guard()
  if (error) return
  const id = String(formData.get('id') || '').trim()
  if (!id) return

  await db.prepare(`
    UPDATE parent_announcements
    SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = datetime('now')
    WHERE id = ?
  `).bind(id).run()

  revalidatePath('/dashboard/pengumuman-ortu')
  revalidatePath('/portal-ortu')
}

export async function deleteParentAnnouncement(formData: FormData) {
  const { error, db } = await guard()
  if (error) return
  const id = String(formData.get('id') || '').trim()
  if (!id) return

  await db.prepare(`DELETE FROM parent_announcements WHERE id = ?`).bind(id).run()
  revalidatePath('/dashboard/pengumuman-ortu')
  revalidatePath('/portal-ortu')
}
