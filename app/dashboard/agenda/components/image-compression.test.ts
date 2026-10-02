import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressAgendaImage } from './image-compression'

describe('agenda image failures', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
  const file = () => new File(['photo'], 'camera.jpg', { type: 'image/jpeg' })
  function image(outcome: 'load' | 'error' | 'hang') {
    vi.stubGlobal('window', { Image: class {
      width = 1600; height = 1200
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
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ clearRect: () => {}, drawImage: () => { throw new Error('Perangkat gagal menggambar foto') } }) }) })
    await expect(compressAgendaImage(file())).rejects.toThrow('Perangkat gagal menggambar foto')
  })
  it('preserves the encoder MIME when WebP is not supported', async () => {
    image('load')
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ clearRect: () => {}, drawImage: () => {} }), toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['png'], { type: 'image/png' })) }) })
    const result = await compressAgendaImage(file())
    expect(result.type).toBe('image/png')
    expect(result.name).toBe('camera.png')
  })
})
