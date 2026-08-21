import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VERIFICATION_THRESHOLDS,
  academicYearDates,
  attendanceIndicator,
  counselingIndicator,
  disciplineIndicator,
  normalizeVerificationThresholds,
  parseVerificationThresholds,
  summarizeRdmAcademic,
  VERIFICATION_ROLES,
  worstRisk,
} from './verification-core'

describe('student verification access and settings', () => {
  it('locks the module to leadership roles', () => {
    expect(VERIFICATION_ROLES).toEqual(['super_admin', 'kepsek', 'wakamad'])
  })

  it('falls back when persisted settings are malformed', () => {
    expect(parseVerificationThresholds('{broken')).toEqual(DEFAULT_VERIFICATION_THRESHOLDS)
    expect(normalizeVerificationThresholds({ version: 1, attendanceWarning: 70, attendanceCritical: 80 }))
      .toEqual(DEFAULT_VERIFICATION_THRESHOLDS)
  })
})

describe('student verification indicators', () => {
  it('uses the balanced attendance thresholds', () => {
    expect(attendanceIndicator(95, 100, DEFAULT_VERIFICATION_THRESHOLDS).level).toBe('aman')
    expect(attendanceIndicator(85, 100, DEFAULT_VERIFICATION_THRESHOLDS).level).toBe('perhatian')
    expect(attendanceIndicator(79, 100, DEFAULT_VERIFICATION_THRESHOLDS).level).toBe('kritis')
  })

  it('uses existing discipline thresholds and open counseling', () => {
    expect(disciplineIndicator(24).level).toBe('aman')
    expect(disciplineIndicator(25).level).toBe('perhatian')
    expect(disciplineIndicator(10, 'SP2').level).toBe('kritis')
    expect(counselingIndicator(1).level).toBe('perhatian')
  })

  it('selects the worst domain without producing a promotion verdict', () => {
    const indicators = [attendanceIndicator(95, 100, DEFAULT_VERIFICATION_THRESHOLDS), disciplineIndicator(75)]
    expect(worstRisk(indicators)).toBe('kritis')
  })
})

describe('student verification periods and RDM mapping', () => {
  it('maps an academic year to July through June', () => {
    expect(academicYearDates('2025/2026')).toEqual({ startDate: '2025-07-01', endDate: '2026-06-30' })
  })

  it('combines both semester records and detects missing or sub-KKM values', () => {
    const result = summarizeRdmAcademic({
      nilai_smt1: JSON.stringify({ Matematika: 80, Fisika: 70, Kimia: 82 }),
      nilai_smt2: JSON.stringify({ Matematika: 82, Fisika: 78 }),
    }, 10)
    expect(result.total).toBe(3)
    expect(result.problematic).toBe(2)
    expect(result.rows.find(row => row.subject === 'Matematika')?.problematic).toBe(false)
  })
})
