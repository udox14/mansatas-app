import { describe, expect, it } from 'vitest'
import { resolveKedisiplinanTab, resolveLegacyMonitoringTab } from './kedisiplinan-tabs'

describe('kedisiplinan tab routing', () => {
  it('uses riwayat as the default tab and accepts all combined tab values', () => {
    expect(resolveKedisiplinanTab()).toBe('riwayat')
    expect(resolveKedisiplinanTab('riwayat')).toBe('riwayat')
    expect(resolveKedisiplinanTab('monitoring')).toBe('monitoring')
    expect(resolveKedisiplinanTab('analitik')).toBe('analitik')
    expect(resolveKedisiplinanTab('kamus')).toBe('kamus')
    expect(resolveKedisiplinanTab('klarifikasi')).toBe('klarifikasi')
  })

  it('maps the previous pelanggar tab to monitoring and ignores unknown values', () => {
    expect(resolveKedisiplinanTab('pelanggar')).toBe('monitoring')
    expect(resolveKedisiplinanTab('not-a-tab')).toBe('riwayat')
  })

  it('keeps legacy monitoring links on their former default and analytics views', () => {
    expect(resolveLegacyMonitoringTab()).toBe('monitoring')
    expect(resolveLegacyMonitoringTab('pelanggar')).toBe('monitoring')
    expect(resolveLegacyMonitoringTab('analitik')).toBe('analitik')
    expect(resolveLegacyMonitoringTab('unknown')).toBe('monitoring')
  })
})
