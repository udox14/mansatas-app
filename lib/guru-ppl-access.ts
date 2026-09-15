import { todayWIB } from './time'

export type TeachingAssignmentActorKind = 'GURU' | 'PPL'

export type TeachingAssignmentAccess = {
  penugasanId: string
  guruUtamaId: string
  actorId: string
  actorKind: TeachingAssignmentActorKind
  kelasId: string
  tahunAjaranId: string
}

/**
 * Resolve access to one mapel-class assignment. Official ownership always stays
 * with penugasan_mengajar.guru_id; a PPL mapping only grants execution access.
 */
export async function resolveTeachingAssignmentAccess(
  db: D1Database,
  actorId: string,
  penugasanId: string,
  effectiveDate?: string,
): Promise<TeachingAssignmentAccess | null> {
  const accessDate = effectiveDate || todayWIB()
  const row = await db.prepare(`
    SELECT pm.id, pm.guru_id, pm.kelas_id, pm.tahun_ajaran_id,
      CASE
        WHEN pm.guru_id = ? THEN 'GURU'
        WHEN EXISTS (
          SELECT 1 FROM guru_ppl_mapping gpm
          WHERE gpm.guru_ppl_id = ?
            AND gpm.guru_utama_id = pm.guru_id
            AND gpm.penugasan_mengajar_id = pm.id
            AND gpm.berlaku_mulai <= ?
            AND (gpm.berlaku_selesai IS NULL OR gpm.berlaku_selesai >= ?)
            AND EXISTS (
              SELECT 1
              FROM "user" ppl
              LEFT JOIN user_roles ppl_role ON ppl_role.user_id = ppl.id
              WHERE ppl.id = gpm.guru_ppl_id
                AND (ppl.role = 'guru_ppl' OR ppl_role.role = 'guru_ppl')
            )
        ) THEN 'PPL'
        ELSE NULL
      END AS actor_kind
    FROM penugasan_mengajar pm
    WHERE pm.id = ?
    LIMIT 1
  `).bind(actorId, actorId, accessDate, accessDate, penugasanId).first<any>()

  if (!row?.actor_kind) return null
  return {
    penugasanId: row.id,
    guruUtamaId: row.guru_id,
    actorId,
    actorKind: row.actor_kind,
    kelasId: row.kelas_id,
    tahunAjaranId: row.tahun_ajaran_id,
  }
}

export async function isGuruPplUser(db: D1Database, userId: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT 1
    FROM "user" u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE u.id = ? AND (u.role = 'guru_ppl' OR ur.role = 'guru_ppl')
    LIMIT 1
  `).bind(userId).first()
  return !!row
}

/** Guru utama mengelola seluruh data resmi; PPL hanya data yang ia buat. */
export function canManageTeachingRecord(access: TeachingAssignmentAccess, inputBy: string | null | undefined) {
  return access.actorKind === 'GURU' || inputBy === access.actorId
}
