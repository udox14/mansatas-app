import { formatNamaKelas } from '@/lib/utils'

type AccountIssue = { id: string; name: string; reason: string }
type AssignmentIssue = {
  id: string
  name: string
  subject: string | null
  grade: number | null
  classNumber: number | null
  groupName: string | null
  date: string
  reason: string
}

const validation = `
  WITH selected AS (SELECT value AS id FROM json_each(?1)),
  accounts AS (
    SELECT s.id, COALESCE(NULLIF(u.nama_lengkap, ''), u.name, s.id) AS name,
      CASE
        WHEN u.id IS NULL THEN 'akun tidak ditemukan'
        WHEN COALESCE(u.banned, 0) <> 0 THEN 'sudah nonaktif'
        WHEN u.role <> 'guru_ppl' AND NOT EXISTS (
          SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'guru_ppl'
        ) THEN 'bukan Guru PPL'
        WHEN u.role <> 'guru_ppl' OR EXISTS (
          SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role <> 'guru_ppl'
        ) THEN 'memiliki peran lain'
      END AS reason
    FROM selected s LEFT JOIN "user" u ON u.id = s.id
  ),
  active_mappings AS (
    SELECT m.* FROM guru_ppl_mapping m
    JOIN selected s ON s.id = m.guru_ppl_id
    WHERE m.berlaku_selesai IS NULL
  ),
  conflicts AS (
    SELECT id, berlaku_mulai AS date, 'awal penugasan' AS reason
    FROM active_mappings WHERE berlaku_mulai > ?2
    UNION ALL
    SELECT m.id, MAX(a.tanggal), 'agenda PPL'
    FROM active_mappings m
    JOIN agenda_guru a ON a.penugasan_id = m.penugasan_mengajar_id
      AND a.ppl_user_id = m.guru_ppl_id AND a.guru_id = m.guru_utama_id
      AND a.tanggal >= m.berlaku_mulai AND a.tanggal > ?2
    GROUP BY m.id
    UNION ALL
    SELECT m.id, MAX(o.tanggal), 'koreksi kehadiran'
    FROM active_mappings m JOIN guru_ppl_kehadiran_override o ON o.mapping_id = m.id
    WHERE o.tanggal >= m.berlaku_mulai AND o.tanggal > ?2
    GROUP BY m.id
  )`

export async function deactivatePplAccounts(
  db: D1Database,
  input: { ids: string[]; lastDay: string },
  actor: { id: string; roles: string[]; sessionId: string },
) {
  const { ids, lastDay } = input
  const selected = JSON.stringify(ids)
  const auditId = crypto.randomUUID()
  const timestamp = new Date().toISOString()

  // Validate inside the same transaction so concurrent changes cannot invalidate the checks.
  // The audit row exists only when every selected account and mapping is eligible.
  const [accountIssues, assignmentIssues, audit] = await db.batch([
    db.prepare(`${validation}
      SELECT id, name, reason FROM accounts WHERE reason IS NOT NULL ORDER BY name`).bind(selected, lastDay),
    db.prepare(`${validation}
      SELECT m.id, ac.name, mp.nama_mapel AS subject, k.tingkat AS grade,
        k.nomor_kelas AS classNumber, k.kelompok AS groupName, c.date, c.reason
      FROM conflicts c JOIN active_mappings m ON m.id = c.id
      JOIN accounts ac ON ac.id = m.guru_ppl_id
      LEFT JOIN penugasan_mengajar pm ON pm.id = m.penugasan_mengajar_id
      LEFT JOIN mata_pelajaran mp ON mp.id = pm.mapel_id
      LEFT JOIN kelas k ON k.id = pm.kelas_id
      ORDER BY ac.name, c.date DESC, m.id, c.reason`).bind(selected, lastDay),
    db.prepare(`${validation}
      INSERT INTO activity_logs (
        id, created_at, actor_user_id, actor_name, actor_email, actor_roles, session_id,
        module, action, severity, summary, entity_type, before_json, after_json, metadata_json
      )
      SELECT ?3, ?4, actor.id, COALESCE(actor.nama_lengkap, actor.name), actor.email, ?5, ?6,
        'pegawai', 'deactivate_ppl', 'warning', ?7, 'user',
        '{"banned":false}', json_object('banned', json('true'), 'hari_terakhir_ppl', ?2),
        json_object('jumlah_akun', (SELECT COUNT(*) FROM selected))
      FROM "user" actor WHERE actor.id = ?8
        AND NOT EXISTS (SELECT 1 FROM accounts WHERE reason IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM conflicts)`)
      .bind(selected, lastDay, auditId, timestamp, JSON.stringify(actor.roles), actor.sessionId,
        `Menonaktifkan ${ids.length} akun Guru PPL`, actor.id),
    db.prepare(`
      INSERT INTO activity_log_targets (id, log_id, target_type, target_id, target_label)
      SELECT lower(hex(randomblob(16))), ?, 'user', u.id, COALESCE(NULLIF(u.nama_lengkap, ''), u.name)
      FROM "user" u WHERE u.id IN (SELECT value FROM json_each(?))
        AND EXISTS (SELECT 1 FROM activity_logs WHERE id = ?)`).bind(auditId, selected, auditId),
    db.prepare(`
      UPDATE "user" SET banned = 1, banReason = 'Masa PPL selesai', banExpires = NULL, updatedAt = ?
      WHERE id IN (SELECT value FROM json_each(?))
        AND EXISTS (SELECT 1 FROM activity_logs WHERE id = ?)`).bind(timestamp, selected, auditId),
    db.prepare(`
      DELETE FROM session WHERE userId IN (SELECT value FROM json_each(?))
        AND EXISTS (SELECT 1 FROM activity_logs WHERE id = ?)`).bind(selected, auditId),
    db.prepare(`
      UPDATE guru_ppl_mapping SET berlaku_selesai = ?, updated_at = ?
      WHERE berlaku_selesai IS NULL AND guru_ppl_id IN (SELECT value FROM json_each(?))
        AND EXISTS (SELECT 1 FROM activity_logs WHERE id = ?)`).bind(lastDay, timestamp, selected, auditId),
  ])

  const invalidAccounts = (accountIssues.results as AccountIssue[]).map(row => `${row.name} (${row.reason})`)
  if (invalidAccounts.length) {
    return { error: 'Keluarkan akun berikut dari pilihan.', details: invalidAccounts }
  }

  const invalidAssignments = (assignmentIssues.results as AssignmentIssue[]).map(row => {
    const assignment = row.subject
      ? `${row.subject} · ${formatNamaKelas(row.grade ?? '', row.classNumber ?? '', row.groupName)}`
      : `Penugasan ${row.id}`
    return `${row.name} · ${assignment} · ${row.date} (${row.reason})`
  })
  if (invalidAssignments.length) {
    return { error: 'Hari terakhir PPL harus mencakup tanggal berikut.', details: invalidAssignments }
  }
  if (!audit.meta.changes) return { error: 'Penonaktifan gagal. Muat ulang halaman dan coba lagi.' }
  return { success: `${ids.length} akun Guru PPL berhasil dinonaktifkan.` }
}
