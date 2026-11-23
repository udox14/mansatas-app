import { describe, expect, it } from 'vitest'
import {
  BAKAT_FIELDS,
  GAYA_BELAJAR_SCORE_FIELDS,
  MINAT_FIELDS,
  getGayaBelajarInfo,
  getMbtiInfo,
  getRiasecInfo,
} from './psikotes-kamus'

describe('psikotes kamus helpers', () => {
  it('resolves MBTI metadata case-insensitively and returns null for unknown codes', () => {
    expect(getMbtiInfo('enfj')).toMatchObject({ kode: 'ENFJ', nama: 'Protagonis', kategori: 'MBTI' })
    expect(getMbtiInfo('ISFJ')).toMatchObject({ kode: 'ISFJ', nama: 'Pelindung' })
    expect(getMbtiInfo('')).toBeNull()
    expect(getMbtiInfo('XXXX')).toBeNull()
  })

  it('resolves gaya belajar descriptions and parses RIASEC themes in order', () => {
    expect(getGayaBelajarInfo('visual')).toMatchObject({ code: 'V', label: 'Visual' })
    expect(getGayaBelajarInfo('M')).toMatchObject({ code: 'M', label: 'Auditori' })
    expect(getGayaBelajarInfo(null)).toBeNull()

    const riasec = getRiasecInfo('SOCIAL, ARTISTIC, REALISTIC')
    expect(riasec).toHaveLength(3)
    expect(riasec[0].label).toBe('Social (Sosial)')
    expect(riasec[1].label).toBe('Artistic (Kreatif)')
    expect(riasec[2].label).toBe('Realistic (Praktis)')
  })

  it('exposes complete bakat, minat, and gaya belajar field definitions', () => {
    expect(BAKAT_FIELDS.map(f => f.code)).toEqual(['VER', 'NUM', 'SKL', 'ABS', 'MEK', 'RR', 'KKK'])
    expect(MINAT_FIELDS.map(f => f.code)).toEqual(['PS', 'NAT', 'MEK', 'BIS', 'ART', 'SI'])
    expect(GAYA_BELAJAR_SCORE_FIELDS.map(f => f.code)).toEqual(['V', 'M', 'K'])
  })
})
