// lib/features.ts
// Resolves user access to features based on multi-role + overrides

import { MENU_ITEMS } from '@/config/menu'

/**
 * Get all roles for a user from user_roles table
 * Falls back to user.role column if user_roles is empty
 */
export async function getUserRoles(db: D1Database, userId: string): Promise<string[]> {
  const result = await db.prepare(
    'SELECT role FROM user_roles WHERE user_id = ?'
  ).bind(userId).all<{ role: string }>()

  const roles = result.results?.map(r => r.role) ?? []

  // Fallback: jika user_roles kosong, pakai kolom user.role
  if (roles.length === 0) {
    const user = await db.prepare(
      'SELECT role FROM "user" WHERE id = ?'
    ).bind(userId).first<{ role: string }>()
    if (user?.role) return [user.role]
  }

  return roles
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

  // Add grants
  for (const f of overrides.grants) allowed.add(f)

  // Remove revokes
  for (const f of overrides.revokes) allowed.delete(f)

  return Array.from(allowed)
}

/**
 * Check if a user has access to a specific feature
 * Used in page-level access checks
 */
export async function checkFeatureAccess(db: D1Database, userId: string, featureId: string): Promise<boolean> {
  const features = await getUserAllowedFeatures(db, userId)
  return features.includes(featureId)
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
