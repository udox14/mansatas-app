import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/activity-log', () => ({ logActivity: vi.fn(async () => undefined) }))

import { createAuth, hashPassword } from './index'

describe('public authentication response contract', () => {
  let passwordHash = ''

  beforeAll(async () => {
    passwordHash = await hashPassword('valid-password')
  })

  function authDb() {
    return {
      prepare(sql: string) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes('SELECT * FROM "user" WHERE email')) {
                  return {
                    id: 'user-1', name: 'Staff', email: 'staff@example.test', role: 'guru',
                    nama_lengkap: 'Staff Aman', avatar_url: null, image: null,
                    emailVerified: 1, createdAt: '2026-01-01', updatedAt: '2026-01-01', banned: 0,
                  }
                }
                if (sql.includes('SELECT password FROM account')) return { password: passwordHash }
                return null
              },
              async run() {
                return { success: true, meta: {} }
              },
            }
          },
        }
      },
    } as unknown as D1Database
  }

  it('keeps the bearer token in HttpOnly cookie and out of the JSON DTO', async () => {
    const auth = createAuth(authDb())
    const response = await auth.api.signInEmail({
      body: { email: 'staff@example.test', password: 'valid-password' },
      asResponse: true,
    }) as Response

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('cache-control')).toContain('no-store')
    const body = await response.json() as Record<string, unknown>
    expect(JSON.stringify(body)).not.toContain('token')
    expect(body).toMatchObject({ session: { id: expect.any(String), userId: 'user-1', expiresAt: expect.any(String) } })
  })
})
