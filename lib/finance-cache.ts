import { clearMemCachePrefix, deleteMemCache, getMemCache, setMemCache } from '@/utils/mem-cache'

const FINANCE_CACHE_PREFIX = 'finance:'
export const FINANCE_CACHE_TTL_MS = 20_000

export async function getOrSetFinanceCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = FINANCE_CACHE_TTL_MS,
): Promise<T> {
  const cacheKey = `${FINANCE_CACHE_PREFIX}${key}`
  const cached = getMemCache<T | Promise<T>>(cacheKey)
  if (cached !== undefined) return cached

  const pending = loader()
    .then(value => {
      setMemCache(cacheKey, value, ttlMs)
      return value
    })
    .catch(error => {
      deleteMemCache(cacheKey)
      throw error
    })

  // Deduplicate request yang datang bersamaan pada isolate Worker yang sama.
  setMemCache(cacheKey, pending, ttlMs)
  return pending
}

export function invalidateFinanceCache() {
  clearMemCachePrefix(FINANCE_CACHE_PREFIX)
}
