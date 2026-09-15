import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { teacherPerformance } from './teacher-leave'
import { summarizeTeacherAttendance, type TeacherAttendanceItem } from './teacher-attendance-core'
import { aggregateTeacherAttendance, type AgendaPrintSession } from '@/app/dashboard/monitoring-agenda/print-summary'

const state = vi.hoisted(() => ({ db: null as unknown as D1Database, roles: ['super_admin'], authenticated: true }))
vi.mock('server-only', () => ({}))
vi.mock('@/utils/db-server', () => ({ getDB: async () => state.db }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: { DB: state.db } }) }))
vi.mock('@/utils/auth/server', () => ({
  getAppSession: async () => state.authenticated ? { kind: 'staff', user: { id: 'admin' }, session: { id: 'session' } } : null,
  getCurrentUser: async () => state.authenticated ? { id: 'admin', role: state.roles[0] } : null,
}))
vi.mock('@/lib/features', () => ({ getUserRoles: async () => state.roles, checkFeatureCrudAccess: async () => true }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/kalender-pendidikan', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/kalender-pendidikan')>(),
  getEffectiveDatesInRange: async () => ['2026-08-03'],
  getKalenderDateStatus: async () => ({ isEffective: true }),
  getKbmExceptionsForDate: async () => [],
  getKbmExceptionsForRange: async () => [],
}))

import { enrichTeacherLeaveSessions, enrichTeacherDelegations, validateTeacherLeaveReason } from './teacher-leave-db'
import { mapTeacherLeaveReasons, saveTeacherLeaveReason } from '@/app/dashboard/monitoring-penugasan/leave-actions'
import { getDataCetakLaporan, getMonitoringHarian, getRekapKehadiranGuru, batchEditAgendaStatus } from '@/app/dashboard/monitoring-agenda/actions'
import { getTeacherAttendance } from './teacher-attendance'
import { getTeacherAgendaObligations } from './teacher-agenda-obligations'

let sqlite: DatabaseSync

function adapter(): D1Database {
  const prepare = (sql: string) => {
    let args: Array<string | number | null> = []
    const statement = {
      bind(...values: Array<string | number | null>) { args = values; return statement },
      async all() { return { results: sqlite.prepare(sql).all(...args), success: true } },
      async first() { return sqlite.prepare(sql).get(...args) || null },
      async run() { const result = sqlite.prepare(sql).run(...args); return { success: true, meta: { changes: Number(result.changes) } } },
    }
    return statement
  }
  return { prepare, async batch(statements: Array<ReturnType<typeof prepare>>) {
    sqlite.exec('BEGIN')
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results }
    catch (error) { sqlite.exec('ROLLBACK'); throw error }
  } } as unknown as D1Database
}

beforeEach(() => {
  state.roles = ['super_admin']; state.authenticated = true
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE "user" (id TEXT PRIMARY KEY, nama_lengkap TEXT DEFAULT 'Guru');
    CREATE TABLE kelas (id TEXT PRIMARY KEY, tingkat INTEGER DEFAULT 10, nomor_kelas INTEGER DEFAULT 1, kelompok TEXT, kbm_nonaktif_mulai TEXT);
    CREATE TABLE mata_pelajaran (id TEXT PRIMARY KEY, nama_mapel TEXT);
    INSERT INTO mata_pelajaran VALUES ('m1', 'Matematika');
    CREATE TABLE tahun_ajaran (id TEXT PRIMARY KEY, nama TEXT, semester INTEGER, is_active INTEGER, jam_pelajaran TEXT, created_at TEXT DEFAULT '2026-07-01');
    INSERT INTO tahun_ajaran (id, nama, semester, is_active, jam_pelajaran) VALUES ('ta', '2026/2027', 1, 1, '[{"hari":[1],"slots":[{"id":1,"mulai":"07:00","selesai":"07:45"},{"id":2,"mulai":"07:45","selesai":"08:30"},{"id":3,"mulai":"08:30","selesai":"09:15"}]}');
    CREATE TABLE penugasan_mengajar (id TEXT PRIMARY KEY, guru_id TEXT REFERENCES "user"(id));
    CREATE TABLE jadwal_mengajar (penugasan_id TEXT, hari INTEGER, jam_ke INTEGER);
    INSERT INTO "user" (id) VALUES ('admin'), ('guru'); INSERT INTO kelas (id) VALUES ('kelas');
    INSERT INTO penugasan_mengajar VALUES ('p1', 'guru'), ('p2', 'guru');
    INSERT INTO jadwal_mengajar VALUES ('p1', 1, 1), ('p1', 1, 2), ('p2', 1, 3);
    ALTER TABLE penugasan_mengajar ADD COLUMN tahun_ajaran_id TEXT DEFAULT 'ta';
    ALTER TABLE penugasan_mengajar ADD COLUMN kelas_id TEXT DEFAULT 'kelas';
    ALTER TABLE penugasan_mengajar ADD COLUMN mapel_id TEXT DEFAULT 'm1';
    ALTER TABLE jadwal_mengajar ADD COLUMN tahun_ajaran_id TEXT DEFAULT 'ta';`)
  for (const file of ['schema-migration-agenda.sql', 'schema-migration-delegasi-tugas.sql', '0094_teacher_leave_reasons.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'))
  }
  sqlite.exec(`ALTER TABLE agenda_guru ADD COLUMN ppl_user_id TEXT REFERENCES "user"(id);
    INSERT INTO "user" (id, nama_lengkap) VALUES ('ppl', 'PPL Satu');
    INSERT INTO alasan_izin_guru (id, nama, kepentingan_sekolah) VALUES ('rapat', 'Rapat', 1);
    INSERT INTO delegasi_tugas (id, dari_user_id, tanggal, alasan_ketidakhadiran, deskripsi_ketidakhadiran)
      VALUES ('d1', 'guru', '2026-08-03', 'IZIN', 'Deskripsi lama');
    INSERT INTO delegasi_tugas_kelas (id, delegasi_id, penugasan_mengajar_id, kelas_id, tugas)
      VALUES ('dk1', 'd1', 'p1', 'kelas', 'Tugas satu'), ('dk2', 'd1', 'p2', 'kelas', 'Tugas dua');`)
  state.db = adapter()
})
afterEach(() => sqlite.close())

const sessions = () => ['p1', 'p2'].map(penugasan_id => ({ penugasan_id, tanggal: '2026-08-03', status: 'IZIN' }))

describe('master dan pemetaan izin guru dengan migrasi SQLite', () => {
  it('membiarkan izin lama biasa, lalu memetakan semua kelas tanpa mengubah deskripsi', async () => {
    expect((await enrichTeacherLeaveSessions(state.db, sessions())).every(row => !row.kepentingan_sekolah)).toBe(true)
    expect(await mapTeacherLeaveReasons([{ delegasi_id: 'd1' }], 'rapat')).toHaveProperty('success')
    const result = await enrichTeacherLeaveSessions(state.db, sessions())
    expect(result).toHaveLength(2)
    expect(result.every(row => row.kepentingan_sekolah && row.alasan_izin_guru_nama === 'Rapat')).toBe(true)
    expect(sqlite.prepare('SELECT deskripsi_ketidakhadiran FROM delegasi_tugas').get()).toMatchObject({ deskripsi_ketidakhadiran: 'Deskripsi lama' })
    expect((await enrichTeacherDelegations(state.db, [{ delegasi_id: 'd1' }]))[0].kepentingan_sekolah).toBe(true)
  })

  it('perubahan master berlaku retroaktif; alasan nonaktif tetap dibaca tetapi ditolak untuk pilihan baru', async () => {
    await mapTeacherLeaveReasons([{ delegasi_id: 'd1' }], 'rapat')
    for (const school of [false, true]) {
      await saveTeacherLeaveReason({ id: 'rapat', nama: 'Rapat dinas', kepentingan_sekolah: school, aktif: true })
      expect((await enrichTeacherLeaveSessions(state.db, sessions()))[0].kepentingan_sekolah).toBe(school)
    }
    await saveTeacherLeaveReason({ id: 'rapat', nama: 'Rapat dinas', kepentingan_sekolah: true, aktif: false })
    expect((await enrichTeacherLeaveSessions(state.db, sessions()))[0].kepentingan_sekolah).toBe(true)
    await expect(validateTeacherLeaveReason(state.db, 'IZIN', 'rapat')).rejects.toThrow('aktif')
    expect(await mapTeacherLeaveReasons([{ delegasi_id: 'd1' }], 'rapat')).toHaveProperty('error')
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM izin_guru_audit').get()).toMatchObject({ n: 4 })
  })

  it('koreksi sesi mengalahkan delegasi, mempertahankan catatan, dan tidak menggandakan sesi', async () => {
    await mapTeacherLeaveReasons([{ delegasi_id: 'd1' }], 'rapat')
    sqlite.exec(`INSERT INTO agenda_guru (guru_id, penugasan_id, tanggal, jam_ke_mulai, jam_ke_selesai, status, catatan_admin)
      VALUES ('guru', 'p1', '2026-08-03', 1, 2, 'IZIN', 'Catatan asli');`)
    expect((await enrichTeacherLeaveSessions(state.db, sessions()))[0].kepentingan_sekolah).toBe(true)
    await mapTeacherLeaveReasons([{ penugasan_id: 'p1', tanggal: '2026-08-03' }], 'izin-guru-lainnya')
    const result = await enrichTeacherLeaveSessions(state.db, sessions())
    expect(result.map(row => row.kepentingan_sekolah)).toEqual([false, true])
    expect(result).toHaveLength(2)
    expect(sqlite.prepare('SELECT catatan_admin FROM agenda_guru').get()).toMatchObject({ catatan_admin: 'Catatan asli' })
    expect((await enrichTeacherLeaveSessions(state.db, [{ ...sessions()[0], status: 'TEPAT_WAKTU' }]))[0].kepentingan_sekolah).toBe(false)
  })

  it('membuat koreksi izin per sesi tanpa mengubah kelas lain dalam delegasi', async () => {
    await mapTeacherLeaveReasons([{ penugasan_id: 'p1', tanggal: '2026-08-03' }], 'rapat')
    expect((await enrichTeacherLeaveSessions(state.db, sessions())).map(row => row.kepentingan_sekolah)).toEqual([true, false])
    expect(sqlite.prepare('SELECT status, materi, waktu_input FROM agenda_guru').get()).toMatchObject({ status: 'IZIN', materi: null, waktu_input: null })
  })

  it('dapat memetakan agenda historis walaupun jadwal lamanya sudah tidak tersedia', async () => {
    sqlite.exec(`INSERT INTO agenda_guru (guru_id, penugasan_id, tanggal, jam_ke_mulai, jam_ke_selesai, status)
      VALUES ('guru', 'p1', '2026-08-03', 1, 2, 'IZIN'); DELETE FROM jadwal_mengajar;`)
    expect(await mapTeacherLeaveReasons([{ penugasan_id: 'p1', tanggal: '2026-08-03' }], 'rapat')).toHaveProperty('success')
  })

  it('menolak seluruh batch jika ada target bukan izin', async () => {
    expect(await mapTeacherLeaveReasons([{ delegasi_id: 'd1' }, { delegasi_id: 'missing' }], 'rapat')).toHaveProperty('error')
    expect((await enrichTeacherLeaveSessions(state.db, sessions()))[0].kepentingan_sekolah).toBe(false)
  })

  it.each(['guru', 'admin_tu', 'kepsek'])('menolak perubahan master/pemetaan dari %s meskipun punya akses fitur', async role => {
    state.roles = [role]
    await expect(saveTeacherLeaveReason({ id: '', nama: 'Rapat', kepentingan_sekolah: true, aktif: true })).rejects.toThrow('izin')
    await expect(mapTeacherLeaveReasons([{ delegasi_id: 'd1' }], 'rapat')).rejects.toThrow('izin')
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM izin_guru_audit').get()).toMatchObject({ n: 0 })
  })

  it('menerima super admin sebagai role tambahan dan menolak sesi tanpa login', async () => {
    state.roles = ['guru', 'super_admin']
    expect(await mapTeacherLeaveReasons([{ delegasi_id: 'd1' }], 'rapat')).toHaveProperty('success')
    state.authenticated = false
    await expect(mapTeacherLeaveReasons([{ delegasi_id: 'd1' }], 'rapat')).rejects.toThrow('login')
  })
})

describe('performa konsisten di dashboard dan cetak', () => {
  it('agenda PPL tetap menjadi kehadiran guru utama dan membawa informasi pelaksana', async () => {
    sqlite.exec(`INSERT INTO agenda_guru (guru_id, penugasan_id, tanggal, jam_ke_mulai, jam_ke_selesai, status, materi, ppl_user_id)
      VALUES ('guru', 'p1', '2026-08-03', 1, 2, 'TEPAT_WAKTU', 'Materi oleh PPL', 'ppl');`)
    const print = await getDataCetakLaporan('2026-08-03', '2026-08-03')
    const daily = await getMonitoringHarian('2026-08-03', 'semua')
    expect(print.find(row => row.penugasan_id === 'p1')).toMatchObject({
      guru_id: 'guru', status: 'TEPAT_WAKTU', ppl_user_id: 'ppl', ppl_nama: 'PPL Satu',
    })
    expect(daily.data.find(row => row.penugasan_id === 'p1')).toMatchObject({
      guru_id: 'guru', status: 'TEPAT_WAKTU', ppl_user_id: 'ppl', ppl_nama: 'PPL Satu',
    })
    expect(aggregateTeacherAttendance(print, 'excused_penalized')[0]).toMatchObject({ hadir: 1, performa: 50 })
  })

  it('query harian, rekap, cetak, dan dashboard menghasilkan dua sesi yang sama setelah koreksi', async () => {
    await mapTeacherLeaveReasons([{ delegasi_id: 'd1' }], 'rapat')
    await mapTeacherLeaveReasons([{ penugasan_id: 'p1', tanggal: '2026-08-03' }], 'izin-guru-lainnya')
    const print = await getDataCetakLaporan('2026-08-03', '2026-08-03')
    const daily = await getMonitoringHarian('2026-08-03', 'semua')
    const recap = await getRekapKehadiranGuru('2026-08-03', '2026-08-03')
    const dashboard = await getTeacherAttendance(state.db, 'guru', '2026-08')
    expect(print).toHaveLength(2)
    expect(daily.data.map(row => row.kepentingan_sekolah)).toEqual([false, true])
    expect(aggregateTeacherAttendance(print, 'excused_penalized')[0].performa).toBe(50)
    expect(teacherPerformance(dashboard.summary)).toBe(50)
    expect(recap.data[0]).toMatchObject({ total_blok: 2, izin: 2, izinSekolah: 1, performa: 50 })
    expect((await getTeacherAgendaObligations(state.db, '2026-08-03', 'ta')).filter(row => row.kepentingan_sekolah)).toHaveLength(1)
  })

  it('perubahan status agenda memvalidasi alasan, memperbarui satu sesi, dan mencatat audit', async () => {
    const target = [{ penugasan_id: 'p1', guru_id: 'guru' }]
    expect(await batchEditAgendaStatus('2026-08-03', target, 'IZIN', 'Rapat koordinasi', 'rapat')).toMatchObject({ updated: 1 })
    expect((await getDataCetakLaporan('2026-08-03', '2026-08-03'))[0]).toMatchObject({ kepentingan_sekolah: true, keterangan: 'Rapat koordinasi' })
    expect(await batchEditAgendaStatus('2026-08-03', target, 'IZIN', '', 'rapat')).toHaveProperty('error')
    state.roles = ['admin_tu']
    expect(await batchEditAgendaStatus('2026-08-03', target, 'IZIN', 'Koreksi', 'izin-guru-lainnya')).toHaveProperty('error')
    state.roles = ['super_admin']
    expect(await batchEditAgendaStatus('2026-08-03', target, 'TEPAT_WAKTU', 'Hadir')).toMatchObject({ updated: 1 })
    expect((await getDataCetakLaporan('2026-08-03', '2026-08-03'))[0]).toMatchObject({ status: 'TEPAT_WAKTU', kepentingan_sekolah: false })
  })

  it('8 hadir + 1 izin sekolah + 1 alfa = 90%, jumlah hadir tetap 8', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      status: i < 8 ? 'TEPAT_WAKTU' : i === 8 ? 'IZIN' : 'ALFA', kepentingan_sekolah: i === 8,
      guru_id: 'guru', guru_nama: 'Guru', tanggal: '2026-08-03', penugasan_id: `p${i}`,
      nama_mapel: 'Matematika', kelas_id: 'kelas', tingkat: 10, nomor_kelas: 1, jam_ke_mulai: 1, jam_ke_selesai: 2,
    })) as AgendaPrintSession[]
    const summary = summarizeTeacherAttendance(rows as unknown as TeacherAttendanceItem[])
    expect(summary.hadir).toBe(8)
    expect(summary.izinSekolah).toBe(1)
    expect(teacherPerformance(summary)).toBe(90)
    for (const policy of ['excused_penalized', 'excused_not_penalized'] as const) {
      expect(aggregateTeacherAttendance(rows, policy)[0].performa).toBe(90)
    }
  })

  it('seluruh sesi izin sekolah mendapat 100%; izin biasa/sakit mengikuti kebijakan tanpa kredit ganda', () => {
    expect(teacherPerformance({ total: 2, hadir: 0, sakit: 0, izin: 2, izinSekolah: 2 })).toBe(100)
    const counts = { total: 5, hadir: 1, sakit: 1, izin: 2, izinSekolah: 1 }
    expect(teacherPerformance(counts)).toBe(40)
    expect(teacherPerformance(counts, true)).toBe(80)
    expect(teacherPerformance({ total: 0, hadir: 0, sakit: 0, izin: 0 })).toBe(0)
  })
})
