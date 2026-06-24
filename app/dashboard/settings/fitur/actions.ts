// app/dashboard/settings/fitur/actions.ts
'use server'

import { getDB } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import {
  DEFAULT_SIDEBAR_GROUPS,
  MENU_ITEMS,
  SIDEBAR_ROOT_ITEM_IDS,
  normalizeSidebarRoleOverride,
  parseSidebarGroups,
  serializeSidebarRoleOverride,
  type SidebarGroupConfig,
  type SidebarRoleOverrideConfig,
} from '@/config/menu'
import { createActivityDiff, logActivity } from '@/lib/activity-log'

const SIDEBAR_TEMPLATE_KEY = 'default'

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

async function ensureSidebarTemplateTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS sidebar_template_config (
      id TEXT PRIMARY KEY DEFAULT '${SIDEBAR_TEMPLATE_KEY}',
      groups_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  await db.prepare(`
    INSERT OR IGNORE INTO sidebar_template_config (id, groups_json, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).bind(SIDEBAR_TEMPLATE_KEY, JSON.stringify(DEFAULT_SIDEBAR_GROUPS)).run()
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

async function ensureRoleFeaturePermissionsTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS role_feature_permissions (
      role TEXT NOT NULL,
      feature_id TEXT NOT NULL,
      can_create INTEGER NOT NULL DEFAULT 1,
      can_read INTEGER NOT NULL DEFAULT 1,
      can_update INTEGER NOT NULL DEFAULT 1,
      can_delete INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role, feature_id),
      FOREIGN KEY (role) REFERENCES master_roles(value) ON DELETE CASCADE
    )
  `).run()
}

export type CrudPermission = {
  create: boolean
  read: boolean
  update: boolean
  delete: boolean
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
  permissions: Record<string, Record<string, CrudPermission>>
  roles: { value: string; label: string; is_custom: number; mobile_nav_links: string; sidebar_config: string }[]
  featureLabels: Record<string, string>
  sidebarTemplate: SidebarGroupConfig[]
}> {
  const db = await getDB()
  await Promise.all([ensureSidebarConfigTable(db), ensureSidebarTemplateTable(db), ensureFeatureDisplayTable(db), ensureRoleFeaturePermissionsTable(db)])
  const [featResult, rolesResult, labelsResult, permissionsResult, sidebarTemplateResult] = await Promise.all([
    db.prepare('SELECT role, feature_id FROM role_features ORDER BY role, feature_id').all<{ role: string; feature_id: string }>(),
    db.prepare(`
      SELECT mr.value, mr.label, mr.is_custom, mr.mobile_nav_links, COALESCE(rsc.groups_json, '') AS sidebar_config
      FROM master_roles mr
      LEFT JOIN role_sidebar_configs rsc ON rsc.role = mr.value
      ORDER BY mr.is_custom ASC, mr.label ASC
    `).all<{ value: string; label: string; is_custom: number; mobile_nav_links: string; sidebar_config: string }>(),
    db.prepare('SELECT feature_id, title FROM feature_display_settings ORDER BY feature_id').all<{ feature_id: string; title: string }>(),
    db.prepare(`
      SELECT role, feature_id, can_create, can_read, can_update, can_delete
      FROM role_feature_permissions
      ORDER BY role, feature_id
    `).all<{ role: string; feature_id: string; can_create: number; can_read: number; can_update: number; can_delete: number }>(),
    db.prepare('SELECT groups_json FROM sidebar_template_config WHERE id = ?').bind(SIDEBAR_TEMPLATE_KEY).first<{ groups_json: string }>(),
  ])

  const roles = rolesResult.results ?? []
  const featureLabels: Record<string, string> = {}
  for (const row of labelsResult.results ?? []) featureLabels[row.feature_id] = row.title
  const matrix: Record<string, string[]> = {}
  const permissions: Record<string, Record<string, CrudPermission>> = {}
  for (const r of roles) matrix[r.value] = []
  for (const r of roles) permissions[r.value] = {}

  for (const row of featResult.results ?? []) {
    if (!matrix[row.role]) matrix[row.role] = []
    matrix[row.role].push(row.feature_id)
  }

  for (const row of permissionsResult.results ?? []) {
    if (!permissions[row.role]) permissions[row.role] = {}
    permissions[row.role][row.feature_id] = {
      create: row.can_create === 1,
      read: row.can_read === 1,
      update: row.can_update === 1,
      delete: row.can_delete === 1,
    }
  }

  for (const [role, featureIds] of Object.entries(matrix)) {
    if (!permissions[role]) permissions[role] = {}
    for (const featureId of featureIds) {
      if (!permissions[role][featureId]) {
        permissions[role][featureId] = { create: true, read: true, update: true, delete: true }
      }
    }
  }

  return {
    matrix,
    permissions,
    roles,
    featureLabels,
    sidebarTemplate: parseSidebarGroups(sidebarTemplateResult?.groups_json, DEFAULT_SIDEBAR_GROUPS),
  }
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
    await ensureRoleFeaturePermissionsTable(db)
    await db.batch([
      db.prepare(
        'INSERT OR IGNORE INTO role_features (role, feature_id) VALUES (?, ?)'
      ).bind(role, featureId),
      db.prepare(`
        INSERT OR IGNORE INTO role_feature_permissions
          (role, feature_id, can_create, can_read, can_update, can_delete)
        VALUES (?, ?, 1, 1, 1, 1)
      `).bind(role, featureId),
    ])
  } else {
    await db.batch([
      db.prepare(
        'DELETE FROM role_features WHERE role = ? AND feature_id = ?'
      ).bind(role, featureId),
      db.prepare(
        'DELETE FROM role_feature_permissions WHERE role = ? AND feature_id = ?'
      ).bind(role, featureId),
    ])
  }

  await logActivity({
    db,
    module: 'akses',
    action: enabled ? 'enable_role_feature' : 'disable_role_feature',
    severity: 'warning',
    summary: `${enabled ? 'Mengaktifkan' : 'Menonaktifkan'} akses fitur ${featureId} untuk role ${role}`,
    entityType: 'role_feature',
    entityId: `${role}:${featureId}`,
    entityLabel: `${role} - ${featureId}`,
    before: { role, featureId, enabled: !enabled },
    after: { role, featureId, enabled },
  })

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
  await ensureRoleFeaturePermissionsTable(db)
  const beforeRows = await db.prepare('SELECT feature_id FROM role_features WHERE role = ? ORDER BY feature_id ASC').bind(role).all<{ feature_id: string }>()
  const before = { role, featureIds: beforeRows.results?.map(row => row.feature_id) ?? [] }
  const stmts: D1PreparedStatement[] = [
    db.prepare('DELETE FROM role_features WHERE role = ?').bind(role),
    db.prepare('DELETE FROM role_feature_permissions WHERE role = ?').bind(role),
    ...featureIds.map(fid =>
      db.prepare('INSERT INTO role_features (role, feature_id) VALUES (?, ?)').bind(role, fid)
    ),
    ...featureIds.map(fid =>
      db.prepare(`
        INSERT INTO role_feature_permissions
          (role, feature_id, can_create, can_read, can_update, can_delete)
        VALUES (?, ?, 1, 1, 1, 1)
      `).bind(role, fid)
    ),
  ]

  await db.batch(stmts)

  const after = { role, featureIds }
  await logActivity({
    db,
    module: 'akses',
    action: 'set_role_features',
    severity: 'warning',
    summary: `Mengubah daftar fitur role ${role}`,
    entityType: 'role',
    entityId: role,
    entityLabel: role,
    before,
    after,
    diff: createActivityDiff(before, after),
  })

  revalidatePath('/dashboard')
  return { success: true }
}

export async function setRoleFeaturePermission(
  role: string,
  featureId: string,
  action: keyof CrudPermission,
  enabled: boolean
) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<any>()
  if (userRow?.role !== 'super_admin') return { error: 'Hanya Super Admin yang bisa mengelola hak CRUD.' }

  await ensureRoleFeaturePermissionsTable(db)
  const before = await db.prepare(`
    SELECT role, feature_id, can_create, can_read, can_update, can_delete
    FROM role_feature_permissions
    WHERE role = ? AND feature_id = ?
  `).bind(role, featureId).first<any>()

  const allowedActions: Array<keyof CrudPermission> = ['create', 'read', 'update', 'delete']
  if (!allowedActions.includes(action)) return { error: 'Aksi tidak valid.' }

  const columnMap: Record<keyof CrudPermission, string> = {
    create: 'can_create',
    read: 'can_read',
    update: 'can_update',
    delete: 'can_delete',
  }
  const column = columnMap[action]

  if (action === 'read') {
    if (enabled) {
      await db.batch([
        db.prepare('INSERT OR IGNORE INTO role_features (role, feature_id) VALUES (?, ?)').bind(role, featureId),
        db.prepare(`
          INSERT INTO role_feature_permissions
            (role, feature_id, can_create, can_read, can_update, can_delete, updated_at)
          VALUES (?, ?, 1, 1, 1, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(role, feature_id) DO UPDATE SET
            can_read = 1,
            updated_at = CURRENT_TIMESTAMP
        `).bind(role, featureId),
      ])
    } else {
      await db.batch([
        db.prepare('DELETE FROM role_features WHERE role = ? AND feature_id = ?').bind(role, featureId),
        db.prepare('DELETE FROM role_feature_permissions WHERE role = ? AND feature_id = ?').bind(role, featureId),
      ])
    }
  } else {
    const hasFeature = await db.prepare(
      'SELECT 1 FROM role_features WHERE role = ? AND feature_id = ? LIMIT 1'
    ).bind(role, featureId).first()
    if (!hasFeature) return { error: 'Aktifkan akses fitur terlebih dahulu sebelum mengatur C/U/D.' }

    await db.prepare(`
      INSERT INTO role_feature_permissions
        (role, feature_id, can_create, can_read, can_update, can_delete, updated_at)
      VALUES (?, ?, 1, 1, 1, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(role, feature_id) DO UPDATE SET
        ${column} = ?,
        can_read = 1,
        updated_at = CURRENT_TIMESTAMP
    `).bind(role, featureId, enabled ? 1 : 0).run()
  }

  const after = await db.prepare(`
    SELECT role, feature_id, can_create, can_read, can_update, can_delete
    FROM role_feature_permissions
    WHERE role = ? AND feature_id = ?
  `).bind(role, featureId).first<any>()
  await logActivity({
    db,
    module: 'akses',
    action: 'set_role_feature_permission',
    severity: 'warning',
    summary: `Mengubah izin ${action} fitur ${featureId} untuk role ${role}`,
    entityType: 'role_feature_permission',
    entityId: `${role}:${featureId}`,
    entityLabel: `${role} - ${featureId}`,
    before,
    after,
    diff: createActivityDiff(before, after),
  })

  revalidatePath('/dashboard/settings/fitur')
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
  const beforeUser = await db.prepare('SELECT id, role, nama_lengkap, name, email FROM "user" WHERE id = ?').bind(userId).first<any>()
  const beforeRoles = await db.prepare('SELECT role FROM user_roles WHERE user_id = ? ORDER BY role ASC').bind(userId).all<{ role: string }>()

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

  await logActivity({
    db,
    module: 'akses',
    action: 'set_user_roles',
    severity: 'warning',
    summary: `Mengubah role user ${beforeUser?.nama_lengkap || beforeUser?.name || userId}`,
    entityType: 'user',
    entityId: userId,
    entityLabel: beforeUser?.nama_lengkap || beforeUser?.name || userId,
    before: { primaryRole: beforeUser?.role, roles: beforeRoles.results?.map(row => row.role) ?? [] },
    after: { primaryRole, roles },
    diff: createActivityDiff(
      { primaryRole: beforeUser?.role, roles: beforeRoles.results?.map(row => row.role) ?? [] },
      { primaryRole, roles }
    ),
  })

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
  const before = await db.prepare('SELECT feature_id, action FROM user_feature_overrides WHERE user_id = ? AND feature_id = ?').bind(userId, featureId).first<any>()

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

  await logActivity({
    db,
    module: 'akses',
    action: 'set_user_feature_override',
    severity: 'warning',
    summary: `Mengubah override fitur ${featureId} untuk user ${userId}`,
    entityType: 'user_feature_override',
    entityId: `${userId}:${featureId}`,
    entityLabel: `${userId} - ${featureId}`,
    before,
    after: action === 'remove' ? null : { user_id: userId, feature_id: featureId, action },
  })

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
  const beforeRows = await db.prepare('SELECT feature_id, action FROM user_feature_overrides WHERE user_id = ? ORDER BY feature_id ASC').bind(userId).all<any>()

  const stmts: D1PreparedStatement[] = [
    db.prepare('DELETE FROM user_feature_overrides WHERE user_id = ?').bind(userId),
    ...overrides.map(o =>
      db.prepare(
        'INSERT INTO user_feature_overrides (user_id, feature_id, action) VALUES (?, ?, ?)'
      ).bind(userId, o.featureId, o.action)
    )
  ]

  await db.batch(stmts)

  await logActivity({
    db,
    module: 'akses',
    action: 'set_user_feature_overrides',
    severity: 'warning',
    summary: `Mengubah semua override fitur untuk user ${userId}`,
    entityType: 'user',
    entityId: userId,
    entityLabel: userId,
    before: beforeRows.results ?? [],
    after: overrides,
  })

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

  await logActivity({
    db,
    module: 'akses',
    action: 'create_custom_role',
    summary: `Membuat custom role ${label.trim()}`,
    entityType: 'role',
    entityId: slug,
    entityLabel: label.trim(),
    after: { value: slug, label: label.trim(), is_custom: 1 },
  })

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

  const before = await db.prepare('SELECT value, label, is_custom FROM master_roles WHERE value = ?').bind(value).first<any>()

  await db.prepare(
    'UPDATE master_roles SET label = ? WHERE value = ?'
  ).bind(newLabel.trim(), value).run()

  await logActivity({
    db,
    module: 'akses',
    action: 'edit_custom_role',
    summary: `Mengubah label role ${value}`,
    entityType: 'role',
    entityId: value,
    entityLabel: newLabel.trim(),
    before,
    after: { ...before, label: newLabel.trim() },
    diff: createActivityDiff(before, { ...before, label: newLabel.trim() }),
  })

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

  const before = await db.prepare('SELECT value, label, is_custom FROM master_roles WHERE value = ?').bind(value).first<any>()
  // Hapus dari role_features dan master_roles
  await db.batch([
    db.prepare('DELETE FROM role_features WHERE role = ?').bind(value),
    db.prepare('DELETE FROM role_feature_permissions WHERE role = ?').bind(value),
    db.prepare('DELETE FROM role_sidebar_configs WHERE role = ?').bind(value),
    db.prepare('DELETE FROM master_roles WHERE value = ?').bind(value),
  ])

  await logActivity({
    db,
    module: 'akses',
    action: 'delete_custom_role',
    severity: 'danger',
    summary: `Menghapus custom role ${before?.label || value}`,
    entityType: 'role',
    entityId: value,
    entityLabel: before?.label || value,
    before,
  })

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

  const before = await db.prepare('SELECT value, label, mobile_nav_links FROM master_roles WHERE value = ?').bind(value).first<any>()
  const jsonStr = JSON.stringify(navLinks)
  await db.prepare(
    'UPDATE master_roles SET mobile_nav_links = ? WHERE value = ?'
  ).bind(jsonStr, value).run()

  const after = { ...before, mobile_nav_links: jsonStr }
  await logActivity({
    db,
    module: 'akses',
    action: 'set_role_mobile_nav',
    summary: `Mengubah mobile nav role ${value}`,
    entityType: 'role',
    entityId: value,
    entityLabel: before?.label || value,
    before,
    after,
    diff: createActivityDiff(before, after),
  })

  revalidatePath('/dashboard/settings/fitur')
  revalidatePath('/dashboard')
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function setSidebarTemplateConfig(groups: SidebarGroupConfig[]) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<any>()
  if (userRow?.role !== 'super_admin') return { error: 'Hanya Super Admin yang bisa mengedit template sidebar.' }

  await ensureSidebarTemplateTable(db)
  const before = await db.prepare('SELECT groups_json FROM sidebar_template_config WHERE id = ?').bind(SIDEBAR_TEMPLATE_KEY).first<any>()

  const knownIds = new Set(MENU_ITEMS.map(item => item.id))
  const rootIds = new Set<string>(SIDEBAR_ROOT_ITEM_IDS)
  const seen = new Set<string>()
  const cleanGroups = groups
    .map((group, index) => ({
      id: group.id || `group-${index + 1}`,
      label: group.label.trim() || `Group ${index + 1}`,
      items: group.items.filter(id => {
        if (!knownIds.has(id) || rootIds.has(id) || seen.has(id)) return false
        seen.add(id)
        return true
      }),
    }))
    .filter(group => group.items.length > 0)

  const groupsJson = JSON.stringify(cleanGroups.length > 0 ? cleanGroups : DEFAULT_SIDEBAR_GROUPS)
  await db.prepare(`
    INSERT INTO sidebar_template_config (id, groups_json, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      groups_json = excluded.groups_json,
      updated_at = CURRENT_TIMESTAMP
  `).bind(SIDEBAR_TEMPLATE_KEY, groupsJson).run()

  await logActivity({
    db,
    module: 'akses',
    action: 'set_sidebar_template',
    summary: 'Mengubah template sidebar default',
    entityType: 'sidebar_template',
    entityId: SIDEBAR_TEMPLATE_KEY,
    entityLabel: 'Default',
    before,
    after: { groups_json: groupsJson },
    diff: createActivityDiff(before, { groups_json: groupsJson }),
  })

  revalidatePath('/dashboard/settings/fitur')
  revalidatePath('/dashboard')
  revalidatePath('/', 'layout')
  return { success: true, groupsJson, groups: JSON.parse(groupsJson) as SidebarGroupConfig[] }
}

/**
 * Update sidebar override for a role. The global sidebar template remains the source of truth.
 */
export async function setRoleSidebarConfig(value: string, override: SidebarRoleOverrideConfig) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const db = await getDB()
  const userRow = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(user.id).first<any>()
  if (userRow?.role !== 'super_admin') return { error: 'Hanya Super Admin yang bisa mengedit override sidebar.' }

  await ensureSidebarConfigTable(db)
  const before = await db.prepare('SELECT role, groups_json FROM role_sidebar_configs WHERE role = ?').bind(value).first<any>()

  const groupsJson = serializeSidebarRoleOverride(normalizeSidebarRoleOverride(override))
  await db.prepare(`
    INSERT INTO role_sidebar_configs (role, groups_json, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(role) DO UPDATE SET
      groups_json = excluded.groups_json,
      updated_at = CURRENT_TIMESTAMP
  `).bind(value, groupsJson).run()

  await logActivity({
    db,
    module: 'akses',
    action: 'set_role_sidebar',
    summary: `Mengubah sidebar role ${value}`,
    entityType: 'role',
    entityId: value,
    entityLabel: value,
    before,
    after: { role: value, groups_json: groupsJson },
    diff: createActivityDiff(before, { role: value, groups_json: groupsJson }),
  })

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
  const before = await db.prepare('SELECT feature_id, title FROM feature_display_settings WHERE feature_id = ?').bind(featureId).first<any>()

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

  await logActivity({
    db,
    module: 'akses',
    action: 'set_feature_display_title',
    summary: `Mengubah nama tampilan fitur ${featureId}`,
    entityType: 'feature',
    entityId: featureId,
    entityLabel: cleanTitle,
    before,
    after: cleanTitle === feature.title ? null : { feature_id: featureId, title: cleanTitle },
  })

  revalidatePath('/dashboard/settings/fitur')
  revalidatePath('/dashboard')
  revalidatePath('/', 'layout')
  return { success: true, title: cleanTitle }
}
