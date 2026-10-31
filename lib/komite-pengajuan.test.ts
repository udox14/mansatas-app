import { describe, expect, it } from 'vitest'
import { komiteReviewNotificationPlans, komiteNextReviewStatus, komiteSpbApprovalStages } from './komite-pengajuan'

describe('Komite review notification routing', () => {
  it('notifies both applicant and next reviewer after treasurer approval', () => {
    expect(komiteReviewNotificationPlans('bendahara', 'setujui')).toEqual([
      { eventKey: 'komite_treasurer_approved', recipient: 'applicant', suffix: 'approved' },
      { eventKey: 'komite_verifier_review_requested', recipient: 'reviewer', suffix: 'waiting-verifier' },
    ])
  })

  it('never adds a principal approval even if the retired flag is supplied', () => {
    expect(komiteReviewNotificationPlans('ketua','setujui',true)).toEqual([
      { eventKey:'komite_final_approved',recipient:'applicant',suffix:'final-approved' },
    ])
  })

  it('notifies the applicant for final approval, revision, and rejection', () => {
    expect(komiteReviewNotificationPlans('kepala', 'setujui')[0]?.eventKey).toBe('komite_final_approved')
    expect(komiteReviewNotificationPlans('bendahara', 'minta_revisi')[0]?.eventKey).toBe('komite_revision_requested')
    expect(komiteReviewNotificationPlans('ketua', 'tolak')[0]?.eventKey).toBe('komite_rejected')
  })

  it('finalizes at verifier without notifying the principal', () => {
    expect(komiteNextReviewStatus('ketua', 'setujui')).toBe('disetujui')
    expect(komiteReviewNotificationPlans('ketua', 'setujui')).toEqual([
      { eventKey: 'komite_final_approved', recipient: 'applicant', suffix: 'final-approved' },
    ])
  })

  it('ignores the retired principal flag and retains revision and rejection', () => {
    for (const enabled of [false, true]) {
      expect(komiteNextReviewStatus('bendahara', 'setujui', enabled)).toBe('menunggu_ketua')
      expect(komiteNextReviewStatus('ketua', 'setujui', enabled)).toBe('disetujui')
      expect(komiteNextReviewStatus('kepala', 'setujui', enabled)).toBe('disetujui')
      for (const stage of ['bendahara', 'ketua', 'kepala'] as const) {
        expect(komiteNextReviewStatus(stage, 'minta_revisi', enabled)).toBe('perlu_revisi')
        expect(komiteNextReviewStatus(stage, 'tolak', enabled)).toBe('ditolak')
      }
    }
  })

  it('uses recorded final stages for SPB while retaining three stages for historical records', () => {
    expect(komiteSpbApprovalStages('ketua')).toEqual(['bendahara', 'ketua'])
    for (const stage of ['kepala', null, undefined]) {
      expect(komiteSpbApprovalStages(stage)).toEqual(['bendahara', 'ketua', 'kepala'])
    }
  })
})
