import { describe, expect, it } from 'vitest'
import { checkFeatureCrudAccess } from './features'

type Options = {
  roles?: string[]
  features?: string[]
  overrides?: Array<{ feature_id: string; action: string }>
  permission?: { configured_count: number; readable: number | null; allowed: number | null } | null
  permissionError?: boolean
}

function featureDb(options: Options = {}) {
  const roles = options.roles ?? ['guru']
  const features = options.features ?? ['bk']
  const overrides = options.overrides ?? []
  return {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async all() {
              if (sql.includes('FROM user_roles')) return { results: roles.map(role => ({ role })) }
              if (sql.includes('FROM role_features')) return { results: features.map(feature_id => ({ feature_id })) }
              if (sql.includes('FROM user_feature_overrides')) return { results: overrides }
              return { results: [] }
            },
            async first() {
              if (sql.includes('FROM role_feature_permissions')) {
                if (options.permissionError) throw new Error('D1 unavailable')
                return options.permission ?? { configured_count: 0, readable: null, allowed: null }
              }
              if (sql.includes('FROM "user"')) return { role: roles[0] }
              return null
            },
          }
        },
      }
    },
  } as unknown as D1Database
}

describe('fail-closed feature CRUD permissions', () => {
  it('denies read and write when the permission row is missing', async () => {
    const db = featureDb()
    await expect(checkFeatureCrudAccess(db, 'user-1', 'bk', 'read')).resolves.toBe(false)
    await expect(checkFeatureCrudAccess(db, 'user-1', 'bk', 'update')).resolves.toBe(false)
  })

  it('keeps a user-specific grant read-only without a role permission row', async () => {
    const db = featureDb({ overrides: [{ feature_id: 'bk', action: 'grant' }] })
    await expect(checkFeatureCrudAccess(db, 'user-1', 'bk', 'read')).resolves.toBe(true)
    await expect(checkFeatureCrudAccess(db, 'user-1', 'bk', 'update')).resolves.toBe(false)
  })

  it('allows explicitly configured CRUD and denies provider errors', async () => {
    const configured = featureDb({ permission: { configured_count: 1, readable: 1, allowed: 1 } })
    await expect(checkFeatureCrudAccess(configured, 'user-1', 'bk', 'update')).resolves.toBe(true)
    await expect(checkFeatureCrudAccess(featureDb({ permissionError: true }), 'user-1', 'bk', 'read')).resolves.toBe(false)
  })
})
