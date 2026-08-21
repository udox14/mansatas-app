async function syncAssignedRole(
  db: D1Database,
  role: 'pembina_ekstrakurikuler' | 'guru_piket',
  label: string,
  assignmentQuery: string
) {
  await db.prepare('INSERT OR IGNORE INTO master_roles (value, label, is_custom) VALUES (?, ?, 0)')
    .bind(role, label).run()
  const assigned = await db.prepare(assignmentQuery).all<{ user_id: string }>()
  const activeIds = new Set((assigned.results || []).map(row => row.user_id))

  for (const userId of activeIds) {
    const roles = await db.prepare('SELECT role FROM user_roles WHERE user_id = ?')
      .bind(userId).all<{ role: string }>()
    if (!roles.results?.length) {
      const user = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(userId).first<{ role: string }>()
      await db.batch([
        db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)').bind(userId, user?.role || 'guru'),
        db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)').bind(userId, role),
      ])
    } else if (!roles.results.some(row => row.role === role)) {
      await db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)').bind(userId, role).run()
    }
  }

  const oldRoles = await db.prepare('SELECT user_id FROM user_roles WHERE role = ?').bind(role).all<{ user_id: string }>()
  for (const row of oldRoles.results || []) {
    if (activeIds.has(row.user_id)) continue
    await db.prepare('DELETE FROM user_roles WHERE user_id = ? AND role = ?').bind(row.user_id, role).run()
    const user = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(row.user_id).first<{ role: string }>()
    if (user?.role === role) {
      const remaining = await db.prepare('SELECT role FROM user_roles WHERE user_id = ?').bind(row.user_id).all<{ role: string }>()
      await db.prepare('UPDATE "user" SET role = ?, updatedAt = datetime(\'now\') WHERE id = ?')
        .bind(remaining.results?.[0]?.role || 'guru', row.user_id).run()
    }
  }
}

export function syncPembinaRoles(db: D1Database) {
  return syncAssignedRole(
    db,
    'pembina_ekstrakurikuler',
    'Pembina Ekstrakurikuler',
    "SELECT DISTINCT pembina_id AS user_id FROM ekstrakurikuler_pembina WHERE pembina_id IS NOT NULL AND pembina_id != ''"
  )
}

export function syncGuruPiketRoles(db: D1Database) {
  return syncAssignedRole(
    db,
    'guru_piket',
    'Guru Piket',
    "SELECT DISTINCT user_id FROM jadwal_guru_piket WHERE user_id IS NOT NULL AND user_id != ''"
  )
}
