'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { ensureParentSuggestionTable, normalizeParentSuggestionStatus } from '@/lib/parent-suggestions'

async function guard() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', user: null, db: null as any }
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'kotak-saran-ortu')
  if (!allowed) return { error: 'Akses ditolak.', user: null, db: null as any }
  await ensureParentSuggestionTable(db)
  return { error: null, user, db }
}

export async function updateParentSuggestionStatus(formData: FormData) {
  const { error, user, db } = await guard()
  if (error) return

  const id = String(formData.get('id') || '').trim()
  const status = normalizeParentSuggestionStatus(formData.get('status'))
  if (!id || !status) return

  await db.prepare(`
    UPDATE parent_suggestions
    SET status = ?,
        read_at = CASE WHEN read_at IS NULL THEN datetime('now') ELSE read_at END,
        handled_by = ?,
        handled_at = CASE WHEN ? IN ('diproses', 'selesai') THEN datetime('now') ELSE handled_at END,
        updated_at = datetime('now')
    WHERE id = ?
  `).bind(status, user!.id, status, id).run()

  revalidatePath('/dashboard/kotak-saran-ortu')
}
