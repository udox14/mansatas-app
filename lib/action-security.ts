import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getAppSession, type AppSession } from '@/utils/auth/server'
import { checkFeatureCrudAccess, getUserRoles, type CrudAction } from '@/lib/features'
import { logSecurityEvent } from '@/lib/security-log'

export type AuthenticatedActor =
  | { kind: 'staff'; id: string; roles: string[]; sessionId: string }
  | { kind: 'parent'; id: string; siswaId: string; roles: ['orang_tua']; sessionId: string }

export const ADMINISTRATIVE_ROLES = ['super_admin', 'admin_tu', 'kepsek', 'wakamad'] as const

export function isAdministrativeActor(actor: AuthenticatedActor): boolean {
  return actor.kind === 'staff' && ADMINISTRATIVE_ROLES.some(role => actor.roles.includes(role))
}

export class ActionAccessError extends Error {
  readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN'

  constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN') {
    super(code === 'UNAUTHENTICATED' ? 'Anda belum login.' : 'Anda tidak memiliki izin untuk tindakan ini.')
    this.name = 'ActionAccessError'
    this.code = code
  }
}

function toActor(session: AppSession, roles: string[] = []): AuthenticatedActor {
  if (session.kind === 'parent') {
    return {
      kind: 'parent',
      id: session.user.siswa_id,
      siswaId: session.user.siswa_id,
      roles: ['orang_tua'],
      sessionId: session.session.id,
    }
  }
  return { kind: 'staff', id: session.user.id, roles, sessionId: session.session.id }
}

export async function getAuthenticatedActor(): Promise<AuthenticatedActor | null> {
  const session = await getAppSession()
  if (!session) return null
  if (session.kind === 'parent') return toActor(session)

  const { env } = await getCloudflareContext({ async: true })
  const roles = await getUserRoles(env.DB, session.user.id)
  return toActor(session, roles)
}

export async function requireActionAccess(
  featureId: string | readonly string[],
  action: CrudAction,
  options: { allowedRoles?: readonly string[]; allowParent?: boolean } = {}
): Promise<AuthenticatedActor> {
  const featureIds = typeof featureId === 'string' ? [featureId] : [...featureId]
  const auditFeatureId = featureIds.join('|')
  const session = await getAppSession()
  if (!session) {
    logSecurityEvent('warning', 'server_action_unauthenticated', { featureId: auditFeatureId, action })
    throw new ActionAccessError('UNAUTHENTICATED')
  }

  if (session.kind === 'parent') {
    if (options.allowParent && action === 'read') return toActor(session)
    logSecurityEvent('warning', 'server_action_parent_forbidden', { featureId: auditFeatureId, action, siswaId: session.user.siswa_id })
    throw new ActionAccessError('FORBIDDEN')
  }

  const { env } = await getCloudflareContext({ async: true })
  const roles = await getUserRoles(env.DB, session.user.id)
  const actor = toActor(session, roles)
  const allowed = (await Promise.all(
    featureIds.map(id => checkFeatureCrudAccess(env.DB, session.user.id, id, action))
  )).some(Boolean)
  const hasRequiredRole = !options.allowedRoles?.length || roles.some(role => options.allowedRoles!.includes(role))

  if (!allowed || !hasRequiredRole) {
    logSecurityEvent('warning', 'server_action_forbidden', {
      featureId: auditFeatureId,
      action,
      actorId: session.user.id,
      roles,
      requiredRoles: options.allowedRoles,
    })
    throw new ActionAccessError('FORBIDDEN')
  }

  return actor
}

export async function assertStudentScope(
  actor: AuthenticatedActor,
  siswaId: string,
  featureId: string
): Promise<void> {
  if (actor.kind === 'parent') {
    if (actor.siswaId !== siswaId) throw new ActionAccessError('FORBIDDEN')
    return
  }

  if (isAdministrativeActor(actor)) return

  const { env } = await getCloudflareContext({ async: true })
  try {
    const row = await env.DB.prepare(`
      SELECT 1 AS allowed
      FROM siswa s
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE s.id = ? AND (
        k.wali_kelas_id = ?
        OR EXISTS (
          SELECT 1 FROM kelas_binaan_bk kb
          WHERE kb.kelas_id = s.kelas_id AND kb.guru_bk_id = ?
        )
        OR EXISTS (
          SELECT 1 FROM penugasan_mengajar pm
          WHERE pm.kelas_id = s.kelas_id AND pm.guru_id = ?
        )
      )
      LIMIT 1
    `).bind(siswaId, actor.id, actor.id, actor.id).first<{ allowed: number }>()
    if (row?.allowed === 1) return
  } catch (error) {
    logSecurityEvent('error', 'student_scope_check_failed', { featureId, actorId: actor.id, siswaId, error })
  }

  logSecurityEvent('warning', 'student_scope_forbidden', { featureId, actorId: actor.id, siswaId })
  throw new ActionAccessError('FORBIDDEN')
}

export async function assertClassScope(
  actor: AuthenticatedActor,
  kelasId: string,
  featureId: string
): Promise<void> {
  if (actor.kind === 'parent') throw new ActionAccessError('FORBIDDEN')
  if (isAdministrativeActor(actor)) return

  const { env } = await getCloudflareContext({ async: true })
  try {
    const row = await env.DB.prepare(`
      SELECT 1 AS allowed
      FROM kelas k
      WHERE k.id = ? AND (
        k.wali_kelas_id = ?
        OR EXISTS (
          SELECT 1 FROM kelas_binaan_bk kb
          WHERE kb.kelas_id = k.id AND kb.guru_bk_id = ?
        )
        OR EXISTS (
          SELECT 1 FROM penugasan_mengajar pm
          WHERE pm.kelas_id = k.id AND pm.guru_id = ?
        )
      )
      LIMIT 1
    `).bind(kelasId, actor.id, actor.id, actor.id).first<{ allowed: number }>()
    if (row?.allowed === 1) return
  } catch (error) {
    logSecurityEvent('error', 'class_scope_check_failed', { featureId, actorId: actor.id, kelasId, error })
  }

  logSecurityEvent('warning', 'class_scope_forbidden', { featureId, actorId: actor.id, kelasId })
  throw new ActionAccessError('FORBIDDEN')
}
