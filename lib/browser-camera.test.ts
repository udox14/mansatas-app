import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureBrowserPhoto, openBrowserCamera } from './browser-camera'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('browser camera fallback', () => {
  it('opens a rear camera preview without requesting microphone access', async () => {
    const stream = { getTracks: () => [] }
    const request = vi.fn(async () => stream)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: request } })
    expect(await openBrowserCamera()).toBe(stream)
    expect(request).toHaveBeenCalledWith({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
  })

  it('reports unsupported camera access', async () => {
    vi.stubGlobal('navigator', {})
    await expect(openBrowserCamera()).rejects.toThrow('Kamera di halaman tidak tersedia')
  })

  it('propagates permission denial without leaving an active operation', async () => {
    const denied = new DOMException('Permission denied', 'NotAllowedError')
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => { throw denied } } })
    await expect(openBrowserCamera()).rejects.toBe(denied)
  })

  it('times out a camera request and stops a stream returned after the timeout', async () => {
    vi.useFakeTimers()
    let deliver!: (stream: MediaStream) => void
    const stop = vi.fn()
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise<MediaStream>(resolve => { deliver = resolve }) } })
    const pending = expect(openBrowserCamera()).rejects.toThrow('Kamera belum merespons')
    await vi.advanceTimersByTimeAsync(20_000)
    await pending
    deliver({ getTracks: () => [{ stop }] } as unknown as MediaStream)
    await vi.advanceTimersByTimeAsync(0)
    expect(stop).toHaveBeenCalledOnce()
  })

  it('rejects an empty preview instead of sending a blank photo', async () => {
    await expect(captureBrowserPhoto({ videoWidth: 0, videoHeight: 0, readyState: 1 } as HTMLVideoElement)).rejects.toThrow('Kamera belum siap')
  })

  it('captures the actual frame as JPEG, preserving portrait proportions', async () => {
    const drawImage = vi.fn()
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['jpeg'], { type: 'image/jpeg' })) }
    vi.stubGlobal('document', { createElement: () => canvas })
    const video = { videoWidth: 2160, videoHeight: 3840, readyState: 2 } as HTMLVideoElement
    const file = await captureBrowserPhoto(video)
    expect([canvas.width, canvas.height]).toEqual([720, 1280])
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 720, 1280)
    expect(file.type).toBe('image/jpeg')
    expect(file.size).toBeGreaterThan(0)
  })

  it('reports failed JPEG encoding', async () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage: () => {} }), toBlob: (callback: (blob: null) => void) => callback(null) }) })
    await expect(captureBrowserPhoto({ videoWidth: 640, videoHeight: 480, readyState: 2 } as HTMLVideoElement)).rejects.toThrow('Foto gagal diambil')
  })

  it('releases a stuck photo encoder', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage: () => {} }), toBlob: () => {} }) })
    const pending = expect(captureBrowserPhoto({ videoWidth: 640, videoHeight: 480, readyState: 2 } as HTMLVideoElement)).rejects.toThrow('Pemotretan terlalu lama')
    await vi.advanceTimersByTimeAsync(10_000)
    await pending
  })
})
