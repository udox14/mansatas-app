// utils/auth/server.ts
// Helper untuk mengambil session & user di Server Components / Server Actions
// Menggunakan React.cache() agar pemanggilan berulang dalam 1 HTTP request
// (Layout -> Page -> Action -> Guard) hanya mengeksekusi query D1 satu kali.

import { cache } from 'react'
import { headers } from 'next/headers'
import { createAuth, extractToken } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { AuthSession, AuthUser, ParentAuthSession, ParentAuthUser } from '@/utils/auth'
import { PLAY_REVIEWER_ROLE } from '@/lib/play-reviewer'
import { getUserRoles } from '@/lib/features'

// Ambil instance auth dengan D1 binding
async function getAuth() {
  const { env } = await getCloudflareContext({ async: true })
  return createAuth(env.DB)
}

// Ambil session aktif (dipakai di layout, page, actions)
export const getSession = cache(async () => {
  const headersList = await headers()
  if (!extractToken(headersList)) return null
  const auth = await getAuth()
  return auth.api.getSession({ headers: headersList })
})

export const getParentSession = cache(async () => {
  const headersList = await headers()
  if (!extractToken(headersList)) return null
  const auth = await getAuth()
  return auth.api.getParentSession({ headers: headersList })
})

export type AppSession =
  | { kind: 'staff'; user: AuthUser; session: AuthSession }
  | { kind: 'parent'; user: ParentAuthUser; session: ParentAuthSession }

export const getAppSession = cache(async (): Promise<AppSession | null> => {
  const headersList = await headers()
  if (!extractToken(headersList)) return null

  const staff = await getSession()
  if (staff?.user) return { kind: 'staff', user: staff.user, session: staff.session }

  const parent = await getParentSession()
  if (parent?.user) return { kind: 'parent', user: parent.user, session: parent.session }
  return null
})

// Ambil user aktif
export async function getCurrentUser() {
  const session = await getSession()
  return session?.user ?? null
}

export const isCurrentUserPlayReviewer = cache(async (): Promise<boolean> => {
  const session = await getSession()
  if (!session?.user) return false
  if (session.user.role === PLAY_REVIEWER_ROLE) return true
  const { env } = await getCloudflareContext({ async: true })
  const roles = await getUserRoles(env.DB, session.user.id)
  return roles.includes(PLAY_REVIEWER_ROLE)
})

// Ambil user + wajib login (redirect jika tidak ada)
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    const { redirect } = await import('next/navigation')
    redirect('/login')
  }
  return user
}
