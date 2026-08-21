import { describe, expect, it } from 'vitest'
import {
  renderNotificationTemplate,
  validateNotificationTemplate,
  validateNotificationUrl,
} from './notification-engine'

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
