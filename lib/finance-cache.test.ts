import { describe, expect, it, vi } from 'vitest'
import { getOrSetFinanceCache, invalidateFinanceCache } from './finance-cache'

describe('finance cache', () => {
  it('mendeduplikasi pemuatan serentak dan dapat diinvalidasi', async () => {
    invalidateFinanceCache()
    const loader = vi.fn(async () => ({ total: 10 }))

    const [first, second] = await Promise.all([
      getOrSetFinanceCache('test:summary', loader),
      getOrSetFinanceCache('test:summary', loader),
    ])

    expect(first).toEqual({ total: 10 })
    expect(second).toEqual({ total: 10 })
    expect(loader).toHaveBeenCalledTimes(1)

    invalidateFinanceCache()
    await getOrSetFinanceCache('test:summary', loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
