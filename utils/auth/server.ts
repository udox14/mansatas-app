// Lokasi: utils/auth/server.ts
// Helper untuk mengambil session & user di Server Components / Server Actions

import { headers } from 'next/headers'
import { createAuth } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'

// Ambil instance auth dengan D1 binding dari Cloudflare context
async function getAuth() {
  const { env } = await getCloudflareContext({ async: true })
  return createAuth(env.DB)
}

// Ambil session aktif (dipakai di layout, page, actions)
export async function getSession() {
  const auth = await getAuth()
  const headersList = await headers()
  const session = await auth.api.getSession({
    headers: headersList,
  })
  return session
}

// Ambil user aktif - shortcut untuk getSession().user
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