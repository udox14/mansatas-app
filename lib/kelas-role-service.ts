export async function syncAllWaliKelasRoles(db: D1Database) {
  await db.prepare(`
    INSERT OR IGNORE INTO master_roles (value, label, is_custom)
    VALUES ('wali_kelas', 'Wali Kelas', 0)
  `).run()

  const walisRes = await db.prepare(`
    SELECT DISTINCT wali_kelas_id FROM kelas WHERE wali_kelas_id IS NOT NULL AND wali_kelas_id != ''
  `).all<{ wali_kelas_id: string }>()
  const activeWaliIds = new Set((walisRes.results || []).map(row => row.wali_kelas_id))

  for (const userId of activeWaliIds) {
    const rolesRes = await db.prepare('SELECT role FROM user_roles WHERE user_id = ?')
      .bind(userId).all<{ role: string }>()
    const existingRoles = (rolesRes.results || []).map(row => row.role)

    if (existingRoles.length === 0) {
      const user = await db.prepare('SELECT role FROM "user" WHERE id = ?')
        .bind(userId).first<{ role: string }>()
      await db.batch([
        db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)').bind(userId, user?.role || 'guru'),
        db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)').bind(userId, 'wali_kelas'),
      ])
    } else if (!existingRoles.includes('wali_kelas')) {
      await db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)')
        .bind(userId, 'wali_kelas').run()
    }
  }

  const oldRoles = await db.prepare("SELECT user_id FROM user_roles WHERE role = 'wali_kelas'")
    .all<{ user_id: string }>()
  for (const row of oldRoles.results || []) {
    if (activeWaliIds.has(row.user_id)) continue
    await db.prepare("DELETE FROM user_roles WHERE user_id = ? AND role = 'wali_kelas'").bind(row.user_id).run()
    const user = await db.prepare('SELECT role FROM "user" WHERE id = ?').bind(row.user_id).first<{ role: string }>()
    if (user?.role === 'wali_kelas') {
      const remaining = await db.prepare('SELECT role FROM user_roles WHERE user_id = ?')
        .bind(row.user_id).all<{ role: string }>()
      await db.prepare('UPDATE "user" SET role = ?, updatedAt = datetime(\'now\') WHERE id = ?')
        .bind(remaining.results?.[0]?.role || 'guru', row.user_id).run()
    }
  }
}
