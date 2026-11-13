import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ roles: ['super_admin'], database: null as D1Database | null }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/db-server', () => ({ getDB: async () => state.database }))
vi.mock('@/utils/auth/server', () => ({
  getCurrentUser: async () => ({ id: 'admin' }),
  isCurrentUserPlayReviewer: async () => state.roles.includes('play_reviewer'),
}))
vi.mock('@/lib/schema-guard', () => ({ ensureSchemaOnce: vi.fn(async () => undefined) }))
vi.mock('@/lib/activity-log', () => ({ ensureActivityLogTables: vi.fn(), logActivity: vi.fn(async () => null) }))
vi.mock('@/lib/action-security', () => {
  class ActionAccessError extends Error {}
  return {
    ActionAccessError,
    requireActionAccess: vi.fn(async (_feature, _action, options?: { allowedRoles: string[] }) => {
      if (options && !options.allowedRoles.some(role => state.roles.includes(role))) throw new ActionAccessError()
      return { kind: 'staff', id: 'admin', roles: state.roles, sessionId: 'admin-session' }
    }),
  }
})

import { batchDeactivatePplAccounts, createPplMappings, getDaftarGuruPPLWithSummary, getPplAttendance } from './actions'
import { createAuth } from '@/utils/auth'
import { resolveTeachingAssignmentAccess } from '@/lib/guru-ppl-access'
import { hapusPegawai } from '../guru/actions'

let sqlite: DatabaseSync
type SqlValue = string | number | null

function asD1(database: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    let bindings: SqlValue[] = []
    const execute = () => {
      const statement = database.prepare(sql)
      const results = statement.columns().length ? statement.all(...bindings) : []
      const changes = results.length || (statement.columns().length ? 0 : Number(statement.run(...bindings).changes))
      return { success: true, results, meta: { changes } }
    }
    const prepared = {
      bind(...values: SqlValue[]) { bindings = values; return prepared },
      async first() { return database.prepare(sql).get(...bindings) ?? null },
      async all() { return execute() },
      async run() { return execute() },
      execute,
    }
    return prepared
  }
  return {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      database.exec('BEGIN')
      try {
        const results = statements.map(statement => statement.execute())
        database.exec('COMMIT')
        return results
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    },
  } as unknown as D1Database
}

beforeEach(() => {
  state.roles = ['super_admin']
  sqlite = new DatabaseSync(':memory:')
  state.database = asD1(sqlite)
  const base = readFileSync('migrations/schema.sql', 'utf8')
  sqlite.exec(base.slice(base.indexOf('CREATE TABLE IF NOT EXISTS "user"'), base.indexOf('CREATE TABLE IF NOT EXISTS verification')))
  sqlite.exec(readFileSync('migrations/schema-migration-feature-management.sql', 'utf8'))
  sqlite.exec(readFileSync('migrations/schema-migration-master-roles.sql', 'utf8'))
  sqlite.exec(readFileSync('migrations/0042_add_role_feature_permissions.sql', 'utf8'))
  sqlite.exec(readFileSync('migrations/0064_add_activity_logs.sql', 'utf8'))
  sqlite.exec(`
    CREATE TABLE kalender_pendidikan_events (
      id TEXT, start_date TEXT, end_date TEXT, title TEXT, category TEXT, is_effective INTEGER,
      source TEXT, external_id TEXT, description TEXT, target_type TEXT, target_value TEXT
    );
    CREATE TABLE kbm_exceptions (
      id TEXT, tanggal TEXT, judul TEXT, kategori TEXT, jam_ke_mulai INTEGER, jam_ke_selesai INTEGER,
      target_type TEXT, target_value TEXT, description TEXT
    );
    CREATE TABLE mata_pelajaran (id TEXT PRIMARY KEY, nama_mapel TEXT);
    CREATE TABLE kelas (id TEXT PRIMARY KEY, tingkat INTEGER, nomor_kelas INTEGER, kelompok TEXT, kbm_nonaktif_mulai TEXT);
    CREATE TABLE penugasan_mengajar (id TEXT PRIMARY KEY, mapel_id TEXT, kelas_id TEXT, guru_id TEXT, tahun_ajaran_id TEXT);
    CREATE TABLE tahun_ajaran (id TEXT, is_active INTEGER, jam_pelajaran TEXT);
    CREATE TABLE jadwal_mengajar (penugasan_id TEXT, hari INTEGER, jam_ke INTEGER);
    CREATE TABLE system_settings (key TEXT, value TEXT);
    CREATE TABLE guru_ppl_kampus (id TEXT, nama TEXT, singkatan TEXT);
    CREATE TABLE guru_ppl_profile (user_id TEXT, kampus_id TEXT);
    CREATE TABLE guru_ppl_mapping (
      id TEXT PRIMARY KEY, guru_ppl_id TEXT REFERENCES "user"(id) ON DELETE CASCADE,
      guru_utama_id TEXT, penugasan_mengajar_id TEXT, berlaku_mulai TEXT, berlaku_selesai TEXT,
      jadwal_snapshot TEXT, updated_at TEXT
    );
    CREATE TABLE agenda_guru (
      id TEXT, penugasan_id TEXT, guru_id TEXT, ppl_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      tanggal TEXT, status TEXT
    );
    CREATE TABLE guru_ppl_kehadiran_override (
      mapping_id TEXT REFERENCES guru_ppl_mapping(id) ON DELETE CASCADE, tanggal TEXT, status TEXT, diubah_oleh TEXT
    );
    CREATE TABLE absensi_sesi_guru (diinput_oleh TEXT REFERENCES "user"(id), tanggal TEXT);
    CREATE TABLE catatan_siswa (pencatat_id TEXT REFERENCES "user"(id) ON DELETE SET NULL, isi TEXT);
    CREATE TABLE nilai_harian_header (diinput_oleh TEXT REFERENCES "user"(id) ON DELETE SET NULL, judul TEXT);
    INSERT INTO "user" (id, name, email, role, nama_lengkap) VALUES
      ('admin', 'Admin', 'admin@example.test', 'super_admin', 'Admin'),
      ('guru', 'Guru', 'guru@example.test', 'guru', 'Guru Utama'),
      ('ppl', 'PPL', 'ppl@example.test', 'guru_ppl', 'Ayu PPL'),
      ('ppl-page-2', 'PPL 2', 'ppl2@example.test', 'guru_ppl', 'Budi PPL'),
      ('other', 'Other', 'other@example.test', 'guru_ppl', 'Cici PPL'),
      ('multi', 'Multi', 'multi@example.test', 'guru_ppl', 'Dani PPL'),
      ('secondary', 'Secondary', 'secondary@example.test', 'guru', 'Eka PPL');
    INSERT INTO user_roles VALUES ('multi', 'guru_ppl'), ('multi', 'wali_kelas'), ('secondary', 'guru_ppl');
    INSERT INTO session (id, token, userId, expiresAt) VALUES
      ('ppl-session', 'ppl-token', 'ppl', '2999-12-31'),
      ('ppl-session-2', 'ppl-token-2', 'ppl', '2999-12-31'),
      ('other-session', 'other-token', 'other', '2999-12-31');
    INSERT INTO account (id, accountId, providerId, userId) VALUES ('ppl-account', 'ppl', 'credential', 'ppl');
    INSERT INTO mata_pelajaran VALUES ('mat', 'Matematika');
    INSERT INTO kelas VALUES ('kelas', 10, 1, 'UMUM', NULL);
    INSERT INTO penugasan_mengajar VALUES ('tugas', 'mat', 'kelas', 'guru', 'ta');
    INSERT INTO tahun_ajaran VALUES ('ta', 1, '[{"hari":[1],"slots":[{"id":1,"selesai":"09:00"}]}]');
    INSERT INTO jadwal_mengajar VALUES ('tugas', 1, 1);
    INSERT INTO guru_ppl_mapping VALUES
      ('mapping', 'ppl', 'guru', 'tugas', '2025-09-01', NULL, '[{"hari":1,"jamKe":1}]', NULL),
      ('old-mapping', 'ppl', 'guru', 'tugas', '2025-08-01', '2025-08-30', NULL, NULL);
    INSERT INTO agenda_guru VALUES ('agenda', 'tugas', 'guru', 'ppl', '2025-09-08', 'TEPAT_WAKTU');
    INSERT INTO guru_ppl_kehadiran_override VALUES ('mapping', '2025-09-15', 'HADIR', 'admin');
    INSERT INTO absensi_sesi_guru VALUES ('ppl', '2025-09-08');
    INSERT INTO catatan_siswa VALUES ('ppl', 'Catatan lama');
    INSERT INTO nilai_harian_header VALUES ('ppl', 'Nilai lama');
  `)
})

afterEach(() => sqlite.close())

const lastDay = '2025-09-15'
const disable = (...userIds: string[]) => batchDeactivatePplAccounts({ userIds, lastDay })
const snapshot = () => [
  'agenda_guru', 'guru_ppl_kehadiran_override', 'absensi_sesi_guru', 'catatan_siswa', 'nilai_harian_header', 'account', 'user_roles',
].map(table => sqlite.prepare(`SELECT * FROM ${table}`).all())
const accountStatus = (id: string) => sqlite.prepare('SELECT banned FROM "user" WHERE id = ?').get(id)?.banned
const activityCount = () => sqlite.prepare('SELECT COUNT(*) AS count FROM activity_logs').get()?.count
const headersFor = (token: string) => new Headers({ cookie: `session_token=${token}` })

describe('penonaktifan akun PPL', () => {
  it('menutup akun yang dipilih, mencabut semua sesi, dan mempertahankan riwayat serta log', async () => {
    const before = snapshot()
    const reportFilter = { start: '2025-09-01', end: lastDay, pplUserId: 'ppl' }
    const reportBefore = await getPplAttendance(reportFilter)
    expect(reportBefore.items.map(item => [item.tanggal, item.status])).toEqual([
      ['2025-09-01', 'ALFA'], ['2025-09-08', 'HADIR'], [lastDay, 'HADIR'],
    ])
    const db = state.database!
    const auth = createAuth(db)
    expect((await auth.api.getSession({ headers: headersFor('ppl-token') }))?.user.id).toBe('ppl')
    expect(await disable('ppl', 'ppl-page-2', 'ppl')).toEqual({ success: '2 akun Guru PPL berhasil dinonaktifkan.' })
    expect(accountStatus('ppl')).toBe(1)
    expect(accountStatus('ppl-page-2')).toBe(1)
    expect(accountStatus('other')).toBe(0)
    expect(await auth.api.getSession({ headers: headersFor('ppl-token') })).toBeNull()
    expect(await auth.api.getSession({ headers: headersFor('ppl-token-2') })).toBeNull()
    expect((await auth.api.getSession({ headers: headersFor('other-token') }))?.user.id).toBe('other')
    const login = await auth.api.signInEmail({ body: { email: 'ppl@example.test', password: 'password' }, asResponse: true })
    expect(login).toMatchObject({ status: 403 })
    expect(snapshot()).toEqual(before)
    expect(await getPplAttendance(reportFilter)).toEqual(reportBefore)
    const afterPeriod = await getPplAttendance({ ...reportFilter, start: '2025-09-16', end: '2025-09-29' })
    expect(afterPeriod.items).toEqual([])
    expect(afterPeriod.ppl).toContainEqual(expect.objectContaining({ id: 'ppl' }))
    expect(sqlite.prepare('SELECT id, berlaku_selesai FROM guru_ppl_mapping ORDER BY id').all()).toEqual([
      { id: 'mapping', berlaku_selesai: lastDay },
      { id: 'old-mapping', berlaku_selesai: '2025-08-30' },
    ])
    expect(sqlite.prepare('SELECT actor_user_id, action, after_json FROM activity_logs').get()).toMatchObject({
      actor_user_id: 'admin', action: 'deactivate_ppl', after_json: JSON.stringify({ banned: true, hari_terakhir_ppl: lastDay }),
    })
    expect(sqlite.prepare('SELECT target_id, target_label FROM activity_log_targets ORDER BY target_id').all()).toEqual([
      { target_id: 'ppl', target_label: 'Ayu PPL' }, { target_id: 'ppl-page-2', target_label: 'Budi PPL' },
    ])
    expect(await resolveTeachingAssignmentAccess(db, 'guru', 'tugas', '2025-09-16')).toMatchObject({ actorKind: 'GURU' })
    expect(await resolveTeachingAssignmentAccess(db, 'ppl', 'tugas', '2025-09-16')).toBeNull()
    expect(await getDaftarGuruPPLWithSummary()).toContainEqual(expect.objectContaining({ id: 'ppl', status: 'nonaktif' }))
    expect(await createPplMappings({ pplUserId: 'ppl', dutyIds: ['tugas'] })).toHaveProperty('error')
    expect(await disable('ppl')).toMatchObject({ details: ['Ayu PPL (sudah nonaktif)'] })
    expect(activityCount()).toBe(1)
  })

  it('menolak pilihan yang berisi akun multi-peran, bukan PPL, atau tidak ditemukan', async () => {
    const result = await disable('ppl', 'multi', 'secondary', 'guru', 'missing')
    expect(result.details).toEqual(expect.arrayContaining([
      'Dani PPL (memiliki peran lain)', 'Eka PPL (memiliki peran lain)', 'Guru Utama (bukan Guru PPL)', 'missing (akun tidak ditemukan)',
    ]))
    expect(accountStatus('ppl')).toBe(0)
    expect(activityCount()).toBe(0)
  })

  it('melindungi akun dan riwayat PPL dari Hapus Pegawai', async () => {
    expect(await hapusPegawai('ppl')).toMatchObject({ error: expect.stringContaining('Kelola PPL') })
    expect(await hapusPegawai('secondary')).toMatchObject({ error: expect.stringContaining('Kelola PPL') })
    await disable('ppl')
    sqlite.exec(`UPDATE "user" SET role = 'guru' WHERE id = 'ppl'`)
    expect(await hapusPegawai('ppl')).toMatchObject({ error: expect.stringContaining('Kelola PPL') })
  })

  it('menolak tanggal yang mendahului awal penugasan atau catatan yang sudah tersimpan', async () => {
    const result = await batchDeactivatePplAccounts({ userIds: ['ppl'], lastDay: '2025-08-31' })
    expect(result.details).toEqual([
      'Ayu PPL · Matematika · 10-1 · 2025-09-15 (koreksi kehadiran)',
      'Ayu PPL · Matematika · 10-1 · 2025-09-08 (agenda PPL)',
      'Ayu PPL · Matematika · 10-1 · 2025-09-01 (awal penugasan)',
    ])
    expect(await batchDeactivatePplAccounts({ userIds: ['ppl'], lastDay: '2025-02-30' })).toHaveProperty('error')
    expect(await batchDeactivatePplAccounts({ userIds: ['ppl'], lastDay: '2999-12-31' })).toHaveProperty('error')
    expect(accountStatus('ppl')).toBe(0)
    expect(activityCount()).toBe(0)
  })

  it('membatalkan audit, penonaktifan, dan pencabutan sesi jika penutupan penugasan gagal', async () => {
    sqlite.exec(`CREATE TRIGGER fail_mapping BEFORE UPDATE ON guru_ppl_mapping
      BEGIN SELECT RAISE(ABORT, 'forced failure'); END;`)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await disable('ppl', 'ppl-page-2')).toHaveProperty('error')
    } finally {
      log.mockRestore()
    }
    expect(accountStatus('ppl')).toBe(0)
    expect(accountStatus('ppl-page-2')).toBe(0)
    expect(activityCount()).toBe(0)
    expect(sqlite.prepare('SELECT userId FROM session ORDER BY id').all()).toHaveLength(3)
    expect(sqlite.prepare("SELECT berlaku_selesai FROM guru_ppl_mapping WHERE id = 'mapping'").get()?.berlaku_selesai).toBeNull()
  })

  it.each([['kepsek'], ['wakamad'], ['admin_tu'], ['play_reviewer', 'super_admin']])('menolak penonaktifan oleh %s', async (...roles) => {
    state.roles = roles
    expect(await disable('ppl')).toMatchObject({ error: 'Hanya Super Admin yang dapat menonaktifkan akun PPL.' })
    expect(accountStatus('ppl')).toBe(0)
  })
})
