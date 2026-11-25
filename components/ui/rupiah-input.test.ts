import { describe, expect, it } from 'vitest'
import { formatRupiahDigits, parseRupiahDigits } from './rupiah-input'

describe('RupiahInput helpers', () => {
  it('formats positive integers with Indonesian thousands separators', () => {
    expect(formatRupiahDigits('254280000')).toBe('254.280.000')
    expect(formatRupiahDigits(2212200000)).toBe('2.212.200.000')
    expect(formatRupiahDigits('0005000')).toBe('5.000')
    expect(formatRupiahDigits('0')).toBe('0')
    expect(formatRupiahDigits('')).toBe('')
    expect(formatRupiahDigits(null)).toBe('')
  })

  it('handles negative numbers only when allowNegative is enabled', () => {
    expect(formatRupiahDigits('-1500000', false)).toBe('1.500.000')
    expect(formatRupiahDigits('-1500000', true)).toBe('-1.500.000')
    expect(parseRupiahDigits('-250.000', true)).toBe('-250000')
    expect(parseRupiahDigits('-', true)).toBe('')
  })

  it('strips formatting characters back to clean integer digits', () => {
    expect(parseRupiahDigits('Rp 5.250.000')).toBe('5250000')
    expect(parseRupiahDigits('0')).toBe('0')
    expect(parseRupiahDigits('abc')).toBe('')
  })
})
