import { describe, expect, it } from 'vitest'
import {
  renderNotificationTemplate,
  validateNotificationTemplate,
  validateNotificationUrl,
} from './notification-engine'
import { getNotificationDefinition } from './notification-catalog'

describe('notification templates', () => {
  it('renders valid placeholders', () => {
    expect(renderNotificationTemplate(
      'Ananda {nama_siswa} dari {kelas} hadir pada {tanggal}.',
      { nama_siswa: 'Alya', kelas: 'XII IPA 1', tanggal: '2026-08-21' },
      ['nama_siswa', 'kelas', 'tanggal'],
    )).toBe('Ananda Alya dari XII IPA 1 hadir pada 2026-08-21.')
  })

  it('rejects unknown placeholders before saving', () => {
    expect(validateNotificationTemplate('Pesan {nama_siswa} {tidak_dikenal}', ['nama_siswa']))
      .toEqual(['tidak_dikenal'])
    expect(() => renderNotificationTemplate('Pesan {tidak_dikenal}', {}, ['nama_siswa']))
      .toThrow('Placeholder not valid')
  })

  it('accepts internal paths and HTTPS URLs only', () => {
    expect(validateNotificationUrl('/portal-ortu')).toBe(true)
    expect(validateNotificationUrl('https://app.mansatas.com/portal-ortu')).toBe(true)
    expect(validateNotificationUrl('javascript:alert(1)')).toBe(false)
    expect(validateNotificationUrl('http://app.mansatas.com')).toBe(false)
  })
})

describe('notification reminder defaults', () => {
  it('keeps the KBM reminder enabled at the advertised 10-minute lead time', () => {
    const definition = getNotificationDefinition('kbm_teaching_reminder')

    expect(definition?.defaultEnabled).toBe(true)
    expect(definition?.reminder).toMatchObject({
      enabled: true,
      leadMinutes: 10,
    })
  })
})

describe('Komite notification catalog', () => {
  const eventKeys = [
    'komite_submission_received',
    'komite_treasurer_approved',
    'komite_chairman_review_requested',
    'komite_chairman_approved',
    'komite_principal_review_requested',
    'komite_final_approved',
    'komite_revision_requested',
    'komite_rejected',
    'komite_review_delegated',
  ]

  it('exposes every workflow stage as an enabled configurable event', () => {
    for (const eventKey of eventKeys) {
      const definition = getNotificationDefinition(eventKey)
      expect(definition, eventKey).toBeDefined()
      expect(definition?.defaultEnabled, eventKey).toBe(true)
      expect(definition?.defaultChannels, eventKey).toEqual(['fcm', 'webpush'])
      expect(validateNotificationTemplate(definition?.defaultTitle || '', definition?.placeholders || []), eventKey).toEqual([])
      expect(validateNotificationTemplate(definition?.defaultBody || '', definition?.placeholders || []), eventKey).toEqual([])
    }
  })

  it('routes queue events to reviewers and decision events to the applicant context', () => {
    expect(getNotificationDefinition('komite_submission_received')?.defaultTarget)
      .toEqual({ kind: 'staff_role', value: 'bendahara_komite' })
    expect(getNotificationDefinition('komite_chairman_review_requested')?.defaultTarget)
      .toEqual({ kind: 'staff_role', value: 'ketua_komite' })
    expect(getNotificationDefinition('komite_principal_review_requested')?.defaultTarget)
      .toEqual({ kind: 'staff_role', value: 'kepsek' })
    expect(getNotificationDefinition('komite_treasurer_approved')?.defaultTarget)
      .toEqual({ kind: 'staff_users' })
  })
})
