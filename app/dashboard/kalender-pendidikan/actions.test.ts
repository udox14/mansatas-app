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

import { saveKbmException, saveKalenderEvent } from './actions'

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

const eventPayload = {
  start_date: '2026-10-05',
  end_date: '2026-10-08',
  title: 'Libur kelas 12',
  category: 'LIBUR_SEMESTER' as const,
  is_effective: false,
}

describe('save calendar event targets', () => {
  it('menyimpan libur untuk beberapa tingkat dalam satu event', async () => {
    expect((await saveKalenderEvent({ ...eventPayload, target_type: 'TINGKAT', target_values: ['12', '10', '12'] })).success).toBeTruthy()
    expect(state.writes).toHaveBeenCalledTimes(1)
    const [sql, values] = state.writes.mock.calls[0]
    expect(sql).toContain('INSERT INTO kalender_pendidikan_events')
    expect(values[6]).toBe('TINGKAT')
    expect(values[7]).toBe('["10","12"]')
  })

  it('menyimpan sasaran semua siswa tanpa target_value', async () => {
    expect((await saveKalenderEvent({ ...eventPayload, target_type: 'ALL' })).success).toBeTruthy()
    const [, values] = state.writes.mock.calls[0]
    expect(values[6]).toBe('ALL')
    expect(values[7]).toBeNull()
  })

  it('menolak hari efektif dengan sasaran tingkat/kelas', async () => {
    const result = await saveKalenderEvent({
      ...eventPayload,
      is_effective: true,
      target_type: 'TINGKAT',
      target_values: ['12'],
    })
    expect(result.error).toBeTruthy()
    expect(state.writes).not.toHaveBeenCalled()
  })

  it('menolak target tingkat atau kelas yang kosong', async () => {
    expect((await saveKalenderEvent({ ...eventPayload, target_type: 'TINGKAT', target_values: [] })).error).toBeTruthy()
    expect((await saveKalenderEvent({ ...eventPayload, target_type: 'KELAS', target_values: [] })).error).toBeTruthy()
    expect((await saveKalenderEvent({ ...eventPayload, target_type: 'KELAS', target_values: ['missing'] })).error).toBeTruthy()
    expect(state.writes).not.toHaveBeenCalled()
  })
})
