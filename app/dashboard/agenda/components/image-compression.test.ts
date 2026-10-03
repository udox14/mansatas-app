import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressAgendaImage } from './image-compression'

describe('agenda image failures', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
  const file = () => new File(['photo'], 'camera.jpg', { type: 'image/jpeg' })
  function image(outcome: 'load' | 'error' | 'hang', width = 1600, height = 1200) {
    vi.stubGlobal('window', { Image: class {
      width = width; height = height
      onload?: () => void
      onerror?: () => void
      set src(_value: string) { queueMicrotask(() => { if (outcome === 'load') this.onload?.(); if (outcome === 'error') this.onerror?.() }) }
    } })
  }

  it('rejects unreadable photos instead of uploading the original oversized file', async () => {
    image('error')
    await expect(compressAgendaImage(file())).rejects.toThrow('Format foto tidak dapat dibaca')
  })
  it('reports a stuck decoder and releases the operation', async () => {
    vi.useFakeTimers()
    image('hang')
    const pending = expect(compressAgendaImage(file())).rejects.toThrow('Foto terlalu lama dibaca')
    await vi.advanceTimersByTimeAsync(15_000)
    await pending
  })
  it('propagates canvas failures rather than leaving submit busy forever', async () => {
    image('load')
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ clearRect: () => {}, fillRect: () => {}, drawImage: () => { throw new Error('Perangkat gagal menggambar foto') } }) }) })
    await expect(compressAgendaImage(file())).rejects.toThrow('Perangkat gagal menggambar foto')
  })
  it('re-encodes an oversized PNG fallback as JPEG when WebP is not supported', async () => {
    image('load')
    const encode = vi.fn((callback: (blob: Blob) => void, mime: string) => callback(mime === 'image/webp'
      ? new Blob([new Uint8Array(2 * 1024 * 1024)], { type: 'image/png' })
      : new Blob([new Uint8Array(180 * 1024)], { type: 'image/jpeg' })))
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ clearRect: () => {}, fillRect: () => {}, drawImage: () => {} }), toBlob: encode }) })
    const result = await compressAgendaImage(file())
    expect(result.type).toBe('image/jpeg')
    expect(result.name).toBe('camera.jpg')
    expect(result.size).toBeLessThanOrEqual(220 * 1024)
    expect(encode.mock.calls.map(call => call[1])).toEqual(['image/webp', 'image/jpeg'])
  })

  it.each([[4000, 3000], [3000, 4000], [4000, 1000]])('shrinks a %sx%s photo below 720 pixels without stretching it', async (width, height) => {
    image('load', width, height)
    const dimensions: Array<[number, number]> = []
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ clearRect: () => {}, fillRect: () => {}, drawImage: () => {} }),
      toBlob(callback: (blob: Blob) => void) {
        dimensions.push([this.width, this.height])
        // Model an encoder that ignores quality: only lowering resolution works.
        callback(new Blob([new Uint8Array(this.width * this.height * 3)], { type: 'image/webp' }))
      },
    }
    vi.stubGlobal('document', { createElement: () => canvas })
    const result = await compressAgendaImage(file())
    expect(result.size).toBeLessThanOrEqual(900 * 1024)
    expect(Math.max(canvas.width, canvas.height)).toBeLessThan(720)
    for (const [w, h] of dimensions) expect(Math.abs(w / h - width / height)).toBeLessThan(0.04)
    expect(canvas.width).toBeLessThanOrEqual(1280)
    expect(canvas.height).toBeLessThanOrEqual(1280)
  })

  it('does not enlarge a small photo', async () => {
    image('load', 160, 120)
    const canvas = { width: 0, height: 0, getContext: () => ({ clearRect: () => {}, fillRect: () => {}, drawImage: () => {} }), toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['webp'], { type: 'image/webp' })) }
    vi.stubGlobal('document', { createElement: () => canvas })
    await compressAgendaImage(file())
    expect([canvas.width, canvas.height]).toEqual([160, 120])
  })

  it('does not retry unsupported WebP on every JPEG quality adjustment', async () => {
    image('load')
    const encode = vi.fn((callback: (blob: Blob) => void, mime: string, quality: number) => callback(new Blob([new Uint8Array(mime === 'image/webp' ? 2_000_000 : quality > 0.45 ? 400_000 : 150_000)], { type: mime === 'image/webp' ? 'image/png' : 'image/jpeg' })))
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ clearRect: () => {}, fillRect: () => {}, drawImage: () => {} }), toBlob: encode }) })
    expect((await compressAgendaImage(file())).type).toBe('image/jpeg')
    expect(encode.mock.calls.filter(call => call[1] === 'image/webp')).toHaveLength(1)
    expect(encode.mock.calls.filter(call => call[1] === 'image/jpeg').length).toBeGreaterThan(1)
  })

  it('reports when neither lossy encoder is supported instead of looping on PNG quality', async () => {
    image('load')
    const encode = vi.fn((callback: (blob: Blob) => void) => callback(new Blob(['png'], { type: 'image/png' })))
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ clearRect: () => {}, fillRect: () => {}, drawImage: () => {} }), toBlob: encode }) })
    await expect(compressAgendaImage(file())).rejects.toThrow('Perangkat tidak dapat mengompres foto')
    expect(encode).toHaveBeenCalledTimes(2)
  })

  it('reports an encoder that never finishes', async () => {
    vi.useFakeTimers()
    image('load')
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ clearRect: () => {}, fillRect: () => {}, drawImage: () => {} }), toBlob: () => {} }) })
    const pending = expect(compressAgendaImage(file())).rejects.toThrow('Pemrosesan foto terlalu lama')
    await vi.advanceTimersByTimeAsync(10_000)
    await pending
  })
})
