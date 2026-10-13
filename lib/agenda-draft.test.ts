import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { agendaDraftKey, beginAgendaCamera, clearAgendaDraft, draftPhotoFile, photoToFile, readAgendaDraft, restoreAgendaCamera, saveAgendaCameraPhoto, saveAgendaDraft } from './agenda-draft'

const native = vi.hoisted(() => ({ enabled: false, readFile: vi.fn() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.enabled } }))
vi.mock('@capacitor/filesystem', () => ({ Filesystem: { readFile: native.readFile } }))

describe('agenda camera draft recovery', () => {
  const key = agendaDraftKey('guru1', '2026-10-02')
  beforeEach(() => {
    native.enabled = false
    native.readFile.mockReset()
    const entries = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => entries.get(key) || null,
      setItem: (key: string, value: string) => entries.set(key, value),
      removeItem: (key: string) => entries.delete(key),
    })
    vi.stubGlobal('window', { location: { pathname: '/dashboard/agenda', search: '' } })
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

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

  it('persists the native URI before reading, even if reading fails', async () => {
    native.enabled = true
    native.readFile.mockRejectedValue(new Error('temporary camera read error'))
    saveAgendaDraft(key, { penugasanId: 'p1', materi: 'Aljabar', updatedAt: Date.now(), photoDataUrl: 'data:old' })
    const photo = { path: 'file:///data/camera.jpg', format: 'jpeg' }
    saveAgendaCameraPhoto(key, photo)
    await expect(draftPhotoFile(readAgendaDraft(key)!)).rejects.toThrow('Foto dari kamera tidak dapat dibaca')
    expect(readAgendaDraft(key)).toMatchObject({ materi: 'Aljabar', nativePhoto: photo })
    expect(readAgendaDraft(key)?.photoDataUrl).toBeUndefined()
  })

  it('recovers path-only native results after Android restarts the app', async () => {
    native.enabled = true
    native.readFile.mockResolvedValue({ data: btoa('photo bytes') })
    const network = vi.fn()
    vi.stubGlobal('fetch', network)
    saveAgendaDraft(key, { penugasanId: 'p1', materi: 'Aljabar', updatedAt: Date.now() })
    beginAgendaCamera(key)
    expect(restoreAgendaCamera({ path: 'file:///data/camera.jpg', format: 'jpeg' })).toBe('/dashboard/agenda')
    const file = await draftPhotoFile(readAgendaDraft(key)!)
    expect(await file!.text()).toBe('photo bytes')
    expect(file?.type).toBe('image/jpeg')
    expect(network).not.toHaveBeenCalled()
  })

  it('reads old webPath-only drafts directly from the device, bypassing HTTP', async () => {
    native.enabled = true
    native.readFile.mockResolvedValue({ data: btoa('photo') })
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('HTTP must not be used') }))
    await photoToFile({ webPath: 'https://app.mansatas.com/_capacitor_file_/data/foto%20kelas.jpg' })
    expect(native.readFile).toHaveBeenCalledWith({ path: 'file:///data/foto kelas.jpg' })
  })

  it('releases a hung native file read after 20 seconds', async () => {
    vi.useFakeTimers()
    native.enabled = true
    native.readFile.mockImplementation(() => new Promise(() => {}))
    const pending = expect(photoToFile({ path: 'file:///data/camera.jpg' })).rejects.toThrow('melewati 20 detik')
    await vi.advanceTimersByTimeAsync(20_000)
    await pending
  })

  it('continues to read browser camera blobs without native filesystem', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['browser photo'], { type: 'image/jpeg' }))))
    expect(await (await photoToFile({ webPath: 'blob:camera' })).text()).toBe('browser photo')
    expect(native.readFile).not.toHaveBeenCalled()
  })
})
