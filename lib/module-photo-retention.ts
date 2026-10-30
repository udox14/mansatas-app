export const MODULE_PHOTO_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
export const MODULE_PHOTO_RETENTION_PREFIXES = ['agenda/', 'pramubakti/'] as const

export function isRetainedModulePhotoKey(key: string) {
  return MODULE_PHOTO_RETENTION_PREFIXES.some(prefix => key.startsWith(prefix))
}

export function isModulePhotoExpired(key: string, uploaded: Date, now = new Date()) {
  return isRetainedModulePhotoKey(key)
    && Number.isFinite(uploaded.getTime())
    && uploaded.getTime() < now.getTime() - MODULE_PHOTO_RETENTION_MS
}

export type ModulePhotoCleanupResult = {
  scanned: number
  deleted: number
  failed: number
  errors: string[]
}

/** Deletes only expired agenda and Pramubakti objects. Callers can safely retry. */
export async function cleanupExpiredModulePhotos(
  bucket: Pick<R2Bucket, 'list' | 'delete'>,
  now = new Date(),
): Promise<ModulePhotoCleanupResult> {
  const result: ModulePhotoCleanupResult = { scanned: 0, deleted: 0, failed: 0, errors: [] }

  for (const prefix of MODULE_PHOTO_RETENTION_PREFIXES) {
    let cursor: string | undefined
    do {
      let page: R2Objects
      try {
        page = await bucket.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) })
      } catch (error) {
        result.failed++
        result.errors.push(`${prefix}: list failed (${error instanceof Error ? error.message : String(error)})`)
        break
      }

      result.scanned += page.objects.length
      const expiredKeys = page.objects
        .filter(object => isModulePhotoExpired(object.key, object.uploaded, now))
        .map(object => object.key)

      if (expiredKeys.length) {
        try {
          await bucket.delete(expiredKeys)
          result.deleted += expiredKeys.length
        } catch (error) {
          result.failed += expiredKeys.length
          result.errors.push(`${prefix}: delete failed for ${expiredKeys.length} object(s) (${error instanceof Error ? error.message : String(error)})`)
        }
      }

      cursor = page.truncated ? page.cursor : undefined
      if (page.truncated && !cursor) {
        result.failed++
        result.errors.push(`${prefix}: list page was truncated without a cursor`)
        break
      }
    } while (cursor)
  }

  return result
}
