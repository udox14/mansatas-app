import { NextResponse } from 'next/server'
import { createCorrelationId, logSecurityEvent } from '@/lib/security-log'

const SAME_SITE_VALUES = new Set(['same-origin', 'same-site'])

function configuredOrigins(): Set<string> {
  return new Set(
    String(process.env.ALLOWED_APP_ORIGINS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  )
}

export function isAllowedMutationOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const requestOrigin = new URL(request.url).origin
  if (origin) return origin === requestOrigin || configuredOrigins().has(origin)

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && SAME_SITE_VALUES.has(fetchSite)) return true
  // Bearer-authenticated cron/provider calls may not send browser origin headers.
  // Cookie-authenticated mutations fail closed when origin metadata is absent.
  return !request.headers.has('cookie') && (!fetchSite || fetchSite === 'none')
}

export function rejectCrossSiteMutation(request: Request): NextResponse | null {
  if (isAllowedMutationOrigin(request)) return null
  const correlationId = logSecurityEvent('warning', 'cross_site_mutation_rejected', {
    path: new URL(request.url).pathname,
    origin: request.headers.get('origin'),
    fetchSite: request.headers.get('sec-fetch-site'),
  })
  return NextResponse.json({ error: 'Permintaan tidak diizinkan.', correlationId }, {
    status: 403,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'no-store, max-age=0')
  headers.set('Pragma', 'no-cache')
  return NextResponse.json(body, { ...init, headers })
}

export function internalErrorJson(event: string, error: unknown, status = 500): NextResponse {
  const correlationId = createCorrelationId()
  logSecurityEvent('error', event, {
    error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
  }, correlationId)
  return noStoreJson({ error: 'Terjadi kesalahan pada server.', correlationId }, { status })
}
