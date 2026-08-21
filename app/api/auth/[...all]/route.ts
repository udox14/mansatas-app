// app/api/auth/[...all]/route.ts
// Custom auth API handler — pengganti better-auth handler
import { createAuth, COOKIE_NAME } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'
import { blockIpForTenMinutes, checkIpBlock, checkLoginAllowed, clearLoginFailures, getRequestIp, recordLoginFailure, type LoginActorType } from '@/lib/auth-rate-limit'
import { internalErrorJson, noStoreJson, rejectCrossSiteMutation } from '@/lib/request-security'

async function getAuth() {
  const { env } = await getCloudflareContext({ async: true })
  return createAuth(env.DB)
}

async function getAuthDb() {
  const { env } = await getCloudflareContext({ async: true })
  return env.DB
}

async function limitedSignIn(
  request: Request,
  actorType: LoginActorType,
  account: string,
  execute: () => Promise<Response>
): Promise<Response> {
  const db = await getAuthDb()
  const ip = getRequestIp(request)
  const ipBlock = await checkIpBlock(db, ip)
  if (ipBlock.blocked) {
    return noStoreJson(
      { error: 'Terlalu banyak percobaan login. Silakan coba kembali nanti.', retryAfter: ipBlock.retryAfter },
      { status: 429, headers: { 'Retry-After': String(ipBlock.retryAfter) } }
    )
  }
  const { env } = await getCloudflareContext({ async: true })
  if (env.LOGIN_RATE_LIMITER && !(await env.LOGIN_RATE_LIMITER.limit({ key: ip })).success) {
    await blockIpForTenMinutes(db, ip)
    return noStoreJson(
      { error: 'Terlalu banyak percobaan login. Silakan coba kembali nanti.', retryAfter: 600 },
      { status: 429, headers: { 'Retry-After': '600' } }
    )
  }
  const limit = await checkLoginAllowed(db, actorType, account, ip)
  if (!limit.allowed) {
    return noStoreJson(
      { error: 'Terlalu banyak percobaan login. Silakan coba kembali nanti.', retryAfter: limit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  const response = await execute()
  if (response.ok) await clearLoginFailures(db, actorType, account, ip)
  else if (response.status === 401) await recordLoginFailure(db, actorType, account, ip)
  if (!response.ok && !(actorType === 'parent' && response.status === 403)) {
    return noStoreJson({ error: 'Identitas atau password tidak valid.' }, { status: 401 })
  }
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store, max-age=0')
  headers.set('Pragma', 'no-cache')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export async function POST(request: Request) {
  const originError = rejectCrossSiteMutation(request)
  if (originError) return originError

  const url = new URL(request.url)
  const pathname = url.pathname

  // POST /api/auth/sign-in/email
  if (pathname.endsWith('/sign-in/email')) {
    try {
      const body = await request.json()
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      if (!email || email.length > 254 || !password || password.length > 256) {
        return noStoreJson({ error: 'Email atau password tidak valid.' }, { status: 400 })
      }
      return limitedSignIn(request, 'staff', email, async () => {
        const auth = await getAuth()
        return await auth.api.signInEmail({
          body: { email, password },
          headers: request.headers,
          asResponse: true,
        }) as Response
      })
    } catch (error) {
      return internalErrorJson('staff_sign_in_failed', error)
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
      ? noStoreJson({ success: true })
      : NextResponse.redirect(new URL('/', request.url), { status: 302 })
    // Clear cookie
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    res.headers.set('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`)
    res.headers.set('Cache-Control', 'no-store, max-age=0')
    return res
  }

  // POST /api/auth/parent/sign-in
  if (pathname.endsWith('/parent/sign-in')) {
    try {
      const body = await request.json()
      const nisn = typeof body.nisn === 'string' ? body.nisn.replace(/\D/g, '') : ''
      const password = typeof body.password === 'string' ? body.password : ''
      if (!/^\d{6,20}$/.test(nisn) || password.length > 256) {
        return noStoreJson({ error: 'Identitas atau password tidak valid.' }, { status: 400 })
      }
      return limitedSignIn(request, 'parent', nisn, async () => {
        const auth = await getAuth()
        return await auth.api.signInParent({
          body: { nisn, password },
          asResponse: true,
        }) as Response
      })
    } catch (error) {
      return internalErrorJson('parent_sign_in_failed', error)
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
    if (!session) return noStoreJson(null, { status: 401 })
    return noStoreJson({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        nama_lengkap: session.user.nama_lengkap,
        avatar_url: session.user.avatar_url,
      },
      session: { id: session.session.id, userId: session.session.userId, expiresAt: session.session.expiresAt },
    })
  }

  // GET /api/auth/parent/get-session
  if (pathname.endsWith('/parent/get-session')) {
    const auth = await getAuth()
    const session = await auth.api.getParentSession({ headers: request.headers })
    if (!session) return noStoreJson(null, { status: 401 })
    return noStoreJson({
      user: {
        type: 'parent',
        siswa_id: session.user.siswa_id,
        nama_lengkap: session.user.nama_lengkap,
      },
      session: { id: session.session.id, siswaId: session.session.siswaId, expiresAt: session.session.expiresAt },
    })
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
