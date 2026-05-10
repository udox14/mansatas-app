'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'

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

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS parent_announcement_targets (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      announcement_id TEXT NOT NULL REFERENCES parent_announcements(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL,
      kelas_id TEXT REFERENCES kelas(id) ON DELETE CASCADE,
      tingkat INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
}

async function guard() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', user: null, db: null as any }
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'pengumuman-ortu')
  if (!allowed) return { error: 'Akses ditolak.', user: null, db: null as any }
  const roles = await getUserRoles(db, user.id)
  await ensureTable(db)
  return { error: null, user, db, roles }
}

export async function createParentAnnouncement(formData: FormData) {
  const { error, user, db, roles } = await guard()
  if (error) return
  const currentUser = user!
  const currentRoles = roles || []

  const title = String(formData.get('title') || '').trim()
  const body = String(formData.get('body') || '').trim()
  let targetScope = String(formData.get('target_scope') || 'all').trim()
  if (!['all', 'kelas', 'angkatan'].includes(targetScope)) targetScope = 'all'
  const kelasIds = formData.getAll('kelas_ids').map(v => String(v || '').trim()).filter(Boolean)
  const tingkatRaw = String(formData.get('tingkat') || '').trim()
  const tingkat = tingkatRaw ? Number.parseInt(tingkatRaw, 10) : null
  const expiresAt = String(formData.get('expires_at') || '').trim() || null
  const publishAt = String(formData.get('publish_at') || '').trim() || null

  const isWaliOnly = currentRoles.includes('wali_kelas') && !currentRoles.some(r => ['super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(r))

  if (!title || !body) return
  if (isWaliOnly) targetScope = 'kelas'
  if (targetScope === 'kelas' && kelasIds.length === 0) return
  if (targetScope === 'angkatan' && !tingkat) return

  let allowedKelasIds: string[] = []
  if (isWaliOnly) {
    const kelasRows = await db.prepare(`
      SELECT id FROM kelas WHERE wali_kelas_id = ?
    `).bind(currentUser.id).all()
    allowedKelasIds = (kelasRows.results || []).map((r: any) => r.id)
    if (allowedKelasIds.length === 0) return
    for (const kid of kelasIds) {
      if (!allowedKelasIds.includes(kid)) return
    }
  }

  const inserted = await db.prepare(`
    INSERT INTO parent_announcements
      (title, body, target_scope, kelas_id, is_active, publish_at, expires_at, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, COALESCE(?, datetime('now')), ?, ?, datetime('now'), datetime('now'))
  `).bind(
    title,
    body,
    targetScope,
    targetScope === 'kelas' && kelasIds.length === 1 ? kelasIds[0] : null,
    publishAt,
    expiresAt,
    currentUser.id
  ).run()

  const announcementId = String((inserted as any)?.meta?.last_row_id || '')
  const getId = await db.prepare(`
    SELECT id FROM parent_announcements
    WHERE rowid = ?
    LIMIT 1
  `).bind(announcementId).first()
  const resolvedAnnouncementId = (getId as any)?.id as string | undefined
  if (!resolvedAnnouncementId) {
    revalidatePath('/dashboard/pengumuman-ortu')
    revalidatePath('/portal-ortu')
    return
  }

  if (targetScope === 'kelas') {
    for (const kelasId of kelasIds) {
      await db.prepare(`
        INSERT INTO parent_announcement_targets (announcement_id, target_type, kelas_id)
        VALUES (?, 'kelas', ?)
      `).bind(resolvedAnnouncementId, kelasId).run()
    }
  } else if (targetScope === 'angkatan' && tingkat) {
    await db.prepare(`
      INSERT INTO parent_announcement_targets (announcement_id, target_type, tingkat)
      VALUES (?, 'angkatan', ?)
    `).bind(resolvedAnnouncementId, tingkat).run()
  }

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
