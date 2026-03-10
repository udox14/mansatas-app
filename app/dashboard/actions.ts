// Lokasi: app/dashboard/actions.ts
'use server'

import { createAuth } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export async function logout() {
  const { env } = await getCloudflareContext({ async: true })
  const auth = createAuth(env.DB)
  await auth.api.signOut({ headers: await headers() })
  redirect('/login')
}