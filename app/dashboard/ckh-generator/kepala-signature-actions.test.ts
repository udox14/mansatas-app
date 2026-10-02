import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  user: { id: 'admin' } as { id: string } | null,
  roles: ['admin_tu'], access: true,
  upload: vi.fn(), remove: vi.fn(), getSetting: vi.fn(), setSetting: vi.fn(),
}))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: async () => state.user }))
vi.mock('@/utils/db-server', () => ({ getDB: async () => ({}) }))
vi.mock('@/lib/features', () => ({
  getUserRoles: async () => state.roles,
  checkFeatureAccess: async () => state.access,
}))
vi.mock('@/utils/r2', () => ({
  validateImageFile: () => null, uploadCkhKepalaSignature: state.upload, deleteFromR2: state.remove,
}))
vi.mock('@/lib/system-settings', () => ({
  SYSTEM_SETTING_KEYS: { ckhKepalaSignatureUrl: 'ckh_kepala_signature_url' },
  getSystemSetting: state.getSetting, setSystemSetting: state.setSetting,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { deleteCkhKepalaSignatureAction, uploadCkhKepalaSignatureAction } from './actions'

function signature() {
  const form = new FormData()
  form.set('signature', new File(['image'], 'signature.png', { type: 'image/png' }))
  return form
}

beforeEach(() => {
  vi.clearAllMocks()
  state.user = { id: 'admin' }
  state.roles = ['admin_tu']
  state.access = true
  state.upload.mockResolvedValue({ url: '/kepala.png' })
  state.getSetting.mockResolvedValue('/kepala.png')
  state.remove.mockResolvedValue(null)
})

describe('Shared CKH kepala signature file authorization', () => {
  it.each(['admin_tu', 'super_admin'])('allows %s to use the existing shared file', async role => {
    state.roles = [role]
    expect((await uploadCkhKepalaSignatureAction(signature())).url).toMatch(/^\/kepala.png\?v=/)
    expect(state.setSetting).toHaveBeenCalledWith('ckh_kepala_signature_url', expect.stringContaining('/kepala.png'))
    expect((await deleteCkhKepalaSignatureAction()).success).toBeTruthy()
    expect(state.remove).toHaveBeenCalledWith('/kepala.png')
  })

  it.each([['guru'], ['kepsek'], ['operator'], ['play_reviewer', 'super_admin']])('denies roles %j before touching storage', async (...roles) => {
    state.roles = roles
    expect((await uploadCkhKepalaSignatureAction(signature())).error).toBeTruthy()
    expect((await deleteCkhKepalaSignatureAction()).error).toBeTruthy()
    expect(state.upload).not.toHaveBeenCalled()
    expect(state.remove).not.toHaveBeenCalled()
    expect(state.setSetting).not.toHaveBeenCalled()
  })

  it('denies TU when Dokumen TPG access is revoked', async () => {
    state.access = false
    expect((await uploadCkhKepalaSignatureAction(signature())).error).toBeTruthy()
    expect((await deleteCkhKepalaSignatureAction()).error).toBeTruthy()
    expect(state.upload).not.toHaveBeenCalled()
    expect(state.remove).not.toHaveBeenCalled()
  })

  it('requires authentication before touching storage', async () => {
    state.user = null
    expect((await uploadCkhKepalaSignatureAction(signature())).error).toBe('Unauthorized')
    expect((await deleteCkhKepalaSignatureAction()).error).toBe('Unauthorized')
    expect(state.upload).not.toHaveBeenCalled()
    expect(state.remove).not.toHaveBeenCalled()
  })
})
