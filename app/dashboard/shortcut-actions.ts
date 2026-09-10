'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getUserAllowedFeatures, getUserRoles } from '@/lib/features'
import { isPlayReviewerRole, PLAY_REVIEWER_WRITE_ERROR } from '@/lib/play-reviewer'
import { validateDashboardShortcuts } from '@/lib/dashboard-menu'

export async function saveDashboardShortcuts(ids: string[]): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Anda belum login. Silakan masuk kembali.' }
  try {
    const db = await getDB()
    const [roles, allowed] = await Promise.all([getUserRoles(db, user.id), getUserAllowedFeatures(db, user.id)])
    if (isPlayReviewerRole(roles)) return { error: PLAY_REVIEWER_WRITE_ERROR }
    const error = validateDashboardShortcuts(ids, allowed)
    if (error) return { error }
    const result = await db.prepare(`
      INSERT INTO user_dashboard_preferences (user_id, shortcut_ids, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET shortcut_ids = excluded.shortcut_ids, updated_at = CURRENT_TIMESTAMP
    `).bind(user.id, JSON.stringify(ids)).run()
    if (!result.success) return { error: 'Menu favorit belum tersimpan. Silakan coba lagi.' }
    revalidatePath('/dashboard', 'layout')
    return { success: true }
  } catch {
    return { error: 'Menu favorit belum tersimpan. Silakan coba lagi atau hubungi admin.' }
  }
}
