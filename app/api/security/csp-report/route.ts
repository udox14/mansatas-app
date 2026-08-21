import { logSecurityEvent } from '@/lib/security-log'

function safeUri(value: unknown) {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`.slice(0, 500)
  } catch {
    return value.split(/[?#]/, 1)[0].slice(0, 500)
  }
}

export async function POST(request: Request) {
  const length = Number(request.headers.get('content-length') || 0)
  if (length > 32 * 1024) return new Response(null, { status: 413 })

  try {
    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > 32 * 1024) return new Response(null, { status: 413 })
    const parsed = JSON.parse(text) as Record<string, unknown>
    const source = (parsed['csp-report'] || parsed.body || parsed) as Record<string, unknown>
    logSecurityEvent('warning', 'csp_violation', {
      directive: source['effective-directive'] || source.effectiveDirective,
      disposition: source.disposition,
      documentUri: safeUri(source['document-uri'] || source.documentURL),
      blockedUri: safeUri(source['blocked-uri'] || source.blockedURL),
    })
  } catch {
    return new Response(null, { status: 400 })
  }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
