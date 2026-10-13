import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

describe('agenda status cache policy', () => {
  it.each(['/_capacitor_file_/data/foto.jpg', '/_capacitor_content_/photo/1'])('lets the native bridge serve %s without service worker interception', path => {
    const handlers = new Map<string, (event: unknown) => void>()
    const network = vi.fn()
    const cache = vi.fn()
    const intercept = vi.fn()
    runInNewContext(readFileSync('public/sw.js', 'utf8'), {
      self: { location: { origin: 'https://app.mansatas.com' }, addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler) },
      Request, Response, URL, fetch: network, caches: { open: cache },
    })
    handlers.get('fetch')!({ request: { url: `https://app.mansatas.com${path}`, method: 'GET' }, respondWith: intercept })
    expect(intercept).not.toHaveBeenCalled()
    expect(network).not.toHaveBeenCalled()
    expect(cache).not.toHaveBeenCalled()
  })

  it.each(['/dashboard/agenda', '/dashboard/agenda?tab=riwayat', '/dashboard/monitoring-agenda', '/dashboard/monitoring-agenda/print'])('always loads %s from network without a saved attendance snapshot', async path => {
    const handlers = new Map<string, (event: unknown) => void>()
    const cache = vi.fn()
    const network = vi.fn(async () => new Response('fresh'))
    runInNewContext(readFileSync('public/sw.js', 'utf8'), {
      self: { location: { origin: 'https://app.mansatas.com' }, addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler) },
      Request, Response, URL, fetch: network, caches: { open: cache },
    })
    let pending: Promise<Response> | undefined
    const request = { url: `https://app.mansatas.com${path}`, method: 'GET', mode: 'navigate' }
    handlers.get('fetch')!({ request, respondWith: (response: Promise<Response>) => { pending = response } })
    expect(await (await pending)!.text()).toBe('fresh')
    expect(cache).not.toHaveBeenCalled()
    expect(network).toHaveBeenCalledWith(request)
  })

  it('does not present a cached RSC attendance state when offline', async () => {
    const handlers = new Map<string, (event: unknown) => void>()
    const cache = vi.fn()
    runInNewContext(readFileSync('public/sw.js', 'utf8'), {
      self: { location: { origin: 'https://app.mansatas.com' }, addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler) },
      Request, Response, URL, fetch: async () => { throw new Error('offline') }, caches: { open: cache },
    })
    let pending: Promise<Response> | undefined
    handlers.get('fetch')!({ request: { url: 'https://app.mansatas.com/dashboard/agenda?_rsc=x', method: 'GET', mode: 'cors' }, respondWith: (response: Promise<Response>) => { pending = response } })
    expect((await pending)!.status).toBe(503)
    expect(cache).not.toHaveBeenCalled()
  })
})
