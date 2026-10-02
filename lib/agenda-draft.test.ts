import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { agendaDraftKey, beginAgendaCamera, clearAgendaDraft, readAgendaDraft, restoreAgendaCamera, saveAgendaDraft } from './agenda-draft'

describe('agenda camera draft recovery', () => {
  const key = agendaDraftKey('guru1', '2026-10-02')
  beforeEach(() => {
    const entries = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => entries.get(key) || null,
      setItem: (key: string, value: string) => entries.set(key, value),
      removeItem: (key: string) => entries.delete(key),
    })
    vi.stubGlobal('window', { location: { pathname: '/dashboard/agenda', search: '' } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('recovers a camera result into the original teacher draft and route', () => {
    saveAgendaDraft(key, { penugasanId: 'p1', materi: 'Aljabar', updatedAt: Date.now() })
    beginAgendaCamera(key)
    expect(restoreAgendaCamera({ webPath: 'https://app.mansatas.com/_capacitor_file_/foto.jpg', format: 'jpeg' })).toBe('/dashboard/agenda')
    expect(readAgendaDraft(key)).toEqual(expect.objectContaining({ materi: 'Aljabar', nativePhoto: expect.objectContaining({ format: 'jpeg' }) }))
    expect(readAgendaDraft(agendaDraftKey('guru2', '2026-10-02'))).toBeNull()
    expect(restoreAgendaCamera({ webPath: 'other.jpg' })).toBeNull()
  })

  it('clears both draft and pending camera after a confirmed save', () => {
    saveAgendaDraft(key, { penugasanId: 'p1', materi: 'Aljabar', updatedAt: Date.now() })
    beginAgendaCamera(key)
    clearAgendaDraft(key)
    expect(readAgendaDraft(key)).toBeNull()
    expect(restoreAgendaCamera({ webPath: 'foto.jpg' })).toBeNull()
  })

  it('does not recover stale material into a new day', () => {
    saveAgendaDraft(key, { penugasanId: 'p1', materi: 'Aljabar', updatedAt: Date.now() - 25 * 60 * 60 * 1000 })
    beginAgendaCamera(key)
    expect(restoreAgendaCamera({ webPath: 'foto.jpg' })).toBeNull()
  })

  it('shows an actionable storage failure', () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('QuotaExceeded') } })
    expect(() => saveAgendaDraft(key, { penugasanId: 'p1', materi: 'Aljabar', updatedAt: Date.now() })).toThrow('Penyimpanan mungkin penuh')
  })
})
