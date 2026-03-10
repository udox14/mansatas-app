// @ts-nocheck
// Lokasi: utils/auth/index.ts
import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'

export function createAuth(db: any) {
  return betterAuth({
    // Untuk D1: langsung pass db object tanpa wrapper
    database: db,
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
      admin(),
      nextCookies(),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>