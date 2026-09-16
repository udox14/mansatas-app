import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { canManageTeachingRecord, resolveTeachingAssignmentAccess } from './guru-ppl-access'

let sqlite: DatabaseSync

function d1(): D1Database {
  return {
    prepare(sql: string) {
      let args: Array<string | number | null> = []
      const statement = {
        bind(...values: Array<string | number | null>) { args = values; return statement },
        async first<T>() { return (sqlite.prepare(sql).get(...args) || null) as T | null },
      }
      return statement
    },
  } as unknown as D1Database
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`
    CREATE TABLE "user" (id TEXT PRIMARY KEY, role TEXT);
    CREATE TABLE user_roles (user_id TEXT, role TEXT);
    CREATE TABLE penugasan_mengajar (id TEXT PRIMARY KEY, guru_id TEXT, kelas_id TEXT, tahun_ajaran_id TEXT);
    CREATE TABLE guru_ppl_mapping (
      guru_ppl_id TEXT, guru_utama_id TEXT, penugasan_mengajar_id TEXT,
      berlaku_mulai TEXT, berlaku_selesai TEXT
    );
    INSERT INTO "user" VALUES ('guru', 'guru'), ('ppl', 'guru_ppl'), ('asing', 'guru_ppl');
    INSERT INTO penugasan_mengajar VALUES ('penugasan', 'guru', 'kelas', 'ta');
    INSERT INTO guru_ppl_mapping VALUES ('ppl', 'guru', 'penugasan', '0001-01-01', NULL);
  `)
})

afterEach(() => sqlite.close())

describe('resolveTeachingAssignmentAccess', () => {
  it('menjaga guru utama sebagai pemilik resmi', async () => {
    await expect(resolveTeachingAssignmentAccess(d1(), 'guru', 'penugasan')).resolves.toMatchObject({
      guruUtamaId: 'guru', actorKind: 'GURU', actorId: 'guru',
    })
  })

  it('memberi PPL akses hanya melalui mapping penugasan', async () => {
    const access = await resolveTeachingAssignmentAccess(d1(), 'ppl', 'penugasan')
    expect(access).toMatchObject({
      guruUtamaId: 'guru', actorKind: 'PPL', actorId: 'ppl',
    })
    expect(canManageTeachingRecord(access!, 'ppl')).toBe(true)
    expect(canManageTeachingRecord(access!, 'guru')).toBe(false)
    await expect(resolveTeachingAssignmentAccess(d1(), 'asing', 'penugasan')).resolves.toBeNull()
  })

  it('membolehkan guru utama mengelola data buatan PPL', async () => {
    const access = await resolveTeachingAssignmentAccess(d1(), 'guru', 'penugasan')
    expect(canManageTeachingRecord(access!, 'ppl')).toBe(true)
  })

  it('mencabut akses mapping lama ketika akun bukan lagi ber-role PPL', async () => {
    sqlite.exec(`UPDATE "user" SET role = 'guru' WHERE id = 'ppl'`)
    await expect(resolveTeachingAssignmentAccess(d1(), 'ppl', 'penugasan')).resolves.toBeNull()
  })

  it('memberi akses tanpa periode selama mapping masih aktif', async () => {
    await expect(resolveTeachingAssignmentAccess(d1(), 'ppl', 'penugasan', '2025-12-31')).resolves.toMatchObject({ actorKind: 'PPL' })
    await expect(resolveTeachingAssignmentAccess(d1(), 'ppl', 'penugasan', '2027-01-01')).resolves.toMatchObject({ actorKind: 'PPL' })
    sqlite.exec(`UPDATE guru_ppl_mapping SET berlaku_selesai = '2026-01-01' WHERE guru_ppl_id = 'ppl'`)
    await expect(resolveTeachingAssignmentAccess(d1(), 'ppl', 'penugasan')).resolves.toBeNull()
  })
})
