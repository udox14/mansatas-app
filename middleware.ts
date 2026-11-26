import { NextRequest, NextResponse } from 'next/server'
import { rejectCrossSiteMutation } from '@/lib/request-security'
import { DEVICE_ID_COOKIE } from '@/lib/device-identity'

const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60

function createNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function middleware(request: NextRequest) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const originError = rejectCrossSiteMutation(request)
    if (originError) return originError
  }

  const nonce = createNonce()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const enforceCsp = String(process.env.CSP_ENFORCE) === 'true'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // blob: dibutuhkan agar fetch(blobUrl) pada alur unduh/cetak (lib/pdf/download.ts) tidak
    // diblokir CSP — di WebView Android gejalanya "unable to fetch / Failed to fetch".
    "connect-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(enforceCsp ? [] : ["report-uri /api/security/csp-report"]),
  ].join('; ')

  // Next.js reads this request header to apply the nonce to framework-generated scripts.
  requestHeaders.set('Content-Security-Policy', csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  if (!request.cookies.get(DEVICE_ID_COOKIE)?.value) {
    response.cookies.set(DEVICE_ID_COOKIE, crypto.randomUUID(), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: DEVICE_COOKIE_MAX_AGE,
    })
  }
  response.headers.set(
    enforceCsp ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
    csp
  )
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-|apple-touch-icon|manifest.json|sw.js|\\.well-known/|data/).*)'],
}
