import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'

const state = vi.hoisted(() => ({ db: null as unknown as D1Database }))
vi.mock('server-only', () => ({}))
vi.mock('@/utils/db-server', () => ({ getDB: async () => state.db }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: { DB: state.db } }) }))
vi.mock('@/lib/action-security', () => ({
  requireActionAccess: async () => ({ id: 'admin', roles: ['super_admin'], kind: 'staff' }),
}))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: async () => ({ id: 'admin', role: 'super_admin' }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getMonthlyTeacherAttendanceHistory, getTeacherAgendaSubmissions } from './actions'
import { todayWIB } from '@/lib/time'

describe('teacher attendance history actions', () => {
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

  function shiftDate(value: string, days: number) {
    const date = new Date(`${value}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
  }

  function previousMonday(value: string) {
    const weekday = new Date(`${value}T00:00:00Z`).getUTCDay()
    const daysBack = ((weekday + 6) % 7) || 7
    return shiftDate(value, -daysBack)
  }

  function nextMonday(value: string) {
    const weekday = new Date(`${value}T00:00:00Z`).getUTCDay()
    const daysAhead = (8 - weekday) % 7 || 7
    return shiftDate(value, daysAhead)
  }

  const pastMonday = previousMonday(todayWIB())
  const holidayMonday = shiftDate(pastMonday, -7)
  const futureMonday = nextMonday(todayWIB())

  beforeAll(() => {
    sqlite = new DatabaseSync(':memory:')
    sqlite.exec(`
      CREATE TABLE "user" (id TEXT PRIMARY KEY, nama_lengkap TEXT);
      CREATE TABLE tahun_ajaran (id TEXT PRIMARY KEY, is_active INTEGER, jam_pelajaran TEXT);
      CREATE TABLE mata_pelajaran (id TEXT PRIMARY KEY, nama_mapel TEXT);
      CREATE TABLE kelas (id TEXT PRIMARY KEY, tingkat INTEGER, nomor_kelas INTEGER, kelompok TEXT, kbm_nonaktif_mulai TEXT);
      CREATE TABLE penugasan_mengajar (id TEXT PRIMARY KEY, guru_id TEXT, mapel_id TEXT, kelas_id TEXT, tahun_ajaran_id TEXT);
      CREATE TABLE jadwal_mengajar (penugasan_id TEXT, tahun_ajaran_id TEXT, hari INTEGER, jam_ke INTEGER);
      CREATE TABLE agenda_guru (
        id TEXT PRIMARY KEY, guru_id TEXT, penugasan_id TEXT, tanggal TEXT,
        jam_ke_mulai INTEGER, jam_ke_selesai INTEGER, materi TEXT, foto_url TEXT,
        status TEXT, waktu_input TEXT, catatan_admin TEXT, diubah_oleh TEXT,
        alasan_izin_guru_id TEXT, ppl_user_id TEXT, created_at TEXT, updated_at TEXT,
        UNIQUE(penugasan_id, tanggal)
      );
      CREATE TABLE absensi_sesi_guru (penugasan_id TEXT, tanggal TEXT);
      CREATE TABLE delegasi_tugas (
        id TEXT PRIMARY KEY, dari_user_id TEXT, kepada_user_id TEXT, tanggal TEXT,
        alasan_ketidakhadiran TEXT, deskripsi_ketidakhadiran TEXT,
        alasan_izin_guru_id TEXT, status TEXT, created_at TEXT
      );
      CREATE TABLE delegasi_tugas_kelas (id TEXT PRIMARY KEY, delegasi_id TEXT, penugasan_mengajar_id TEXT);
      CREATE TABLE alasan_izin_guru (id TEXT PRIMARY KEY, nama TEXT, kepentingan_sekolah INTEGER, aktif INTEGER);
      INSERT INTO "user" VALUES ('admin','Admin'), ('guru','Guru Satu');
      INSERT INTO tahun_ajaran VALUES (
        'ta-aktif', 1,
        '[{"hari":[1],"slots":[{"id":1,"mulai":"07:00","selesai":"07:45"}]}]'
      );
      INSERT INTO mata_pelajaran VALUES ('mapel','Matematika');
      INSERT INTO kelas VALUES ('kelas',10,1,'A',NULL);
      INSERT INTO alasan_izin_guru VALUES ('alasan-izin','Kepentingan keluarga',0,1);
    `)

    const assignments = ['p-alfa', 'p-sakit', 'p-delegasi', 'p-override', 'p-future']
    for (const id of assignments) {
      sqlite.prepare(`INSERT INTO penugasan_mengajar VALUES (?, 'guru', 'mapel', 'kelas', 'ta-aktif')`).run(id)
      sqlite.prepare(`INSERT INTO jadwal_mengajar VALUES (?, 'ta-aktif', 1, 1)`).run(id)
    }

    sqlite.prepare(`INSERT INTO agenda_guru
      (id,guru_id,penugasan_id,tanggal,jam_ke_mulai,jam_ke_selesai,status,catatan_admin,diubah_oleh)
      VALUES ('ag-sakit','guru','p-sakit',?,1,1,'SAKIT','Catatan kontrol dokter','admin')`).run(pastMonday)
    sqlite.prepare(`INSERT INTO agenda_guru
      (id,guru_id,penugasan_id,tanggal,jam_ke_mulai,jam_ke_selesai,status,catatan_admin,diubah_oleh)
      VALUES ('ag-override','guru','p-override',?,1,1,'TELAT','Dikonfirmasi guru piket','admin')`).run(pastMonday)

    sqlite.prepare(`INSERT INTO delegasi_tugas
      (id,dari_user_id,kepada_user_id,tanggal,alasan_ketidakhadiran,deskripsi_ketidakhadiran,status,created_at)
      VALUES ('dt-sakit','guru','admin',?,'SAKIT','Tidak masuk karena demam','DIKIRIM','${pastMonday} 07:00:00')`).run(pastMonday)
    sqlite.prepare(`INSERT INTO delegasi_tugas_kelas (id,delegasi_id,penugasan_mengajar_id)
      VALUES ('dtk-sakit','dt-sakit','p-delegasi')`).run()
    sqlite.prepare(`INSERT INTO delegasi_tugas
      (id,dari_user_id,kepada_user_id,tanggal,alasan_ketidakhadiran,deskripsi_ketidakhadiran,status,created_at)
      VALUES ('dt-override','guru','admin',?,'SAKIT','Catatan delegasi yang ditimpa','DIKIRIM','${pastMonday} 07:01:00')`).run(pastMonday)
    sqlite.prepare(`INSERT INTO delegasi_tugas_kelas (id,delegasi_id,penugasan_mengajar_id)
      VALUES ('dtk-override','dt-override','p-override')`).run()

    state.db = adapter()
  })

  afterAll(() => sqlite.close())

  it('filters monthly Sakit records while retaining canonical counts', async () => {
    const month = pastMonday.slice(0, 7)
    const result = await getMonthlyTeacherAttendanceHistory(month, 'SAKIT')
    expect(result.rows.map(row => row.id)).toContain(`session:p-sakit:${pastMonday}`)
    expect(result.rows.map(row => row.id)).toContain(`session:p-delegasi:${pastMonday}`)
    expect(result.rows.some(row => row.id === `session:p-override:${pastMonday}`)).toBe(false)
    expect(result.counts.sakit).toBe(2)
    expect(result.rows.map(row => row.deskripsi)).toEqual(expect.arrayContaining(['Catatan kontrol dokter', 'Tidak masuk karena demam']))
  })

  it('shows automatic Alfa and preserves agenda-over-delegation status and notes per teacher', async () => {
    const rows = await getTeacherAgendaSubmissions('guru', pastMonday, pastMonday)
    const byAssignment = new Map(rows.map(row => [row.penugasan_id, row]))
    expect(byAssignment.get('p-alfa')).toMatchObject({ status: 'ALFA', sumber: 'OTOMATIS', id: null })
    expect(byAssignment.get('p-sakit')).toMatchObject({ status: 'SAKIT', sumber: 'OVERRIDE', keterangan: 'Catatan kontrol dokter' })
    expect(byAssignment.get('p-delegasi')).toMatchObject({ status: 'SAKIT', sumber: 'PENUGASAN', keterangan: 'Tidak masuk karena demam' })
    expect(byAssignment.get('p-override')).toMatchObject({ status: 'TELAT', sumber: 'OVERRIDE', keterangan: 'Dikonfirmasi guru piket' })
  })

  it('does not report future or non-effective schedule sessions', async () => {
    const futureRows = await getTeacherAgendaSubmissions('guru', futureMonday, futureMonday)
    expect(futureRows).toEqual([])

    await state.db.prepare(`INSERT INTO kalender_pendidikan_events
      (id,start_date,end_date,title,category,is_effective,source,target_type)
      VALUES ('holiday','${holidayMonday}','${holidayMonday}','Libur khusus','TANGGAL_MERAH',0,'manual','ALL')`).run()
    const holidayRows = await getTeacherAgendaSubmissions('guru', holidayMonday, holidayMonday)
    expect(holidayRows).toEqual([])
  })
})
