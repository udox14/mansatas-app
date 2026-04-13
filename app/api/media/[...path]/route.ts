// Lokasi: app/api/media/[...path]/route.ts
// Proxy route untuk serve file dari R2 bucket tanpa bergantung pada R2 public domain
// Ini mengatasi masalah SSL certificate error pada domain r2.dev

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    const key = path.join('/')

    if (!key) {
      return NextResponse.json({ error: 'Path required' }, { status: 400 })
    }

    const { env } = await getCloudflareContext({ async: true })
    const object = await env.R2.get(key)

    if (!object) {
      return new Response('Not Found', { status: 404 })
    }

    const contentType = object.httpMetadata?.contentType || 'image/jpeg'

    // Check if-none-match for 304 responses  
    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch && ifNoneMatch === object.etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'ETag': object.etag,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    // Stream body langsung dari R2
    const body = await object.arrayBuffer()

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': object.etag,
      },
    })
  } catch (e: any) {
    console.error('R2 media proxy error:', e?.message || e)
    return new Response('Internal Server Error', { status: 500 })
  }
}
