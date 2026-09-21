import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'

const state = vi.hoisted(() => ({ db: null as unknown as D1Database, roles: ['super_admin'] }))
vi.mock('server-only', () => ({}))
vi.mock('@/utils/db-server', () => ({ getDB: async () => state.db }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: { DB: state.db } }) }))
vi.mock('@/utils/auth/server', () => ({
  getAppSession: async () => ({ kind: 'staff', user: { id: 'admin' }, session: { id: 'session' } }),
  getCurrentUser: async () => ({ id: 'admin', role: state.roles[0] }),
}))
vi.mock('@/lib/features', () => ({
  getUserRoles: async () => state.roles,
  checkFeatureCrudAccess: async () => true,
}))
vi.mock('@/lib/activity-log', () => ({ logActivity: vi.fn(async () => 'log') }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { reviewForgottenAgendaRequest } from './actions'

describe('forgotten agenda review actions', () => {
  let sqlite: DatabaseSync

  function adapter(): D1Database {
    const prepare = (sql: string) => {
      let args: Array<string | number | null> = []
      const statement = {
        bind(...values: Array<string | number | null>) { args = values; return statement },
        async all() { return { results: sqlite.prepare(sql).all(...args), success: true } },
        async first<T>() { return (sqlite.prepare(sql).get(...args) || null) as T | null },
        async run() {
          const result = sqlite.prepare(sql).run(...args)
          return { success: true, meta: { changes: Number(result.changes) } }
        },
      }
      return statement
    }
    return {
      prepare,
      async batch(statements: Array<ReturnType<typeof prepare>>) {
        sqlite.exec('BEGIN')
        try {
          const results = []
          for (const statement of statements) results.push(await statement.run())
          sqlite.exec('COMMIT')
          return results
        } catch (error) {
          sqlite.exec('ROLLBACK')
          throw error
        }
      },
    } as unknown as D1Database
  }

  beforeEach(() => {
    state.roles = ['super_admin']
    sqlite = new DatabaseSync(':memory:')
    sqlite.exec(`PRAGMA foreign_keys = ON;
      CREATE TABLE "user" (id TEXT PRIMARY KEY, nama_lengkap TEXT, jabatan_struktural_id TEXT);
      CREATE TABLE mata_pelajaran (id TEXT PRIMARY KEY, nama_mapel TEXT);
      CREATE TABLE kelas (id TEXT PRIMARY KEY, tingkat INTEGER, nomor_kelas INTEGER, kelompok TEXT);
      CREATE TABLE penugasan_mengajar (id TEXT PRIMARY KEY, guru_id TEXT, mapel_id TEXT, kelas_id TEXT);
      CREATE TABLE agenda_guru (
        id TEXT PRIMARY KEY, guru_id TEXT, penugasan_id TEXT, tanggal TEXT,
        jam_ke_mulai INTEGER, jam_ke_selesai INTEGER, materi TEXT, foto_url TEXT,
        status TEXT, waktu_input TEXT, catatan_admin TEXT, diubah_oleh TEXT,
        created_at TEXT, updated_at TEXT, UNIQUE(penugasan_id, tanggal)
      );
      CREATE TABLE agenda_lupa_pengajuan (
        id TEXT PRIMARY KEY, guru_id TEXT, penugasan_id TEXT, tanggal TEXT,
        jam_ke_mulai INTEGER, jam_ke_selesai INTEGER, materi TEXT, status TEXT,
        submitted_at TEXT, reviewed_by TEXT, reviewed_at TEXT, review_note TEXT,
        agenda_id TEXT, updated_at TEXT
      );
      INSERT INTO "user" VALUES ('admin','Admin',NULL), ('guru','Guru Satu',NULL);
      INSERT INTO mata_pelajaran VALUES ('mapel','Matematika');
      INSERT INTO kelas VALUES ('kelas',10,1,'A');
      INSERT INTO penugasan_mengajar VALUES ('p1','guru','mapel','kelas');`)
    state.db = adapter()
  })

  afterEach(() => sqlite.close())

  function insertRequest(id = 'req') {
    sqlite.prepare(`INSERT INTO agenda_lupa_pengajuan
      (id,guru_id,penugasan_id,tanggal,jam_ke_mulai,jam_ke_selesai,materi,status,submitted_at,updated_at)
      VALUES (?, 'guru','p1','2026-09-21',1,2,'Persamaan kuadrat','PENDING','2026-09-21T09:00:00+07:00','2026-09-21T09:00:00+07:00')`).run(id)
  }

  it('approves atomically into one late agenda without a photo', async () => {
    insertRequest()
    const result = await reviewForgottenAgendaRequest('req', 'APPROVE', 'Dikonfirmasi')
    expect(result.error).toBeUndefined()
    expect(sqlite.prepare('SELECT materi, foto_url, status, waktu_input FROM agenda_guru').get()).toEqual({
      materi: 'Persamaan kuadrat',
      foto_url: null,
      status: 'TELAT',
      waktu_input: '2026-09-21T09:00:00+07:00',
    })
    const request = sqlite.prepare('SELECT status, agenda_id, review_note FROM agenda_lupa_pengajuan').get() as any
    expect(request.status).toBe('APPROVED')
    expect(request.agenda_id).toBeTruthy()
    expect(request.review_note).toBe('Dikonfirmasi')
    expect((await reviewForgottenAgendaRequest('req', 'APPROVE')).error).toContain('sudah ditinjau')
  })

  it('rejects without creating an agenda and keeps the note optional', async () => {
    insertRequest()
    const result = await reviewForgottenAgendaRequest('req', 'REJECT')
    expect(result.error).toBeUndefined()
    expect(sqlite.prepare('SELECT status, review_note FROM agenda_lupa_pengajuan').get()).toEqual({ status: 'REJECTED', review_note: null })
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM agenda_guru').get()).toEqual({ total: 0 })
  })

  it('cancels a pending request when another agenda already exists', async () => {
    insertRequest()
    sqlite.prepare(`INSERT INTO agenda_guru
      (id,guru_id,penugasan_id,tanggal,jam_ke_mulai,jam_ke_selesai,materi,status)
      VALUES ('manual','guru','p1','2026-09-21',1,2,'Manual','TELAT')`).run()
    const result = await reviewForgottenAgendaRequest('req', 'APPROVE')
    expect(result.success).toContain('dibatalkan')
    expect(sqlite.prepare('SELECT status FROM agenda_lupa_pengajuan').get()).toEqual({ status: 'CANCELLED' })
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM agenda_guru').get()).toEqual({ total: 1 })
  })
})
