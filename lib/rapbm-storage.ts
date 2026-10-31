import { getCloudflareContext } from '@opennextjs/cloudflare'
import { isCurrentUserPlayReviewer } from '@/utils/auth/server'
import { PLAY_REVIEWER_WRITE_ERROR } from '@/lib/play-reviewer'

export async function putRapbmSource(key: string, bytes: Uint8Array) {
  if (await isCurrentUserPlayReviewer()) throw new Error(PLAY_REVIEWER_WRITE_ERROR)
  const { env } = await getCloudflareContext({ async:true })
  await env.R2.put(key,bytes,{ httpMetadata:{contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',cacheControl:'private, no-store'} })
}

export async function removeUncommittedRapbmSource(key: string) {
  if (await isCurrentUserPlayReviewer()) throw new Error(PLAY_REVIEWER_WRITE_ERROR)
  if (!key.startsWith('private/rapbm/')) throw new Error('Kunci RAPBM tidak valid.')
  const { env } = await getCloudflareContext({ async:true })
  await env.R2.delete(key)
}

export async function readRapbmSource(key: string) {
  if (!key.startsWith('private/rapbm/')) return null
  const { env } = await getCloudflareContext({ async:true })
  return env.R2.get(key)
}
