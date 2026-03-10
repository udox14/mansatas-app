// Lokasi: utils/auth/index.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

const CUSTOM_ROLES = ['kepsek','admin_tu','wakamad','guru','guru_bk','guru_piket','satpam','pramubakti','wali_murid','super_admin'] as const

export function createAuth(db: any) {
  return betterAuth({
    database: drizzleAdapter(db as any, { provider: 'sqlite' }),
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.BETTER_AUTH_URL!,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    session: {
      cookieCache: { enabled: true, maxAge: 60 * 60 * 24 * 7 },
    },
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'wali_murid', input: true },
        nama_lengkap: { type: 'string', required: false, input: true },
        avatar_url: { type: 'string', required: false, input: false },
      },
    },
    plugins: [
      admin({
        roles: Object.fromEntries(
          CUSTOM_ROLES.map(r => [r, { authorize: async () => ({ success: true }), statements: [] }])
        ) as any,
        adminRoles: ['kepsek', 'admin_tu', 'wakamad'] as any,
      }),
      nextCookies(),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>