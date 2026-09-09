import { describe, expect, it } from 'vitest'
import { isValidIsoDate, normalizeCashflowFilters } from './cashflow'

describe('cashflow input helpers', () => {
  it('accepts real ISO dates and rejects normalized impossible dates', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true)
    expect(isValidIsoDate('2026-02-29')).toBe(false)
    expect(isValidIsoDate('2024-02-29')).toBe(true)
    expect(isValidIsoDate('09/09/2026')).toBe(false)
  })

  it('bounds server pagination and search input', () => {
    expect(normalizeCashflowFilters({ page: -4, pageSize: 1000 }).page).toBe(1)
    expect(normalizeCashflowFilters({ pageSize: 1000 }).pageSize).toBe(100)
    expect(normalizeCashflowFilters({ pageSize: 1 }).pageSize).toBe(10)
    expect(normalizeCashflowFilters({ search: `  ${'a'.repeat(120)}  ` }).search).toHaveLength(100)
  })
})
