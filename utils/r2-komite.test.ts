import { beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadKomiteQris } from './r2'
const state = vi.hoisted(() => ({ put: vi.fn() }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: { R2: { put: state.put } } }) }))
vi.mock('@/utils/auth/server', () => ({ isCurrentUserPlayReviewer: async () => false }))
beforeEach(() => vi.clearAllMocks())
describe('Komite QRIS storage', () => {
  it('stores unique images per grade with the correct content type and extension', async () => {
    const file = new File(['image'], 'qris.png', { type: 'image/png' })
    const urls = []
    for (const grade of [10, 11, 12, 10] as const) {
      const result = await uploadKomiteQris(file, grade)
      expect(result.error).toBeNull()
      expect(result.url).toMatch(new RegExp(`/keuangan_settings/komite-qris-${grade}-.+\\.png$`))
      urls.push(result.url)
    }
    expect(new Set(urls).size).toBe(4)
    expect(state.put).toHaveBeenCalledWith(expect.any(String), expect.any(ArrayBuffer), expect.objectContaining({ httpMetadata: expect.objectContaining({ contentType: 'image/png' }) }))
  })
  it('rejects invalid image types before uploading', async () => {
    expect((await uploadKomiteQris(new File(['bad'], 'qris.svg', { type: 'image/svg+xml' }), 10)).error).toBeTruthy()
    expect(state.put).not.toHaveBeenCalled()
  })
})
