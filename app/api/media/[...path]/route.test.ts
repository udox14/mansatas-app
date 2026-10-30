import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ uploaded: new Date() }))

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({ env: { R2: { get: async () => ({
    uploaded: state.uploaded,
    httpMetadata: { contentType: 'image/jpeg' },
    httpEtag: 'etag',
    size: 1,
    body: new ReadableStream(),
  }) } } }),
}))
vi.mock('@/lib/media-security', () => ({
  authorizeMediaRequest: async (_request: Request, key: string) => ({ key, policy: { visibility: 'private' } }),
}))
vi.mock('@/lib/security-log', () => ({ logSecurityEvent: vi.fn(() => 'test') }))

import { GET } from './route'
import { MODULE_PHOTO_RETENTION_MS } from '@/lib/module-photo-retention'

describe('media route module photo retention', () => {
  beforeEach(() => { state.uploaded = new Date() })

  async function getPhoto() {
    return GET(new Request('https://app.test/api/media/agenda/photo.jpg'), {
      params: Promise.resolve({ path: ['agenda', 'photo.jpg'] }),
    })
  }

  it('returns 404 for a module photo older than 30 days', async () => {
    state.uploaded = new Date(Date.now() - MODULE_PHOTO_RETENTION_MS - 1)
    expect((await getPhoto()).status).toBe(404)
  })

  it('serves a module photo within the 30-day window', async () => {
    state.uploaded = new Date(Date.now() - MODULE_PHOTO_RETENTION_MS + 5_000)
    expect((await getPhoto()).status).toBe(200)
  })
})
