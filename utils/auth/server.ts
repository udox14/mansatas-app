// utils/auth/server.ts
// Helper untuk mengambil session & user di Server Components / Server Actions

import { headers } from 'next/headers'
import { createAuth } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { AuthSession, AuthUser, ParentAuthSession, ParentAuthUser } from '@/utils/auth'

// Ambil instance auth dengan D1 binding
async function getAuth() {
  const { env } = await getCloudflareContext({ async: true })
  return createAuth(env.DB)
}

// Ambil session aktif (dipakai di layout, page, actions)
export async function getSession() {
  const auth = await getAuth()
  const headersList = await headers()
  const session = await auth.api.getSession({ headers: headersList })
  return session
}

export async function getParentSession() {
  const auth = await getAuth()
  const headersList = await headers()
  const session = await auth.api.getParentSession({ headers: headersList })
  return session
}

export type AppSession =
  | { kind: 'staff'; user: AuthUser; session: AuthSession }
  | { kind: 'parent'; user: ParentAuthUser; session: ParentAuthSession }

export async function getAppSession(): Promise<AppSession | null> {
  const [staff, parent] = await Promise.all([getSession(), getParentSession()])
  if (staff?.user) return { kind: 'staff', user: staff.user, session: staff.session }
  if (parent?.user) return { kind: 'parent', user: parent.user, session: parent.session }
  return null
}

// Ambil user aktif
export async function getCurrentUser() {
  const session = await getSession()
  return session?.user ?? null
}

// Ambil user + wajib login (redirect jika tidak ada)
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    const { redirect } = await import('next/navigation')
    redirect('/login')
  }
  return user
}
