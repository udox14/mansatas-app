// app/auth/signout/route.ts
import { createAuth, COOKIE_NAME } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { env } = await getCloudflareContext({ async: true })
  const auth = createAuth(env.DB)

  await auth.api.signOut({ headers: await headers() })

  const res = NextResponse.redirect(new URL('/login', req.url), { status: 302 })
  res.headers.set('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  return res
}
