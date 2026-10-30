import { describe, expect, it, vi } from 'vitest'
import { cleanupExpiredModulePhotos, isModulePhotoExpired, MODULE_PHOTO_RETENTION_MS } from './module-photo-retention'

const now = new Date('2026-10-30T00:00:00.000Z')
const object = (key: string, ageMs: number): R2Object => ({
  key,
  uploaded: new Date(now.getTime() - ageMs),
  size: 1,
  version: 'v1',
  etag: 'etag',
  httpEtag: 'etag',
  checksums: {},
})

describe('module photo retention', () => {
  it('expires only retained module photos older than 30 days', () => {
    expect(isModulePhotoExpired('agenda/old.jpg', new Date(now.getTime() - MODULE_PHOTO_RETENTION_MS - 1), now)).toBe(true)
    expect(isModulePhotoExpired('agenda/exactly-30-days.jpg', new Date(now.getTime() - MODULE_PHOTO_RETENTION_MS), now)).toBe(false)
    expect(isModulePhotoExpired('agenda_piket/old.jpg', new Date(0), now)).toBe(false)
    expect(isModulePhotoExpired('avatars/old.jpg', new Date(0), now)).toBe(false)
  })

  it('paginates the two prefixes and deletes only expired objects', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ objects: [object('agenda/old.jpg', MODULE_PHOTO_RETENTION_MS + 1)], truncated: true, cursor: 'next', delimitedPrefixes: [] })
      .mockResolvedValueOnce({ objects: [object('agenda/new.jpg', MODULE_PHOTO_RETENTION_MS)], truncated: false, delimitedPrefixes: [] })
      .mockResolvedValueOnce({ objects: [object('pramubakti/user/old.jpg', MODULE_PHOTO_RETENTION_MS + 1)], truncated: false, delimitedPrefixes: [] })
    const del = vi.fn().mockResolvedValue(undefined)

    await expect(cleanupExpiredModulePhotos({ list, delete: del }, now)).resolves.toMatchObject({ scanned: 3, deleted: 2, failed: 0, errors: [] })
    expect(list.mock.calls.map(([options]) => options)).toEqual([
      { prefix: 'agenda/', limit: 1000 },
      { prefix: 'agenda/', limit: 1000, cursor: 'next' },
      { prefix: 'pramubakti/', limit: 1000 },
    ])
    expect(del).toHaveBeenCalledTimes(2)
    expect(del).toHaveBeenNthCalledWith(1, ['agenda/old.jpg'])
    expect(del).toHaveBeenNthCalledWith(2, ['pramubakti/user/old.jpg'])
  })

  it('records deletion failures so cron can retry on a later run', async () => {
    const list = vi.fn(({ prefix }: { prefix: string }) => Promise.resolve({
      objects: prefix === 'pramubakti/' ? [object('pramubakti/user/old.jpg', MODULE_PHOTO_RETENTION_MS + 1)] : [],
      truncated: false,
      delimitedPrefixes: [],
    }))
    const del = vi.fn().mockRejectedValue(new Error('temporary R2 error'))

    await expect(cleanupExpiredModulePhotos({ list, delete: del }, now)).resolves.toMatchObject({
      scanned: 1,
      deleted: 0,
      failed: 1,
      errors: ['pramubakti/: delete failed for 1 object(s) (temporary R2 error)'],
    })
  })
})
