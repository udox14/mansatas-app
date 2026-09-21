// lib/features.ts
// Resolves user access to features based on multi-role + overrides

import { MENU_ITEMS } from '@/config/menu'
import { isPlayReviewerRole, PLAY_REVIEWER_ROLE } from '@/lib/play-reviewer'
import { logSecurityEvent } from '@/lib/security-log'

export type CrudAction = 'create' | 'read' | 'update' | 'delete'

/**
 * Get all roles for a user from user_roles table
 * Falls back to user.role column if user_roles is empty
 */
export async function getUserRoles(db: D1Database, userId: string): Promise<string[]> {
  const result = await db.prepare(
    'SELECT role FROM user_roles WHERE user_id = ?'
  ).bind(userId).all<{ role: string }>()

  let roles = result.results?.map(r => r.role) ?? []

  // Fallback: jika user_roles kosong, pakai kolom user.role
  if (roles.length === 0) {
    const user = await db.prepare(
      'SELECT role FROM "user" WHERE id = ?'
    ).bind(userId).first<{ role: string }>()
    if (user?.role) roles = [user.role]
  }

  // Reviewer perlu melihat cabang UI admin yang masih memakai pemeriksaan role lama.
  // Role reviewer tetap disertakan dan selalu menang pada seluruh pemeriksaan write.
  return isPlayReviewerRole(roles) ? Array.from(new Set([...roles, 'super_admin'])) : roles
}

/**
 * Get the primary/display role for a user
 * Primary role = user.role column (bisa diubah admin)
 */
export async function getPrimaryRole(db: D1Database, userId: string): Promise<string> {
  const user = await db.prepare(
    'SELECT role FROM "user" WHERE id = ?'
  ).bind(userId).first<{ role: string }>()
  return user?.role || 'guru'
}

/**
 * Get all feature_ids that a set of roles grants access to
 * Reads from role_features table in DB
 */
export async function getRoleFeatures(db: D1Database, roles: string[]): Promise<Set<string>> {
  if (roles.length === 0) return new Set()

  const placeholders = roles.map(() => '?').join(',')
  const result = await db.prepare(
    `SELECT DISTINCT feature_id FROM role_features WHERE role IN (${placeholders})`
  ).bind(...roles).all<{ feature_id: string }>()

  return new Set(result.results?.map(r => r.feature_id) ?? [])
}

/**
 * Get user-specific feature overrides (grant/revoke)
 */
export async function getUserOverrides(db: D1Database, userId: string): Promise<{
  grants: Set<string>
  revokes: Set<string>
}> {
  const result = await db.prepare(
    'SELECT feature_id, action FROM user_feature_overrides WHERE user_id = ?'
  ).bind(userId).all<{ feature_id: string; action: string }>()

  const grants = new Set<string>()
  const revokes = new Set<string>()

  for (const row of result.results ?? []) {
    if (row.action === 'grant') grants.add(row.feature_id)
    else if (row.action === 'revoke') revokes.add(row.feature_id)
  }

  return { grants, revokes }
}

/**
 * Resolve final set of allowed feature_ids for a user
 * Formula: (gabungan fitur dari semua role) + grants - revokes
 */
export async function getUserAllowedFeatures(db: D1Database, userId: string): Promise<string[]> {
  const [roles, overrides] = await Promise.all([
    getUserRoles(db, userId),
    getUserOverrides(db, userId),
  ])

  const roleFeatures = await getRoleFeatures(db, roles)

  // Start with role-based features
  const allowed = new Set(roleFeatures)

  // Sarana Prasarana is a structural assignment, not a separate role.
  if (roles.includes('wakamad') && !roles.some(r => ['super_admin', 'admin_tu', 'kepsek'].includes(r))) {
    const structural = await db.prepare('SELECT jabatan_struktural_id FROM "user" WHERE id=?').bind(userId).first<{ jabatan_struktural_id: string | null }>()
    if (structural?.jabatan_struktural_id !== 'jbt_waka_sarpras') allowed.delete('monitoring-pramubakti')
    if (structural?.jabatan_struktural_id !== 'jbt_waka_kurikulum') {
      allowed.delete('audit-akses-agenda')
      allowed.delete('monitoring-agenda')
    }
  }

  // Add grants
  for (const f of overrides.grants) allowed.add(f)

  // Remove revokes
  for (const f of overrides.revokes) allowed.delete(f)

  // View keuangan nonaktif adalah pasangan navigasi dari izin DSPT, bukan izin terpisah.
  if (allowed.has('keuangan-dspt')) allowed.add('keuangan-dspt-nonaktif')
  else allowed.delete('keuangan-dspt-nonaktif')

  // Super admin/reviewer tidak boleh terkunci dari modul sistem akibat seed role_features
  // yang tertinggal atau override lama. MENU_ITEMS menjadi sumber daftar lengkap.
  if (roles.includes('super_admin') || roles.includes(PLAY_REVIEWER_ROLE)) {
    for (const item of MENU_ITEMS) allowed.add(item.id)
  }

  // Dokumentasi bersifat universal untuk semua user internal.
  if (roles.length === 0 || roles.some(role => role !== 'orang_tua')) {
    allowed.add('documentation')
  }

  return Array.from(allowed)
}

/**
 * Check if a user has access to a specific feature
 * Used in page-level access checks
 */
export async function checkFeatureAccess(db: D1Database, userId: string, featureId: string): Promise<boolean> {
  try {
    const features = await getUserAllowedFeatures(db, userId)
    return features.includes(featureId)
  } catch (error) {
    logSecurityEvent('error', 'feature_access_check_failed', { userId, featureId, error })
    return false
  }
}

/**
 * Check if a user has a CRUD action for a feature.
 * Fail closed: izin C/U/D harus memiliki baris eksplisit pada tabel permission.
 * User override grant tanpa permission role tetap memperoleh akses read-only.
 */
export async function checkFeatureCrudAccess(
  db: D1Database,
  userId: string,
  featureId: string,
  action: CrudAction
): Promise<boolean> {
  const hasReadAccess = await checkFeatureAccess(db, userId, featureId)
  if (!hasReadAccess) return false
  const roles = await getUserRoles(db, userId)
  if (roles.length === 0) {
    logSecurityEvent('warning', 'feature_crud_role_missing', { userId, featureId, action })
    return false
  }

  const columnMap: Record<CrudAction, string> = {
    create: 'can_create',
    read: 'can_read',
    update: 'can_update',
    delete: 'can_delete',
  }
  const column = columnMap[action]
  const placeholders = roles.map(() => '?').join(',')

  try {
    const [result, overrides] = await Promise.all([
      db.prepare(`
      SELECT COUNT(*) as configured_count, MAX(can_read) as readable, MAX(${column}) as allowed
      FROM role_feature_permissions
      WHERE feature_id = ?
        AND role IN (${placeholders})
    `).bind(featureId, ...roles).first(),
      getUserOverrides(db, userId),
    ])
    const row = result as { configured_count: number; readable: number | null; allowed: number | null } | null
    const userReadGrant = overrides.grants.has(featureId) && !overrides.revokes.has(featureId)
    if (!row || row.configured_count === 0) {
      if (action === 'read' && userReadGrant) return true
      logSecurityEvent('warning', 'feature_crud_permission_missing', { userId, featureId, action, roles })
      return false
    }
    if (action === 'read') return row.readable === 1 || userReadGrant
    if (isPlayReviewerRole(roles)) return false
    return row.readable === 1 && row.allowed === 1
  } catch (error) {
    logSecurityEvent('error', 'feature_crud_check_failed', { userId, featureId, action, error })
    return false
  }
}

/**
 * Get allowed menu items for rendering sidebar
 * Returns MENU_ITEMS filtered by user's allowed features
 */
export async function getAllowedMenuItems(db: D1Database, userId: string) {
  const allowedFeatures = await getUserAllowedFeatures(db, userId)
  const allowedSet = new Set(allowedFeatures)
  return MENU_ITEMS.filter(item => allowedSet.has(item.id))
}
