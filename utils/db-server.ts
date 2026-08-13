import { headers } from 'next/headers'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { extractToken } from '@/utils/auth/token'
import { PLAY_REVIEWER_ROLE } from '@/lib/play-reviewer'
import { wrapReviewerDatabase } from '@/lib/reviewer-d1'

export async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true })
  const db = env.DB as D1Database
  const token = extractToken(await headers())
  if (!token) return db

  try {
    const reviewer = await db.prepare(`
      SELECT 1 AS is_reviewer
      FROM session s
      JOIN "user" u ON u.id = s.userId
      WHERE s.token = ? AND (
        u.role = ? OR EXISTS (
          SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = ?
        )
      )
      LIMIT 1
    `).bind(token, PLAY_REVIEWER_ROLE, PLAY_REVIEWER_ROLE).first<{ is_reviewer: number }>()
    return reviewer?.is_reviewer ? wrapReviewerDatabase(db) : db
  } catch {
    // Cookie sesi ada tetapi role gagal diverifikasi: fail closed.
    return wrapReviewerDatabase(db)
  }
}
