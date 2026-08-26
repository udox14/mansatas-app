import { describe, expect, it } from 'vitest'
import { sanitizeParentAgenda } from './parent-schedule'

describe('sanitizeParentAgenda', () => {
  it('keeps the activity photo only for the current day', () => {
    const agenda = { materi: 'Aljabar', foto_url: '/api/media/foto.webp' }
    expect(sanitizeParentAgenda(agenda, '2026-08-26', '2026-08-26')).toEqual(agenda)
  })

  it('removes the photo URL from other days without mutating the source', () => {
    const agenda = { materi: 'Aljabar', foto_url: '/api/media/foto-lama.webp' }
    expect(sanitizeParentAgenda(agenda, '2026-08-25', '2026-08-26')).toEqual({ materi: 'Aljabar' })
    expect(agenda.foto_url).toBe('/api/media/foto-lama.webp')
  })
})

