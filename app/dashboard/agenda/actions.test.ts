import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  existing: null as { id: string; status: string } | null,
  insert: vi.fn(), upload: vi.fn(), access: true,
}))
vi.mock('@/utils/db', () => ({ dbInsert: state.insert, dbUpdate: vi.fn() }))
vi.mock('@/utils/db-server', () => ({ getDB: async () => ({
  prepare: (sql: string) => {
    const statement = {
      bind: () => statement,
      first: async () => sql.includes('FROM agenda_guru') ? state.existing
        : sql.includes('FROM penugasan_mengajar') ? { kelas_id: 'k1', tingkat: 10, tahun_ajaran_id: 'ta', jam_pelajaran: JSON.stringify([{ hari: [5], slots: [{ id: 1, mulai: '08:00', selesai: '08:45' }] }]) } : null,
      all: async () => ({ results: [{ jam_ke: 1 }] }),
    }
    return statement
  },
}) }))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: async () => ({ id: 'guru', name: 'Guru' }) }))
vi.mock('@/lib/action-security', () => ({ requireActionAccess: vi.fn() }))
vi.mock('@/lib/act-as', () => ({ getEffectiveUser: async () => null, getActAsDate: vi.fn() }))
vi.mock('@/lib/activity-log', () => ({ logActivity: async () => 'log1' }))
vi.mock('@/lib/agenda-access-audit', () => ({ getAgendaAccessBlock: async () => null, recordAgendaAccessAudit: vi.fn() }))
vi.mock('@/lib/guru-ppl-access', () => ({ resolveTeachingAssignmentAccess: async () => state.access ? { guruUtamaId: 'guru', actorKind: 'GURU' } : null }))
vi.mock('@/lib/kalender-pendidikan', () => ({
  getKalenderDateStatus: async () => ({ isEffective: true }), getKbmExceptionsForDate: async () => [],
  splitTeachingSlotsByExceptions: () => ({ activeJamKe: [1], exceptionSegments: [] }),
}))
vi.mock('@/lib/system-settings', () => ({ SYSTEM_SETTING_KEYS: {}, getSystemSetting: async () => '{}', getSystemSettingBoolean: async () => true, getSystemSettingNumber: async () => 10 }))
vi.mock('@/utils/r2', () => ({ uploadToR2: state.upload }))
vi.mock('@/lib/time', () => ({ todayWIB: () => '2026-10-02', currentTimeWIB: () => ({ hhmm: '08:05' }), nowWIBISO: () => '2026-10-02T08:05:00+07:00', nowWIB: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { submitAgenda } from './actions'

describe('agenda persisted acknowledgment and retries', () => {
  const form = (photo = true) => {
    const data = new FormData()
    for (const [key, value] of Object.entries({ penugasan_id: 'p1', materi: 'Aljabar', tanggal: '2026-10-02', jam_ke_mulai: '1', jam_ke_selesai: '1', slot_mulai: '08:00', slot_selesai: '08:45' })) data.set(key, value)
    if (photo) data.set('foto', new File(['photo'], 'foto.webp', { type: 'image/webp' }))
    return data
  }
  beforeEach(() => {
    vi.clearAllMocks()
    state.existing = null
    state.access = true
    state.insert.mockResolvedValue({ data: { id: 'ag1' }, error: null })
    state.upload.mockResolvedValue({ url: '/api/media/agenda/foto.webp', error: null })
  })

  it('does not report success without an INSERT returning a saved row', async () => {
    state.insert.mockResolvedValue({ success: true, error: null })
    expect((await submitAgenda(form())).error).toContain('belum mengonfirmasi')
  })
  it('returns saved identity and status', async () => {
    expect((await submitAgenda(form())).agenda).toEqual({ id: 'ag1', status: 'TEPAT_WAKTU' })
    expect(state.upload).toHaveBeenCalledWith(expect.any(File), 'agenda', expect.stringMatching(/\.webp$/))
  })
  it('retries acknowledge the existing row without uploading or inserting again', async () => {
    state.existing = { id: 'ag1', status: 'TELAT' }
    expect((await submitAgenda(form(false))).agenda).toEqual(state.existing)
    expect(state.upload).not.toHaveBeenCalled()
    expect(state.insert).not.toHaveBeenCalled()
  })
  it('denies access before acknowledging an existing agenda', async () => {
    state.existing = { id: 'ag1', status: 'TELAT' }
    state.access = false
    expect((await submitAgenda(form())).error).toContain('tidak memiliki akses')
  })
  it('rejects absent photos and upload failures without persisting an agenda', async () => {
    expect((await submitAgenda(form(false))).error).toContain('Foto kegiatan wajib')
    state.upload.mockResolvedValue({ error: 'Koneksi penyimpanan terputus', url: null })
    expect((await submitAgenda(form())).error).toContain('Gagal upload foto')
    expect(state.insert).not.toHaveBeenCalled()
  })
  it('recognizes a simultaneous retry that loses the unique-key race', async () => {
    state.insert.mockImplementation(async () => {
      state.existing = { id: 'ag1', status: 'TELAT' }
      return { error: 'UNIQUE constraint failed' }
    })
    expect((await submitAgenda(form())).agenda).toEqual({ id: 'ag1', status: 'TELAT' })
  })
})
