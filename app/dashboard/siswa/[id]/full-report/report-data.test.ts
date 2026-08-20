import { describe, expect, it } from 'vitest'
import { academicPeriodDates, canAccessFullStudentReport, FULL_REPORT_ROLES } from './report-data'

function assignedDb(isAssigned: boolean) {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => isAssigned ? { id: 'assignment-1' } : null,
      }),
    }),
  } as unknown as D1Database
}

describe('full student report period', () => {
  it('maps semester 1 to July through December', () => {
    expect(academicPeriodDates('2026/2027', 1)).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-12-31',
    })
  })

  it('maps semester 2 to January through June', () => {
    expect(academicPeriodDates('2026 / 2027', 2)).toEqual({
      startDate: '2027-01-01',
      endDate: '2027-06-30',
    })
  })

  it('fails closed for an unparseable academic year label', () => {
    expect(academicPeriodDates('Tahun aktif', 1)).toEqual({ startDate: null, endDate: null })
  })
})

describe('full student report access', () => {
  it('keeps the privileged role list explicit', () => {
    expect(FULL_REPORT_ROLES).toEqual(['super_admin', 'kepsek', 'wakamad', 'admin_tu', 'guru_bk'])
  })

  it('allows leadership without a class assignment lookup', async () => {
    await expect(canAccessFullStudentReport(assignedDb(false), 'user-1', ['kepsek'], null)).resolves.toBe(true)
  })

  it('allows a BK teacher only for an assigned class', async () => {
    await expect(canAccessFullStudentReport(assignedDb(true), 'bk-1', ['guru_bk'], 'kelas-1')).resolves.toBe(true)
    await expect(canAccessFullStudentReport(assignedDb(false), 'bk-1', ['guru_bk'], 'kelas-2')).resolves.toBe(false)
  })

  it('rejects roles outside the report allowlist', async () => {
    await expect(canAccessFullStudentReport(assignedDb(true), 'guru-1', ['guru'], 'kelas-1')).resolves.toBe(false)
  })
})

