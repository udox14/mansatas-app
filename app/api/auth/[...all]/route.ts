// app/api/auth/[...all]/route.ts
// Custom auth API handler — pengganti better-auth handler
import { createAuth, COOKIE_NAME } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'

async function getAuth() {
  const { env } = await getCloudflareContext({ async: true })
  return createAuth(env.DB)
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const pathname = url.pathname

  // POST /api/auth/sign-in/email
  if (pathname.endsWith('/sign-in/email')) {
    try {
      const body = await request.json()
      const auth = await getAuth()
      const res = await auth.api.signInEmail({
        body: { email: body.email, password: body.password },
        headers: request.headers,
        asResponse: true,
      })
      return res as Response
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 401 })
    }
  }

  // POST /api/auth/sign-up/email (used internally by guru/actions)
  if (pathname.endsWith('/sign-up/email')) {
    try {
      const body = await request.json()
      const auth = await getAuth()
      const result = await auth.api.signUpEmail({
        body: { name: body.name, email: body.email, password: body.password },
      })
      return NextResponse.json(result)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
  }

  // POST /api/auth/sign-out
  if (pathname.endsWith('/sign-out')) {
    const auth = await getAuth()
    await auth.api.signOut({ headers: request.headers })
    const res = NextResponse.json({ success: true })
    // Clear cookie
    res.headers.set('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
    return res
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const pathname = url.pathname

  // GET /api/auth/get-session
  if (pathname.endsWith('/get-session')) {
    const auth = await getAuth()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return NextResponse.json(null, { status: 401 })
    return NextResponse.json(session)
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
