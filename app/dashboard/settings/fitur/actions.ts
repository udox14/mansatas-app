// app/dashboard/settings/fitur/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { DEFAULT_SIDEBAR_GROUPS, MENU_ITEMS, type SidebarGroupConfig } from '@/config/menu'

async function ensureSidebarConfigTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS role_sidebar_configs (
      role TEXT PRIMARY KEY,
      groups_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role) REFERENCES master_roles(value) ON DELETE CASCADE
    )
  `).run()
}

async function ensureFeatureDisplayTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS feature_display_settings (
      feature_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
}

// ============================================================
// ROLE FEATURES CRUD
// ============================================================

/**
 * Get all role-feature mappings from DB
 * Also reads roles from master_roles table (includes custom roles)
 */
export async function getRoleFeatureMatrix(): Promise<{
  matrix: Record<string, string[]>
  roles: { value: string; label: string; is_custom: number; mobile_nav_links: string; sidebar_config: string }[]
  featureLabels: Record<string, string>
}> {
  const db = await getDB()
  await Promise.all([ensureSidebarConfigTable(db), ensureFeatureDisplayTable(db)])
  const [featResult, rolesResult, labelsResult] = await Promise.all([
    db.prepare('SELECT role, feature_id FROM role_features ORDER BY role, feature_id').all<{ role: string; feature_id: string }>(),
    db.prepare(`
      SELECT mr.value, mr.label, mr.is_custom, mr.mobile_nav_links, COALESCE(rsc.groups_json, '') AS sidebar_config
      FROM master_roles mr
      LEFT JOIN role_sidebar_configs rsc ON rsc.role = mr.value
      ORDER BY mr.is_custom ASC, mr.label ASC
    `).all<{ value: string; label: string; is_custom: number; mobile_nav_links: string; sidebar_config: string }>(),
    db.prepare('SELECT feature_id, title FROM feature_display_settings ORDER BY feature_id').all<{ feature_id: string; title: string }>(),
  ])

  const roles = rolesResult.results ?? []
  const featureLabels: Record<string, string> = {}
  for (const row of labelsResult.results ?? []) featureLabels[row.feature_id] = row.title
  const matrix: Record<string, string[]> = {}
  for (const r of roles) matrix[r.value] = []

  for (const row of featResult.results ?? []) {
    if (!matrix[row.role]) matrix[row.role] = []
    matrix[row.role].push(row.feature_id)
  }
  return { matrix, roles, featureLabels }
}

/**
 * Toggle a feature for a role (enable/disable)
 */
export async function toggleRoleFeature(role: string, featureId: string, enabled: boolean) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  // Only super_admin can manage features
  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<any>()
  if (userRow?.role !== 'super_admin') return { error: 'Hanya Super Admin yang bisa mengelola fitur.' }

  if (enabled) {
    await db.prepare(
      'INSERT OR IGNORE INTO role_features (role, feature_id) VALUES (?, ?)'
    ).bind(role, featureId).run()
  } else {
    await db.prepare(
      'DELETE FROM role_features WHERE role = ? AND feature_id = ?'
    ).bind(role, featureId).run()
  }

  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Batch update: set all features for a role
 */
export async function setRoleFeatures(role: string, featureIds: string[]) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<any>()
  if (userRow?.role !== 'super_admin') return { error: 'Hanya Super Admin yang bisa mengelola fitur.' }

  // Delete existing, then insert new
  const stmts: D1PreparedStatement[] = [
    db.prepare('DELETE FROM role_features WHERE role = ?').bind(role),
    ...featureIds.map(fid =>
      db.prepare('INSERT INTO role_features (role, feature_id) VALUES (?, ?)').bind(role, fid)
    )
  ]

  await db.batch(stmts)

  revalidatePath('/dashboard')
  return { success: true }
}

// ============================================================
// USER ROLE MANAGEMENT (multi-role)
// ============================================================

/**
 * Get all roles for a user
 */
export async function getUserRolesAction(userId: string): Promise<string[]> {
  const db = await getDB()
  const result = await db.prepare(
    'SELECT role FROM user_roles WHERE user_id = ?'
  ).bind(userId).all<{ role: string }>()
  return result.results?.map(r => r.role) ?? []
}

/**
 * Set roles for a user (replaces all existing)
 */
export async function setUserRoles(userId: string, roles: string[], primaryRole: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  if (roles.length === 0) return { error: 'User harus memiliki minimal 1 role.' }
  if (!roles.includes(primaryRole)) return { error: 'Role utama harus termasuk dalam daftar role.' }

  const db = await getDB()

  const stmts: D1PreparedStatement[] = [
    // Update primary role di tabel user
    db.prepare('UPDATE "user" SET role = ?, updatedAt = datetime(\'now\') WHERE id = ?').bind(primaryRole, userId),
    // Clear existing roles
    db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(userId),
    // Insert new roles
    ...roles.map(role =>
      db.prepare('INSERT INTO user_roles (user_id, role) VALUES (?, ?)').bind(userId, role)
    )
  ]

  await db.batch(stmts)

  revalidatePath('/dashboard/guru')
  revalidatePath('/dashboard')
  return { success: 'Role berhasil diperbarui.' }
}

// ============================================================
// USER FEATURE OVERRIDES
// ============================================================

/**
 * Get feature overrides for a specific user
 */
export async function getUserFeatureOverridesAction(userId: string): Promise<{
  grants: string[]
  revokes: string[]
}> {
  const db = await getDB()
  const result = await db.prepare(
    'SELECT feature_id, action FROM user_feature_overrides WHERE user_id = ?'
  ).bind(userId).all<{ feature_id: string; action: string }>()

  const grants: string[] = []
  const revokes: string[] = []
  for (const row of result.results ?? []) {
    if (row.action === 'grant') grants.push(row.feature_id)
    else revokes.push(row.feature_id)
  }
  return { grants, revokes }
}

/**
 * Set a user feature override (grant, revoke, or remove override)
 */
export async function setUserFeatureOverride(
  userId: string,
  featureId: string,
  action: 'grant' | 'revoke' | 'remove'
) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()

  if (action === 'remove') {
    await db.prepare(
      'DELETE FROM user_feature_overrides WHERE user_id = ? AND feature_id = ?'
    ).bind(userId, featureId).run()
  } else {
    // Upsert: INSERT OR REPLACE
    await db.prepare(
      `INSERT INTO user_feature_overrides (user_id, feature_id, action) 
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, feature_id) DO UPDATE SET action = excluded.action`
    ).bind(userId, featureId, action).run()
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/guru')
  return { success: true }
}

/**
 * Batch set user overrides
 */
export async function setUserFeatureOverrides(
  userId: string,
  overrides: { featureId: string; action: 'grant' | 'revoke' }[]
) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()

  const stmts: D1PreparedStatement[] = [
    db.prepare('DELETE FROM user_feature_overrides WHERE user_id = ?').bind(userId),
    ...overrides.map(o =>
      db.prepare(
        'INSERT INTO user_feature_overrides (user_id, feature_id, action) VALUES (?, ?, ?)'
      ).bind(userId, o.featureId, o.action)
    )
  ]

  await db.batch(stmts)

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/guru')
  return { success: true }
}

// ============================================================
// MASTER ROLES CRUD
// ============================================================

export type MasterRole = { value: string; label: string; is_custom: number; mobile_nav_links: string }

/**
 * Get all roles from master_roles table
 */
export async function getAllMasterRoles(): Promise<MasterRole[]> {
  const db = await getDB()
  const result = await db.prepare(
    'SELECT value, label, is_custom, mobile_nav_links FROM master_roles ORDER BY is_custom ASC, label ASC'
  ).all<MasterRole>()
  return result.results ?? []
}

/**
 * Create a new custom role
 */
export async function createCustomRole(label: string, value: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<any>()
  if (userRow?.role !== 'super_admin') return { error: 'Hanya Super Admin yang bisa membuat role.' }

  // Validasi slug: lowercase, underscore only
  const slug = value.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/__+/g, '_').replace(/^_|_$/g, '')
  if (!slug) return { error: 'Nama role tidak valid.' }
  if (!label.trim()) return { error: 'Label role tidak boleh kosong.' }

  try {
    await db.prepare(
      'INSERT INTO master_roles (value, label, is_custom) VALUES (?, ?, 1)'
    ).bind(slug, label.trim()).run()
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return { error: `Role dengan ID "${slug}" sudah ada.` }
    return { error: e.message }
  }

  revalidatePath('/dashboard/settings/fitur')
  return { success: true, slug }
}

/**
 * Edit label of an existing custom role
 */
export async function editCustomRole(value: string, newLabel: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<any>()
  if (userRow?.role !== 'super_admin') return { error: 'Hanya Super Admin yang bisa mengedit role.' }

  if (!newLabel.trim()) return { error: 'Label tidak boleh kosong.' }

  await db.prepare(
    'UPDATE master_roles SET label = ? WHERE value = ?'
  ).bind(newLabel.trim(), value).run()

  revalidatePath('/dashboard/settings/fitur')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Delete a custom role (only if no users are assigned to it)
 */
export async function deleteCustomRole(value: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<any>()
  if (userRow?.role !== 'super_admin') return { error: 'Hanya Super Admin yang bisa menghapus role.' }

  // Cek apakah role ini masih dipakai oleh user
  const inUse = await db.prepare(
    'SELECT COUNT(*) as cnt FROM user_roles WHERE role = ?'
  ).bind(value).first<{ cnt: number }>()

  if ((inUse?.cnt ?? 0) > 0) {
    return { error: `Role ini masih dipakai oleh ${inUse!.cnt} user. Hapus assignment dulu.` }
  }

  // Hapus dari role_features dan master_roles
  await db.batch([
    db.prepare('DELETE FROM role_features WHERE role = ?').bind(value),
    db.prepare('DELETE FROM master_roles WHERE value = ?').bind(value),
  ])

  revalidatePath('/dashboard/settings/fitur')
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Update mobile nav links for a role
 */
export async function setRoleMobileNav(value: string, navLinks: string[]) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<any>()
  if (userRow?.role !== 'super_admin') return { error: 'Hanya Super Admin yang bisa mengedit role.' }

  const jsonStr = JSON.stringify(navLinks)
  await db.prepare(
    'UPDATE master_roles SET mobile_nav_links = ? WHERE value = ?'
  ).bind(jsonStr, value).run()

  revalidatePath('/dashboard/settings/fitur')
  revalidatePath('/dashboard')
  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * Update sidebar grouping/order for a role
 */
export async function setRoleSidebarConfig(value: string, groups: SidebarGroupConfig[]) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<any>()
  if (userRow?.role !== 'super_admin') return { error: 'Hanya Super Admin yang bisa mengedit sidebar.' }

  await ensureSidebarConfigTable(db)

  const knownIds = new Set(MENU_ITEMS.map(item => item.id))
  const seen = new Set<string>()
  const cleanGroups = groups
    .map((group, index) => ({
      id: group.id || `group-${index + 1}`,
      label: group.label.trim() || `Group ${index + 1}`,
      items: group.items.filter(id => {
        if (!knownIds.has(id) || seen.has(id)) return false
        seen.add(id)
        return true
      }),
    }))
    .filter(group => group.label || group.items.length > 0)

  const groupsJson = JSON.stringify(cleanGroups.length > 0 ? cleanGroups : DEFAULT_SIDEBAR_GROUPS)
  await db.prepare(`
    INSERT INTO role_sidebar_configs (role, groups_json, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(role) DO UPDATE SET
      groups_json = excluded.groups_json,
      updated_at = CURRENT_TIMESTAMP
  `).bind(value, groupsJson).run()

  revalidatePath('/dashboard/settings/fitur')
  revalidatePath('/dashboard')
  revalidatePath('/', 'layout')
  return { success: true, groupsJson }
}

/**
 * Update display label for a feature. This does not change feature_id or route.
 */
export async function setFeatureDisplayTitle(featureId: string, title: string) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<any>()
  if (userRow?.role !== 'super_admin') return { error: 'Hanya Super Admin yang bisa rename fitur.' }

  const feature = MENU_ITEMS.find(item => item.id === featureId)
  if (!feature) return { error: 'Fitur tidak ditemukan.' }

  await ensureFeatureDisplayTable(db)

  const cleanTitle = title.trim()
  if (!cleanTitle) return { error: 'Nama fitur tidak boleh kosong.' }

  if (cleanTitle === feature.title) {
    await db.prepare('DELETE FROM feature_display_settings WHERE feature_id = ?').bind(featureId).run()
  } else {
    await db.prepare(`
      INSERT INTO feature_display_settings (feature_id, title, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(feature_id) DO UPDATE SET
        title = excluded.title,
        updated_at = CURRENT_TIMESTAMP
    `).bind(featureId, cleanTitle).run()
  }

  revalidatePath('/dashboard/settings/fitur')
  revalidatePath('/dashboard')
  revalidatePath('/', 'layout')
  return { success: true, title: cleanTitle }
}
