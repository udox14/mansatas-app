import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { checkFeatureCrudAccess, getUserRoles, type CrudAction } from '@/lib/features'
import { RAPBM_FEATURE, RAPBM_MANAGE_ROLES, RAPBM_READ_ROLES } from './rapbm'
import { ensureRapbmSchema } from './rapbm-schema'

export class RapbmAccessError extends Error {
  constructor(public status: number) { super(status === 401 ? 'Silakan masuk terlebih dahulu.' : 'Anda tidak berhak mengakses RAPBM ini.') }
}

export async function requireRapbmAccess(action: CrudAction = 'read') {
  const session = await getSession()
  if (!session?.user) throw new RapbmAccessError(401)
  const db = await getDB()
  const roles = await getUserRoles(db,session.user.id)
  if (!roles.some(role => RAPBM_READ_ROLES.includes(role))) throw new RapbmAccessError(403)
  await ensureRapbmSchema(db)
  const canManage = roles.some(role => RAPBM_MANAGE_ROLES.includes(role)) &&
    await checkFeatureCrudAccess(db,session.user.id,RAPBM_FEATURE,'create') &&
    await checkFeatureCrudAccess(db,session.user.id,RAPBM_FEATURE,'update')
  if (!(await checkFeatureCrudAccess(db,session.user.id,RAPBM_FEATURE,'read')) || (action !== 'read' && (!canManage || action === 'delete'))) throw new RapbmAccessError(403)
  return { db,user:session.user,roles,canManage }
}
