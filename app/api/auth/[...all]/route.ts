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

  // Account creation must go through guarded server actions, not this public API.
  if (pathname.endsWith('/sign-up/email')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // POST /api/auth/sign-out
  if (pathname.endsWith('/sign-out')) {
    const auth = await getAuth()
    await auth.api.signOut({ headers: request.headers })
    const isJsonRequest = request.headers.get('content-type')?.includes('application/json')
    const res = isJsonRequest
      ? NextResponse.json({ success: true })
      : NextResponse.redirect(new URL('/', request.url), { status: 302 })
    // Clear cookie
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    res.headers.set('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`)
    return res
  }

  // POST /api/auth/parent/sign-in
  if (pathname.endsWith('/parent/sign-in')) {
    try {
      const body = await request.json()
      const auth = await getAuth()
      const res = await auth.api.signInParent({
        body: { nisn: body.nisn, password: body.password },
        asResponse: true,
      })
      return res as Response
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 401 })
    }
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

  // GET /api/auth/parent/get-session
  if (pathname.endsWith('/parent/get-session')) {
    const auth = await getAuth()
    const session = await auth.api.getParentSession({ headers: request.headers })
    if (!session) return NextResponse.json(null, { status: 401 })
    return NextResponse.json(session)
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
