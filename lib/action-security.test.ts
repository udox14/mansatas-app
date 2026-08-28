import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAppSession: vi.fn(),
  getUserRoles: vi.fn(),
  checkFeatureCrudAccess: vi.fn(),
  db: { prepare: vi.fn() },
}))

vi.mock('@/utils/auth/server', () => ({ getAppSession: mocks.getAppSession }))
vi.mock('@/lib/features', () => ({
  getUserRoles: mocks.getUserRoles,
  checkFeatureCrudAccess: mocks.checkFeatureCrudAccess,
}))
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(async () => ({ env: { DB: mocks.db } })),
}))

import { assertStudentScope, requireActionAccess } from './action-security'

describe('Server Action authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUserRoles.mockResolvedValue(['guru'])
    mocks.checkFeatureCrudAccess.mockResolvedValue(true)
  })

  it('rejects requests without a session', async () => {
    mocks.getAppSession.mockResolvedValue(null)
    await expect(requireActionAccess('bk', 'read')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('requires both CRUD permission and an explicit administrative role', async () => {
    mocks.getAppSession.mockResolvedValue({
      kind: 'staff', user: { id: 'staff-1' }, session: { id: 'session-1' },
    })
    await expect(requireActionAccess('settings', 'update', { allowedRoles: ['super_admin'] }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })

    mocks.getUserRoles.mockResolvedValue(['guru', 'super_admin'])
    await expect(requireActionAccess('settings', 'update', { allowedRoles: ['super_admin'] }))
      .resolves.toMatchObject({ kind: 'staff', id: 'staff-1', roles: ['guru', 'super_admin'] })

    mocks.checkFeatureCrudAccess.mockResolvedValue(false)
    await expect(requireActionAccess('settings', 'update', { allowedRoles: ['super_admin'] }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('accepts access through any explicitly listed feature', async () => {
    mocks.getAppSession.mockResolvedValue({
      kind: 'staff', user: { id: 'staff-1' }, session: { id: 'session-1' },
    })
    mocks.checkFeatureCrudAccess.mockImplementation(
      async (_db, _userId, featureId) => featureId === 'monitoring-kedisiplinan'
    )

    await expect(requireActionAccess(
      ['kedisiplinan', 'monitoring-kedisiplinan'],
      'read'
    )).resolves.toMatchObject({ kind: 'staff', id: 'staff-1' })

    expect(mocks.checkFeatureCrudAccess).toHaveBeenCalledWith(
      mocks.db,
      'staff-1',
      'kedisiplinan',
      'read'
    )
    expect(mocks.checkFeatureCrudAccess).toHaveBeenCalledWith(
      mocks.db,
      'staff-1',
      'monitoring-kedisiplinan',
      'read'
    )
  })

  it('allows a parent only for explicitly enabled reads and scopes them to their child', async () => {
    mocks.getAppSession.mockResolvedValue({
      kind: 'parent', user: { siswa_id: 'student-1' }, session: { id: 'parent-session-1' },
    })
    const actor = await requireActionAccess('portal-ortu', 'read', { allowParent: true })
    await expect(assertStudentScope(actor, 'student-1', 'portal-ortu')).resolves.toBeUndefined()
    await expect(assertStudentScope(actor, 'student-2', 'portal-ortu')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(requireActionAccess('portal-ortu', 'update', { allowParent: true })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
