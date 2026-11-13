import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canCoverWaliClass, getReplacementSessionEnd, readReplacementScopes, readTeacherPeriods } from './teacher-leave-period'
import { summarizeTeacherAttendance, type TeacherAttendanceItem } from './teacher-attendance-core'
import { resolveTeachingAssignmentAccess } from './guru-ppl-access'

let sqlite: DatabaseSync
const migration = readFileSync(new URL('../migrations/0126_teacher_leave_periods.sql', import.meta.url), 'utf8')

function db() {
  return {
    prepare(sql: string) {
      let args: string[] = []
      const statement = {
        bind(...values: string[]) { args = values; return statement },
        async all() { return { results: sqlite.prepare(sql).all(...args) } },
        async first() { return sqlite.prepare(sql).get(...args) || null },
      }
      return statement
    },
  } as unknown as D1Database
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`CREATE TABLE "user" (id TEXT PRIMARY KEY, nama_lengkap TEXT, banned INTEGER DEFAULT 0, role TEXT DEFAULT 'guru');
    CREATE TABLE agenda_guru (id TEXT PRIMARY KEY, status TEXT);
    CREATE TABLE user_roles (user_id TEXT, role TEXT);
    CREATE TABLE tahun_ajaran (id TEXT PRIMARY KEY, is_active INTEGER);
    CREATE TABLE penugasan_mengajar (id TEXT PRIMARY KEY, guru_id TEXT, kelas_id TEXT, tahun_ajaran_id TEXT);
    CREATE TABLE kelas (id TEXT PRIMARY KEY, wali_kelas_id TEXT);
    CREATE TABLE guru_ppl_mapping (guru_ppl_id TEXT, guru_utama_id TEXT, penugasan_mengajar_id TEXT, berlaku_selesai TEXT);
    INSERT INTO "user" (id, nama_lengkap) VALUES ('guru', 'Guru'), ('ganti', 'Pengganti'), ('baru', 'Pengganti Baru');
    INSERT INTO agenda_guru VALUES ('lama', 'TEPAT_WAKTU');`)
  sqlite.exec(migration)
})
afterEach(() => {
  vi.useRealTimers()
  sqlite.close()
})

describe('periode cuti guru', () => {
  it('mencegah tumpang tindih inklusif dan mempertahankan agenda lama', () => {
    sqlite.exec("INSERT INTO cuti_guru (id,guru_id,mulai,selesai) VALUES ('c','guru','2026-11-01','2026-11-15')")
    expect(() => sqlite.exec("INSERT INTO cuti_guru (id,guru_id,mulai,selesai) VALUES ('d','guru','2026-11-15','2026-11-20')")).toThrow('CUTI_OVERLAP')
    sqlite.exec("INSERT INTO cuti_guru (id,guru_id,mulai,selesai) VALUES ('e','guru','2026-11-16','2026-11-20')")
    expect(sqlite.prepare("SELECT status FROM agenda_guru WHERE id = 'lama'").get()?.status).toBe('TEPAT_WAKTU')
  })

  it('menolak guru cuti sebagai pengganti dalam kedua urutan pencatatan', () => {
    sqlite.exec("INSERT INTO cuti_guru (id,guru_id,mulai,selesai) VALUES ('c','guru','2026-11-01','2026-11-15'), ('d','baru','2026-11-14','2026-11-15')")
    expect(() => sqlite.exec("INSERT INTO cuti_guru_pengganti VALUES ('p','c','baru','2026-11-13','2026-11-15')")).toThrow('CUTI_REPLACEMENT_UNAVAILABLE')
    expect(() => sqlite.exec("INSERT INTO cuti_guru_pengganti VALUES ('p','c','guru','2026-11-13','2026-11-15')")).toThrow('CUTI_REPLACEMENT_UNAVAILABLE')
    sqlite.exec("INSERT INTO cuti_guru_pengganti VALUES ('p','c','ganti','2026-11-13','2026-11-15')")
    expect(() => sqlite.exec("INSERT INTO cuti_guru (id,guru_id,mulai,selesai) VALUES ('e','ganti','2026-11-15','2026-11-16')")).toThrow('CUTI_REPLACEMENT_UNAVAILABLE')
  })

  it('memisahkan cuti berlaku surut dari akses pengganti dan menutup sesi pada tengah malam WIB', async () => {
    sqlite.exec("INSERT INTO cuti_guru (id,guru_id,mulai,selesai) VALUES ('c','guru','2026-11-01','2026-11-15')")
    sqlite.exec("INSERT INTO cuti_guru_pengganti VALUES ('p','c','ganti','2026-11-13','2026-11-15')")
    expect((await readTeacherPeriods(db(), '2026-11-01'))[0].pengganti_id).toBeNull()
    expect(await readReplacementScopes(db(), 'ganti', '2026-11-12', '2026-11-13')).toEqual([])
    expect(await readReplacementScopes(db(), 'ganti', '2026-11-15', '2026-11-13')).toHaveLength(1)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-15T16:59:59Z'))
    expect(await getReplacementSessionEnd(db(), 'ganti')).toBe('2026-11-15T17:00:00.000Z')
    vi.setSystemTime(new Date('2026-11-15T17:00:00Z'))
    expect(await getReplacementSessionEnd(db(), 'ganti')).toBeNull()
  })

  it('mencabut akses saat pengganti berganti atau cuti dibatalkan', async () => {
    sqlite.exec("INSERT INTO cuti_guru (id,guru_id,mulai,selesai) VALUES ('c','guru','2026-11-01','2026-11-15')")
    sqlite.exec("INSERT INTO cuti_guru_pengganti VALUES ('p','c','ganti','2026-11-10','2026-11-15')")
    sqlite.exec("UPDATE cuti_guru_pengganti SET selesai = '2026-11-12' WHERE id = 'p'; INSERT INTO cuti_guru_pengganti VALUES ('p2','c','baru','2026-11-13','2026-11-15')")
    expect((await readTeacherPeriods(db(), '2026-11-12'))[0].pengganti_id).toBe('ganti')
    expect(await readReplacementScopes(db(), 'ganti', '2026-11-12', '2026-11-13')).toEqual([])
    expect(await readReplacementScopes(db(), 'baru', '2026-11-13', '2026-11-13')).toHaveLength(1)
    sqlite.exec("UPDATE cuti_guru SET dibatalkan = 1 WHERE id = 'c'")
    expect(await readReplacementScopes(db(), 'baru', '2026-11-13', '2026-11-13')).toEqual([])
  })

  it('membatasi akses pada penugasan, kelas, dan tanggal pengganti serta mendahulukannya dari PPL', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-13T08:00:00+07:00'))
    sqlite.exec(`INSERT INTO cuti_guru (id,guru_id,mulai,selesai) VALUES ('c','guru','2026-11-10','2026-11-15');
      INSERT INTO cuti_guru_pengganti VALUES ('p','c','ganti','2026-11-13','2026-11-15');
      INSERT INTO tahun_ajaran VALUES ('aktif',1), ('lama',0);
      INSERT INTO kelas VALUES ('kelas','guru'), ('lain','baru');
      INSERT INTO penugasan_mengajar VALUES ('mengajar','guru','kelas','aktif'), ('mapel-lain','baru','kelas','aktif'), ('semester-lama','guru','kelas','lama');
      UPDATE "user" SET role = 'guru_ppl' WHERE id = 'baru';
      INSERT INTO guru_ppl_mapping VALUES ('baru','guru','mengajar',NULL);`)
    await expect(resolveTeachingAssignmentAccess(db(), 'ganti', 'mengajar')).resolves.toMatchObject({ actorKind: 'PENGGANTI', guruUtamaId: 'guru' })
    await expect(resolveTeachingAssignmentAccess(db(), 'guru', 'mengajar')).resolves.toMatchObject({ actorKind: 'GURU', ownerOnLeave: true })
    await expect(resolveTeachingAssignmentAccess(db(), 'ganti', 'mengajar', '2026-11-12')).resolves.toBeNull()
    await expect(resolveTeachingAssignmentAccess(db(), 'ganti', 'mapel-lain')).resolves.toBeNull()
    await expect(resolveTeachingAssignmentAccess(db(), 'ganti', 'semester-lama')).resolves.toBeNull()
    await expect(resolveTeachingAssignmentAccess(db(), 'baru', 'mengajar')).resolves.toBeNull()
    await expect(canCoverWaliClass(db(), 'ganti', 'kelas')).resolves.toBe(true)
    await expect(canCoverWaliClass(db(), 'ganti', 'lain')).resolves.toBe(false)
    await expect(canCoverWaliClass(db(), 'ganti', 'kelas', '2026-11-12')).resolves.toBe(false)
  })

  it('mengeluarkan cuti dari total dan penyebut kehadiran guru', () => {
    const result = summarizeTeacherAttendance([{ status: 'CUTI' }, { status: 'TEPAT_WAKTU' }] as TeacherAttendanceItem[])
    expect(result).toMatchObject({ total: 1, hadir: 1, alfa: 0 })
  })
})
