// Lokasi: app/api/media/[...path]/route.ts
// Proxy route untuk serve file dari R2 bucket tanpa bergantung pada R2 public domain
// Ini mengatasi masalah SSL certificate error pada domain r2.dev

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'
import { authorizeMediaRequest } from '@/lib/media-security'
import { isModulePhotoExpired } from '@/lib/module-photo-retention'
import { logSecurityEvent } from '@/lib/security-log'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    const rawKey = path.join('/')

    if (!rawKey) {
      return NextResponse.json({ error: 'Path required' }, { status: 400 })
    }

    const authorized = await authorizeMediaRequest(request, rawKey)
    if (!authorized) return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    const { key, policy } = authorized
    const isPrivateProfilePhoto = key.startsWith('foto_siswa/') || key.startsWith('avatars/')
    const cacheControl = policy.visibility === 'public'
      ? policy.cacheControl
      : isPrivateProfilePhoto
        ? 'private, max-age=300, must-revalidate'
        : 'private, no-store'

    const { env } = await getCloudflareContext({ async: true })
    const object = await env.R2.get(key)

    if (!object) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Cache-Control': 'private, max-age=300' },
      })
    }

    // Do not expose expired module evidence during the interval before the
    // scheduled R2 cleanup runs. The uploaded timestamp is supplied by R2.
    if (isModulePhotoExpired(key, object.uploaded)) {
      return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    }

    const contentType = object.httpMetadata?.contentType || 'image/jpeg'

    // Check if-none-match for 304 responses  
    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch && ifNoneMatch === object.httpEtag) {
      return new Response(null, {
        status: 304,
        headers: {
          'ETag': object.httpEtag,
          'Cache-Control': cacheControl,
        },
      })
    }

    // Stream body langsung dari R2 — tanpa buffering seluruh file di worker
    // memory (object.arrayBuffer() memakan CPU + memory untuk file besar).
    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'ETag': object.httpEtag,
    })
    if (object.size > 0) headers.set('Content-Length', String(object.size))

    return new Response(object.body as ReadableStream, {
      status: 200,
      headers,
    })
  } catch (error) {
    const correlationId = logSecurityEvent('error', 'r2_media_proxy_failed', { error })
    return new Response(`Internal Server Error. ID: ${correlationId}`, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
