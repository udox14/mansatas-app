import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendAgenda } from './agenda-submission-client'

describe('agenda delivery', () => {
  beforeEach(() => vi.stubGlobal('navigator', { onLine: true }))
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

  it('requires saved row evidence and rejects an empty success response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: 'Berhasil' })))
    await expect(sendAgenda(new FormData())).rejects.toThrow('belum mengonfirmasi')
  })

  it('accepts only the acknowledged agenda', async () => {
    const result = { success: 'Tersimpan', agenda: { id: 'ag1', status: 'TELAT' } }
    const fetch = vi.fn(async () => Response.json(result))
    vi.stubGlobal('fetch', fetch)
    expect(await sendAgenda(new FormData())).toEqual(result)
    expect(fetch.mock.calls[0]).toEqual(['/api/agenda/submit', expect.objectContaining({ method: 'POST', credentials: 'include', signal: expect.any(AbortSignal) })])
  })

  it.each([
    [401, 'Sesi login sudah berakhir'], [413, 'Foto terlalu besar'],
    [403, 'Tidak punya akses'], [500, 'Server gagal menyimpan'],
  ])('explains HTTP %s', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: message }, { status })))
    await expect(sendAgenda(new FormData())).rejects.toThrow(message)
  })

  it('reports an offline device without sending', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(sendAgenda(new FormData())).rejects.toThrow('offline')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('aborts a stuck request and permits a fresh retry', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })).mockResolvedValueOnce(Response.json({ success: 'Tersimpan', agenda: { id: 'ag1', status: 'TEPAT_WAKTU' } }))
    vi.stubGlobal('fetch', fetch)
    const pending = expect(sendAgenda(new FormData())).rejects.toThrow('belum dapat dipastikan')
    await vi.advanceTimersByTimeAsync(45_000)
    await pending
    expect((await sendAgenda(new FormData())).agenda?.id).toBe('ag1')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('explains a broken connection and invalid response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(new Response('<html>error</html>')))
    await expect(sendAgenda(new FormData())).rejects.toThrow('Koneksi ke server terputus')
    await expect(sendAgenda(new FormData())).rejects.toThrow('Respons server tidak dapat dibaca')
  })
})
