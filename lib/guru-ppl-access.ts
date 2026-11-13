import { readReplacementScopes, readTeacherPeriods } from './teacher-leave-period'
import { todayWIB } from './time'

export type TeachingAssignmentActorKind = 'GURU' | 'PPL' | 'PENGGANTI'

export type TeachingAssignmentAccess = {
  penugasanId: string
  guruUtamaId: string
  actorId: string
  actorKind: TeachingAssignmentActorKind
  kelasId: string
  tahunAjaranId: string
  periodStart?: string
  periodEnd?: string
  ownerOnLeave?: boolean
}

/**
 * Resolve access to one mapel-class assignment. Official ownership always stays
 * with penugasan_mengajar.guru_id; a PPL mapping only grants execution access.
 */
export async function resolveTeachingAssignmentAccess(
  db: D1Database,
  actorId: string,
  penugasanId: string,
  effectiveDate = todayWIB(),
): Promise<TeachingAssignmentAccess | null> {
  const row = await db.prepare(`
    SELECT pm.id, pm.guru_id, pm.kelas_id, pm.tahun_ajaran_id,
      CASE
        WHEN pm.guru_id = ? THEN 'GURU'
        WHEN EXISTS (
          SELECT 1 FROM guru_ppl_mapping gpm
          WHERE gpm.guru_ppl_id = ?
            AND gpm.guru_utama_id = pm.guru_id
            AND gpm.penugasan_mengajar_id = pm.id
            AND gpm.berlaku_selesai IS NULL
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
  `).bind(actorId, actorId, penugasanId).first<any>()

  if (!row) return null
  const [scopes, leave] = await Promise.all([
    row.actor_kind === 'GURU' ? [] : readReplacementScopes(db, actorId, effectiveDate),
    readTeacherPeriods(db, effectiveDate, effectiveDate, row.guru_id),
  ])
  const scope = scopes.find(item => item.guru_id === row.guru_id)
  if (scope && !await db.prepare('SELECT 1 FROM tahun_ajaran WHERE id = ? AND is_active = 1').bind(row.tahun_ajaran_id).first()) return null
  const actorKind = scope ? 'PENGGANTI' : row.actor_kind
  if (!actorKind || (actorKind === 'PPL' && leave.some(item => item.pengganti_id))) return null
  return {
    penugasanId: row.id,
    guruUtamaId: row.guru_id,
    actorId,
    actorKind,
    periodStart: scope?.mulai,
    periodEnd: scope?.selesai,
    ownerOnLeave: leave.length > 0,
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
