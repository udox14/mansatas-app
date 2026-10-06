import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ writes: vi.fn(), audit: vi.fn(), guard: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: async () => ({ id: 'admin' }) }))
vi.mock('@/lib/action-security', () => ({ requireActionAccess: state.guard }))
vi.mock('@/lib/kalender-pendidikan', () => ({ ensureKalenderPendidikanTables: vi.fn() }))
vi.mock('@/lib/activity-log', () => ({ logActivity: state.audit, createActivityDiff: vi.fn() }))
vi.mock('@/utils/db-server', () => ({
  getDB: async () => ({
    prepare: (sql: string) => {
      let values: unknown[] = []
      const statement = {
        bind: (...args: unknown[]) => { values = args; return statement },
        all: async () => ({ results: [{ id: 'kelas-a' }, { id: 'kelas-b' }] }),
        first: async () => ({ id: 'exception-1', target_type: 'KELAS', target_value: 'kelas-a' }),
        run: async () => { state.writes(sql, values); return { success: true } },
      }
      return statement
    },
  }),
}))

import { saveKbmException } from './actions'

const payload = {
  tanggal: '2026-10-06', judul: 'Pembinaan', kategori: 'KEGIATAN_MADRASAH' as const,
  jam_ke_mulai: 2, jam_ke_selesai: 3, target_type: 'KELAS' as const,
  target_values: ['kelas-a', 'kelas-b'],
}

beforeEach(() => vi.clearAllMocks())

describe('save KBM exception class targets', () => {
  it('stores multiple classes in one record and logs the normalized target', async () => {
    expect((await saveKbmException({ ...payload, target_values: ['kelas-a', 'kelas-b', 'kelas-a'] })).success).toBeTruthy()
    expect(state.writes).toHaveBeenCalledTimes(1)
    expect(state.writes.mock.calls[0][1][6]).toBe('["kelas-a","kelas-b"]')
    expect(state.guard).toHaveBeenCalledWith('kalender-pendidikan', 'read')
    expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({ after: expect.objectContaining({ target_value: '["kelas-a","kelas-b"]' }) }))
  })

  it('updates the existing exception and supports removing a selected class', async () => {
    expect((await saveKbmException({ ...payload, id: 'exception-1', target_values: ['kelas-b'] })).success).toBeTruthy()
    expect(state.writes).toHaveBeenCalledTimes(1)
    const [sql, values] = state.writes.mock.calls[0]
    expect(sql).toContain('UPDATE kbm_exceptions')
    expect(values[6]).toBe('kelas-b')
    expect(values.at(-1)).toBe('exception-1')
  })

  it('accepts legacy single-class payloads', async () => {
    expect((await saveKbmException({ ...payload, target_values: undefined, target_value: 'kelas-a' })).success).toBeTruthy()
    expect(state.writes.mock.calls[0][1][6]).toBe('kelas-a')
  })

  it.each([[], ['kelas-a', 'missing'], ['']].map(target_values => ({ target_values })))('rejects invalid targets $target_values without saving', async ({ target_values }) => {
    expect((await saveKbmException({ ...payload, target_values })).error).toBeTruthy()
    expect(state.writes).not.toHaveBeenCalled()
    expect(state.audit).not.toHaveBeenCalled()
  })
})
