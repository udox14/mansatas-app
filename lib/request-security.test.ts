import { afterEach, describe, expect, it } from 'vitest'
import { isAllowedMutationOrigin } from './request-security'

const originalOrigins = process.env.ALLOWED_APP_ORIGINS

afterEach(() => {
  ;(process.env as Record<string, string | undefined>).ALLOWED_APP_ORIGINS = originalOrigins
})

describe('cookie mutation origin validation', () => {
  it('accepts same-origin and explicitly configured native origins', () => {
    ;(process.env as Record<string, string | undefined>).ALLOWED_APP_ORIGINS = 'capacitor://localhost'
    expect(isAllowedMutationOrigin(new Request('https://app.example/api/update', {
      method: 'POST', headers: { origin: 'https://app.example', cookie: 'session=x' },
    }))).toBe(true)
    expect(isAllowedMutationOrigin(new Request('https://app.example/api/update', {
      method: 'POST', headers: { origin: 'capacitor://localhost', cookie: 'session=x' },
    }))).toBe(true)
  })

  it('rejects cross-origin and origin-less cookie mutations', () => {
    expect(isAllowedMutationOrigin(new Request('https://app.example/api/update', {
      method: 'POST', headers: { origin: 'https://evil.example', cookie: 'session=x' },
    }))).toBe(false)
    expect(isAllowedMutationOrigin(new Request('https://app.example/api/update', {
      method: 'POST', headers: { cookie: 'session=x' },
    }))).toBe(false)
  })

  it('allows origin-less non-cookie service calls', () => {
    expect(isAllowedMutationOrigin(new Request('https://app.example/api/cron', {
      method: 'POST', headers: { authorization: 'Bearer test' },
    }))).toBe(true)
  })
})
