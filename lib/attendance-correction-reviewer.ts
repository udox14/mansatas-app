import { canDecideAttendanceCorrection, canReviewAttendanceCorrection } from './attendance-correction'
import { checkFeatureAccess, getUserRoles } from './features'
import { isPlayReviewerRole } from './play-reviewer'

export async function getAttendanceCorrectionReviewer(db: D1Database, userId: string) {
  const profile = await db.prepare(`SELECT jabatan_struktural_id, COALESCE(nama_lengkap, name, id) AS display_name
    FROM "user" WHERE id = ? AND COALESCE(banned, 0) = 0`).bind(userId)
    .first<{ jabatan_struktural_id: string | null; display_name: string }>()
  if (!profile) return null
  const roles = await getUserRoles(db, userId)
  if (isPlayReviewerRole(roles) || !canReviewAttendanceCorrection(roles, profile.jabatan_struktural_id) ||
    !await checkFeatureAccess(db, userId, 'keterangan-absensi')) return null
  return { roles, reviewerName: profile.display_name }
}

export async function attendanceCorrectionNotificationRecipients(db: D1Database, requesterId: string, candidates?: string[]) {
  const ids = candidates ?? (await db.prepare(`SELECT DISTINCT u.id FROM "user" u
    WHERE COALESCE(u.banned, 0) = 0 AND (
      EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role IN ('super_admin','kepsek','wakamad'))
      OR (u.role IN ('super_admin','kepsek','wakamad') AND NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id))
    ) ORDER BY u.id`).all<{ id: string }>()).results?.map(row => row.id) ?? []

  const recipients: string[] = []
  const uniqueIds = [...new Set(ids)]
  for (let offset = 0; offset < uniqueIds.length; offset += 10) {
    const eligible = await Promise.all(uniqueIds.slice(offset, offset + 10).map(async id => {
      const reviewer = await getAttendanceCorrectionReviewer(db, id)
      return reviewer && canDecideAttendanceCorrection(reviewer.roles, id, requesterId, 'APPROVED') ? id : null
    }))
    for (const id of eligible) if (id) recipients.push(id)
  }
  return recipients
}
