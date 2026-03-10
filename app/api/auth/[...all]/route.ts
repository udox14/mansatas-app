// Lokasi: app/api/auth/[...all]/route.ts
import { createAuth } from '@/utils/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { toNextJsHandler } from 'better-auth/next-js'

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true })
  const auth = createAuth(env.DB)
  return toNextJsHandler(auth).GET(request)
}

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true })
  const auth = createAuth(env.DB)
  return toNextJsHandler(auth).POST(request)
}