import { describe, expect, it } from 'vitest'
import { komiteReviewNotificationPlans } from './komite-pengajuan'

describe('Komite review notification routing', () => {
  it('notifies both applicant and next reviewer after treasurer approval', () => {
    expect(komiteReviewNotificationPlans('bendahara', 'setujui')).toEqual([
      { eventKey: 'komite_treasurer_approved', recipient: 'applicant', suffix: 'approved' },
      { eventKey: 'komite_chairman_review_requested', recipient: 'reviewer', suffix: 'waiting-chairman' },
    ])
  })

  it('notifies both applicant and principal after chairman approval', () => {
    expect(komiteReviewNotificationPlans('ketua', 'setujui')).toEqual([
      { eventKey: 'komite_chairman_approved', recipient: 'applicant', suffix: 'approved' },
      { eventKey: 'komite_principal_review_requested', recipient: 'reviewer', suffix: 'waiting-principal' },
    ])
  })

  it('notifies the applicant for final approval, revision, and rejection', () => {
    expect(komiteReviewNotificationPlans('kepala', 'setujui')[0]?.eventKey).toBe('komite_final_approved')
    expect(komiteReviewNotificationPlans('bendahara', 'minta_revisi')[0]?.eventKey).toBe('komite_revision_requested')
    expect(komiteReviewNotificationPlans('ketua', 'tolak')[0]?.eventKey).toBe('komite_rejected')
  })
})
