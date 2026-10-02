import { describe, expect, it } from 'vitest'
import { createMediaGrant, getMediaPolicy, verifyMediaGrant } from './media-security'

describe('media security policy', () => {
  it('only exposes the system prefix publicly', () => {
    expect(getMediaPolicy('system/logo-v2.png')?.policy.visibility).toBe('public')
    expect(getMediaPolicy('foto_siswa/student-1/photo.jpg')?.policy.visibility).toBe('private')
    expect(getMediaPolicy('pdf-cache/report.pdf')?.policy.visibility).toBe('internal')
  })

  it('rejects unknown and traversal keys', () => {
    expect(getMediaPolicy('sarpras/asset.jpg')).toBeNull()
    expect(getMediaPolicy('unknown/file.pdf')).toBeNull()
    expect(getMediaPolicy('foto_siswa/../secret.txt')).toBeNull()
    expect(getMediaPolicy('foto_siswa%2F..%2Fsecret.txt')).toBeNull()
  })
})

describe('media renderer grants', () => {
  it('accepts a valid five-minute grant and rejects tampering or expiry', async () => {
    const now = 1_800_000_000
    const key = 'signatures/user-1/signature.png'
    const grant = await createMediaGrant(key, 'browser-rendering', 'test-secret', now)

    await expect(verifyMediaGrant(key, grant.aud, String(grant.exp), grant.sig, 'test-secret', now)).resolves.toBe(true)
    await expect(verifyMediaGrant('signatures/user-2/signature.png', grant.aud, String(grant.exp), grant.sig, 'test-secret', now)).resolves.toBe(false)
    await expect(verifyMediaGrant(key, grant.aud, String(grant.exp), grant.sig, 'test-secret', grant.exp + 1)).resolves.toBe(false)
  })

  it('does not create grants for public or unknown keys', async () => {
    await expect(createMediaGrant('system/logo.png', 'browser-rendering', 'test-secret')).rejects.toThrow()
    await expect(createMediaGrant('unknown/logo.png', 'browser-rendering', 'test-secret')).rejects.toThrow()
  })
})
