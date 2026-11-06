import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { readFileSync } from 'node:fs'

const runtime = vi.hoisted(() => ({ db: null as unknown as D1Database, queue: vi.fn(), fcm: vi.fn(), effective: true, excepted: [] as number[], userId: 'wali', roles: [] as string[], realFeatures: false }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: async () => runtime.userId ? { id: runtime.userId } : null }))
vi.mock('@/lib/features', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/features')>()
  return {
    getUserRoles: async (...args: Parameters<typeof actual.getUserRoles>) => runtime.realFeatures ? actual.getUserRoles(...args) : runtime.roles,
    checkFeatureAccess: async (...args: Parameters<typeof actual.checkFeatureAccess>) => runtime.realFeatures ? actual.checkFeatureAccess(...args) : true,
  }
})
vi.mock('@/lib/activity-log', () => ({ logActivity: vi.fn(), ensureActivityLogTables: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/utils/db-server', () => ({ getDB: async () => runtime.db }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: { NOTIFICATION_QUEUE: { send: runtime.queue } } }) }))
vi.mock('@/lib/schema-guard', () => ({ ensureSchemaOnce: async (_key: string, ensure: () => Promise<unknown>) => ensure() }))
vi.mock('@/lib/fcm', () => ({ sendFcmNotification: runtime.fcm }))
vi.mock('@/lib/web-push', () => ({ sendPushNotification: vi.fn(async () => ({ success:true,sent:0 })) }))
vi.mock('@/lib/kalender-pendidikan', () => ({
  getEffectiveDatesInRange: async (_db: unknown, start: string, end: string) => {
    if (!runtime.effective) return []
    const dates: string[] = []
    for (let t = Date.parse(start); t <= Date.parse(end); t += 86400000) dates.push(new Date(t).toISOString().slice(0, 10))
    return dates
  },
  getKbmExceptionsForRange: async () => [],
  splitTeachingSlotsByExceptions: (_e: unknown, _k: unknown, slots: number[]) => ({ activeJamKe: slots.filter(j => !runtime.excepted.includes(j)) }),
}))

import { getFinalAttendanceForClass } from './wali-kelas-attendance'
import { academicPeriodDates, loadFullReportAttendance, loadFullStudentReport } from '@/app/dashboard/siswa/[id]/full-report/report-data'
import { invalidateAttendanceCache } from './attendance-cache'
import { attendanceDateEligible, initialAttendanceContext } from './attendance-notice-state'
import { notifyParentsAttendanceConfigured, notifyParentsDailyAttendanceFinal, dispatchAttendanceDailyNotices, processNotificationQueueMessage, prepareAttendanceNotificationWork, flushAttendanceNotificationOutbox, saveNotificationSetting, getNotificationSetting, type NotificationQueueMessage } from './notification-engine'
import { ATTENDANCE_CORRECTION_REQUEST_EVENT, ATTENDANCE_CORRECTION_RESULT_EVENT, getNotificationDefinition } from './notification-catalog'
import { getStaffInbox, readStaffNotification } from './staff-notification-inbox'
import { getKoreksiAbsensiCepat, simpanKeputusanAbsensiWaliBatch, simpanKoreksiAbsensiCepat } from '@/app/dashboard/kelas-binaan/attendance-actions'
import { decideAttendanceCorrection, getAttendanceCorrectionReview, getOwnAttendanceCorrectionResult, getStudentAttendanceCorrections, listAttendanceCorrectionQueue, requestAttendanceCorrection } from '@/app/dashboard/keterangan-absensi/correction-actions'
import { attendanceAlfaKey } from './attendance-correction'

let sqlite: DatabaseSync
const date = '2026-10-02'
function setTime(instant: string) { vi.setSystemTime(new Date(instant)); invalidateAttendanceCache() }
function raw(status: string, assignment = 'math', updated = new Date().toISOString()) {
  sqlite.prepare(`INSERT INTO absensi_siswa (siswa_id,penugasan_id,tanggal,status,catatan,jam_ke_mulai,jam_ke_selesai,diinput_oleh,updated_at)
    VALUES ('s',?,?,?,'Catatan sesi',?,?,'teacher',?)
    ON CONFLICT(siswa_id,penugasan_id,tanggal) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`)
    .run(assignment, date, status, assignment === 'math' ? 1 : 5, assignment === 'math' ? 2 : 6, updated)
  invalidateAttendanceCache()
}
async function snapshot() { return (await getFinalAttendanceForClass(runtime.db, 'class', date, date))?.statusByStudent.get('s')?.[0] }
function messages() { return runtime.queue.mock.calls.map(([message]) => message as NotificationQueueMessage) }
async function consume(message = messages().at(-1)!) {
  return processNotificationQueueMessage(message, { DB: runtime.db } as Parameters<typeof processNotificationQueueMessage>[1])
}
async function initial() {
  await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
  setTime('2026-10-02T04:05:01Z')
  return consume()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  setTime('2026-10-02T04:00:00Z')
  vi.clearAllMocks()
  runtime.queue.mockResolvedValue(undefined)
  runtime.fcm.mockResolvedValue({ success: true, sent: 1 })
  runtime.effective = true; runtime.excepted = []
  runtime.userId = 'wali'; runtime.roles = []; runtime.realFeatures = false
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE "user" (id TEXT PRIMARY KEY, nama_lengkap TEXT, name TEXT, jabatan_struktural_id TEXT, banned INTEGER DEFAULT 0, role TEXT);
    CREATE TABLE user_roles (user_id TEXT, role TEXT, UNIQUE(user_id, role));
    CREATE TABLE role_features (role TEXT, feature_id TEXT, UNIQUE(role, feature_id));
    CREATE TABLE user_feature_overrides (user_id TEXT, feature_id TEXT, action TEXT);
    CREATE TABLE kelas (id TEXT PRIMARY KEY, tingkat INTEGER, nomor_kelas TEXT, kelompok TEXT, wali_kelas_id TEXT, kbm_nonaktif_mulai TEXT);
    CREATE TABLE siswa (id TEXT PRIMARY KEY, kelas_id TEXT, status TEXT, nama_lengkap TEXT, nisn TEXT, nis_lokal TEXT, jenis_kelamin TEXT, foto_url TEXT);
    CREATE TABLE tahun_ajaran (id TEXT PRIMARY KEY, jam_pelajaran TEXT, is_active INTEGER, nama TEXT DEFAULT '2026/2027', semester INTEGER DEFAULT 1);
    CREATE TABLE mata_pelajaran (id TEXT PRIMARY KEY, nama_mapel TEXT);
    CREATE TABLE penugasan_mengajar (id TEXT PRIMARY KEY, kelas_id TEXT, mapel_id TEXT, guru_id TEXT);
    CREATE TABLE jadwal_mengajar (hari INTEGER, jam_ke INTEGER, penugasan_id TEXT, tahun_ajaran_id TEXT);
    CREATE TABLE absensi_siswa (siswa_id TEXT, penugasan_id TEXT, tanggal TEXT, status TEXT, catatan TEXT, jam_ke_mulai INTEGER, jam_ke_selesai INTEGER, diinput_oleh TEXT, updated_at TEXT, UNIQUE(siswa_id,penugasan_id,tanggal));
    CREATE TABLE keterangan_absensi_wali_kelas (id TEXT,siswa_id TEXT,tanggal TEXT,status TEXT,keterangan TEXT,dibuat_oleh TEXT,updated_at TEXT,UNIQUE(siswa_id,tanggal));
    CREATE TABLE alasan_izin_kelas (alasan TEXT, hitung_sebagai_hadir INTEGER);
    CREATE TABLE izin_tidak_masuk_kelas (siswa_id TEXT,tanggal TEXT,alasan TEXT,keterangan TEXT,jam_pelajaran TEXT,diinput_oleh TEXT,created_at TEXT);
    CREATE TABLE izin_keluar_komplek (siswa_id TEXT,keterangan TEXT,waktu_keluar TEXT,waktu_kembali TEXT,diinput_oleh TEXT);
    CREATE TABLE parent_notifications (siswa_id TEXT,type TEXT,title TEXT,message TEXT,source_ref TEXT,level TEXT,UNIQUE(siswa_id,type,source_ref));
    INSERT INTO "user" (id,nama_lengkap) VALUES ('teacher','Bu Guru');
    INSERT INTO kelas VALUES ('class',10,'1','A',NULL,NULL);
    INSERT INTO siswa VALUES ('s','class','aktif','Alya','123','001','P',NULL);
    INSERT INTO mata_pelajaran VALUES ('m','Matematika'),('b','Bahasa');
    INSERT INTO penugasan_mengajar VALUES ('math','class','m','teacher'),('language','class','b','teacher');
    INSERT INTO jadwal_mengajar VALUES (5,1,'math','year'),(5,2,'math','year'),(5,5,'language','year'),(5,6,'language','year');
    INSERT INTO tahun_ajaran (id,jam_pelajaran,is_active) VALUES ('year','[{"hari":[5],"slots":[{"id":1,"mulai":"07:00","selesai":"07:30"},{"id":2,"mulai":"07:30","selesai":"08:00"},{"id":5,"mulai":"11:00","selesai":"11:30"},{"id":6,"mulai":"11:30","selesai":"12:00"}]}]',1);
  `)
  sqlite.exec(readFileSync(new URL('../migrations/0114_attendance_parent_notice_state.sql', import.meta.url), 'utf8'))
  sqlite.exec(readFileSync(new URL('../migrations/0125_attendance_correction_approval.sql', import.meta.url), 'utf8'))
  sqlite.exec("UPDATE attendance_notice_policy SET activated_at='2026-10-02T00:00:00Z'")
  function prepared(query: string, values: SQLInputValue[] = []) {
    const sql = query.replace(/'now'/g, `'${new Date().toISOString()}'`)
    return {
      bind: (...args: SQLInputValue[]) => prepared(query, args),
      all: async () => ({ results: sqlite.prepare(sql).all(...values) }),
      first: async () => sqlite.prepare(sql).get(...values) || null,
      run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...values) }),
      execute: () => ({ success: true, meta: sqlite.prepare(sql).run(...values) }),
    }
  }
  runtime.db = { prepare: prepared, batch: async (statements: ReturnType<typeof prepared>[]) => {
    sqlite.exec('BEGIN')
    try { const results = statements.map(item => item.execute()); sqlite.exec('COMMIT'); return results }
    catch (error) { sqlite.exec('ROLLBACK'); throw error }
  } } as unknown as D1Database
})
afterEach(() => { sqlite.close(); invalidateAttendanceCache(); vi.useRealTimers() })

describe('full report daily attendance', () => {
  const semester = { id: 'year', nama: '2026/2027', semester: 1, label: '2026/2027 Semester 1', is_active: 1,
    ...academicPeriodDates('2026/2027', 1) }
  const dates = ['2026-08-28', '2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25', date]
  beforeEach(() => {
    setTime('2026-10-16T10:00:00Z')
    sqlite.exec(`
      CREATE TABLE riwayat_kelas (siswa_id TEXT,kelas_id TEXT,tahun_ajaran_id TEXT,created_at TEXT);
      INSERT INTO riwayat_kelas VALUES ('s','class','year','2026-07-01');
      ALTER TABLE penugasan_mengajar ADD COLUMN tahun_ajaran_id TEXT DEFAULT 'year';
    `)
    for (const day of dates) {
      sqlite.prepare(`INSERT INTO absensi_siswa (siswa_id,penugasan_id,tanggal,status,jam_ke_mulai,jam_ke_selesai,diinput_oleh)
        VALUES ('s','math',?,'ALFA',1,2,'teacher')`).run(day)
    }
    sqlite.prepare(`INSERT INTO absensi_siswa (siswa_id,penugasan_id,tanggal,status,jam_ke_mulai,jam_ke_selesai,diinput_oleh)
      VALUES ('s','language',?,'ALFA',5,6,'teacher')`).run(date)
  })
  const report = (period: typeof semester | null = null) => loadFullReportAttendance(runtime.db, 's', 'class', [semester], period)

  it('counts seven alfa sessions on six dates as six days in all history', async () => {
    expect(sqlite.prepare("SELECT COUNT(*) n FROM absensi_siswa WHERE status='ALFA'").get()?.n).toBe(7)
    expect(await report()).toEqual({ hadir: 0, sakit: 0, izin: 0, alfa: 6, finalCount: 6 })
    expect(await report(semester)).toEqual(await report())
  })
  it('prints daily totals and a daily presence denominator in the complete report', async () => {
    await report() // Initialize the existing teacher-session schema.
    sqlite.exec(`
      ALTER TABLE "user" ADD COLUMN nip TEXT;
      ALTER TABLE "user" ADD COLUMN signature_url TEXT;
      INSERT INTO absensi_sesi_guru (penugasan_id,tanggal,diinput_oleh) VALUES ('math','2026-10-09','teacher');
    `)
    const fullReport = await loadFullStudentReport(runtime.db, 's')
    const attendance = fullReport?.sections.find(section => section.id === 'kehadiran')
    expect(attendance?.tables.find(table => table.title === 'Status Kehadiran')).toMatchObject({
      headers: ['Status', 'Jumlah Hari'],
      rows: [['HADIR', '1'], ['SAKIT', '0'], ['IZIN', '0'], ['ALFA', '6']],
    })
    expect(attendance?.metrics).toContainEqual({ label: 'Hari Terekap', value: '7', detail: 'hari dengan status akhir' })
    expect(attendance?.metrics).toContainEqual({ label: 'Tingkat Kehadiran', value: '14,29%' })
  })
  it('applies wali corrections and never infers presence from missing input', async () => {
    sqlite.prepare("INSERT INTO keterangan_absensi_wali_kelas (siswa_id,tanggal,status,keterangan) VALUES ('s',?,'SAKIT',NULL)").run(date)
    expect(await report()).toEqual({ hadir: 0, sakit: 1, izin: 0, alfa: 5, finalCount: 6 })
  })
  it('uses school permission priority over alfa and wali corrections', async () => {
    sqlite.exec(`INSERT INTO alasan_izin_kelas VALUES ('Tugas sekolah',1)`)
    sqlite.prepare("INSERT INTO izin_tidak_masuk_kelas VALUES ('s',?,'Tugas sekolah',NULL,NULL,'teacher',NULL)").run(date)
    sqlite.prepare("INSERT INTO keterangan_absensi_wali_kelas (siswa_id,tanggal,status,keterangan) VALUES ('s',?,'SAKIT',NULL)").run(date)
    expect(await report()).toEqual({ hadir: 1, sakit: 0, izin: 0, alfa: 5, finalCount: 6 })
  })
  it('preserves history for an inactive student who has moved class', async () => {
    sqlite.exec("UPDATE siswa SET kelas_id='new-class',status='lulus' WHERE id='s'")
    sqlite.prepare("INSERT INTO keterangan_absensi_wali_kelas (siswa_id,tanggal,status,keterangan) VALUES ('s',?,'IZIN',NULL)").run(date)
    expect(await report()).toEqual({ hadir: 0, sakit: 0, izin: 1, alfa: 5, finalCount: 6 })
    // The live roster remains limited to active students in the current class.
    expect((await getFinalAttendanceForClass(runtime.db, 'class', date, date))?.siswa).toEqual([])
  })
  it('does not count the current day until KBM ends', async () => {
    setTime('2026-10-02T04:00:00Z')
    expect(await report()).toEqual({ hadir: 0, sakit: 0, izin: 0, alfa: 5, finalCount: 5 })
  })
  it('does not apply the current roster to a previous semester without student history', async () => {
    const oldSemester = { ...semester, id: 'old-year', nama: '2025/2026', semester: 2, is_active: 0,
      ...academicPeriodDates('2025/2026', 2) }
    expect(await loadFullReportAttendance(runtime.db, 's', 'class', [oldSemester, semester], null)).toEqual(await report())
    expect(await loadFullReportAttendance(runtime.db, 's', 'class', [oldSemester, semester], oldSemester))
      .toEqual({ hadir: 0, sakit: 0, izin: 0, alfa: 0, finalCount: 0 })
  })
})

describe('configurable delays and durable attendance work', () => {
  it('applies the additive release migration without changing source rows or activation', () => {
    raw('ALFA')
    sqlite.exec(`CREATE TABLE notification_dispatches (id TEXT PRIMARY KEY,event_key TEXT,status TEXT);
      INSERT INTO notification_dispatches VALUES ('old','legacy','queued');`)
    sqlite.exec(readFileSync(new URL('../migrations/0116_attendance_quick_correction_outbox.sql', import.meta.url), 'utf8'))
    expect(sqlite.prepare('SELECT status FROM absensi_siswa').get()?.status).toBe('ALFA')
    expect(sqlite.prepare('SELECT activated_at FROM attendance_notice_policy').get()?.activated_at).toBe('2026-10-02T00:00:00Z')
    expect(sqlite.prepare('SELECT payload_json FROM notification_dispatches WHERE id=?').get('old')?.payload_json).toBeNull()
    expect(sqlite.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name LIKE 'attendance_recheck_%'").get()?.n).toBe(6)
  })
  async function configure(key: string, delay: number) {
    const def = getNotificationDefinition(key)!
    return saveNotificationSetting(key, { enabled: true, titleTemplate: def.defaultTitle, bodyTemplate: def.defaultBody,
      urlTemplate: def.defaultUrl, channels: def.defaultChannels, target: def.defaultTarget,
      reminder: { ...def.reminder, delayMinutes: delay }, level: 'info', updatedBy: 'teacher' }, runtime.db)
  }
  it.each([-1, 61, 0.5, NaN])('rejects invalid delay %s at the server', async delay => {
    expect(await configure('attendance_parent_alert', delay)).toHaveProperty('error')
  })
  it('round-trips settings and preserves the captured due time after configuration changes', async () => {
    expect(await configure('attendance_parent_alert', 2)).not.toHaveProperty('error')
    expect(JSON.parse((await getNotificationSetting('attendance_parent_alert', runtime.db))!.reminder_json).delayMinutes).toBe(2)
    raw('ALFA'); await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    const message = messages()[0]
    expect(runtime.queue.mock.calls[0][1]).toMatchObject({ delaySeconds: 120 })
    await configure('attendance_parent_alert', 20)
    setTime('2026-10-02T04:01:59Z'); expect(await consume(message)).toMatchObject({ retry: true, sent: 0 })
    setTime('2026-10-02T04:02:00Z'); expect((await consume(message)).sent).toBeGreaterThan(0)
  })
  it('honors a configurable homeroom delay and zero parent delay', async () => {
    sqlite.exec("INSERT INTO \"user\" (id,nama_lengkap) VALUES ('wali','Wali'); UPDATE kelas SET wali_kelas_id='wali'")
    await configure('attendance_homeroom_alert', 3); await configure('attendance_parent_alert', 0)
    raw('IZIN'); await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    const staff = messages().find(m => m.eventKey === 'attendance_homeroom_alert')!
    expect(await consume(staff)).toMatchObject({ retry: true, sent: 0 })
    expect((await consume(messages().find(m => m.eventKey === 'attendance_parent_alert')!)).sent).toBeGreaterThan(0)
    setTime('2026-10-02T04:03:00Z'); expect((await consume(staff)).sent).toBeGreaterThan(0)
  })
  it.each(['SAKIT','IZIN','HADIR'])('keeps the Alfa session report with a wali %s correction', async status => {
    raw('ALFA'); await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    const message = messages()[0]
    sqlite.prepare('INSERT INTO keterangan_absensi_wali_kelas (siswa_id,tanggal,status,keterangan) VALUES (?,?,?,NULL)').run('s',date,status)
    setTime('2026-10-02T04:05:00Z')
    const result = await consume(message)
    expect(result.sent).toBeGreaterThan(0)
    expect(runtime.fcm).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining('belum hadir pada sesi ini') }), expect.anything(), expect.anything())
    expect(runtime.fcm.mock.calls[0][0].body).toContain('catatan sesi pembelajaran')
  })
  it('retains an initial candidate through note-only teacher updates', async () => {
    raw('ALFA'); await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    const message = messages()[0]
    setTime('2026-10-02T04:04:00Z'); raw('ALFA')
    setTime('2026-10-02T04:05:00Z'); expect((await consume(message)).sent).toBeGreaterThan(0)
  })
  it('commits source and work together, rolls both back on failure, and recovers enqueue failure', async () => {
    const work = await prepareAttendanceNotificationWork(runtime.db, { kelasId: 'class', penugasanId: 'math', tanggal: date, siswaIds: ['s'], notifyIds: ['s'] })
    const source = runtime.db.prepare("INSERT INTO absensi_siswa (siswa_id,penugasan_id,tanggal,status,updated_at,jam_ke_mulai,jam_ke_selesai) VALUES ('s','math',?,'ALFA',?,1,2)").bind(date,new Date().toISOString())
    await expect(runtime.db.batch([source, ...work, runtime.db.prepare('INSERT INTO missing_table VALUES (1)')])).rejects.toThrow()
    expect(sqlite.prepare('SELECT count(*) n FROM absensi_siswa').get()?.n).toBe(0)
    expect(sqlite.prepare('SELECT count(*) n FROM notification_dispatches').get()?.n).toBe(0)
    await runtime.db.batch([source, ...work])
    runtime.queue.mockRejectedValueOnce(new Error('queue offline'))
    expect(await flushAttendanceNotificationOutbox(runtime.db)).toEqual({ queued: 0 })
    setTime('2026-10-02T04:01:00Z')
    await Promise.all([flushAttendanceNotificationOutbox(runtime.db),flushAttendanceNotificationOutbox(runtime.db)])
    const deliveredWork = messages().find(m => m.validation?.kind === 'attendance_work')!
    await Promise.all([consume(deliveredWork), consume(deliveredWork)])
    expect(messages().filter(m => m.eventKey === 'attendance_parent_alert')).toHaveLength(1)
    expect(sqlite.prepare('SELECT status FROM notification_dispatches WHERE id=?').get(deliveredWork.dispatchId)?.status).toBe('sent')
  })
  it('permission insert/update/delete dirties only existing reports for the relevant student/date', async () => {
    raw('ALFA'); await initial()
    sqlite.exec('UPDATE attendance_parent_notice_state SET needs_recheck=0')
    sqlite.prepare('INSERT INTO izin_tidak_masuk_kelas VALUES (?,?,?,NULL,NULL,?,?)').run('other',date,'Kegiatan','teacher',new Date().toISOString())
    expect(sqlite.prepare('SELECT needs_recheck FROM attendance_parent_notice_state').get()?.needs_recheck).toBe(0)
    sqlite.prepare('INSERT INTO izin_tidak_masuk_kelas VALUES (?,?,?,NULL,NULL,?,?)').run('s',date,'Kegiatan','teacher',new Date().toISOString())
    expect(sqlite.prepare('SELECT needs_recheck FROM attendance_parent_notice_state').get()?.needs_recheck).toBe(1)
    sqlite.exec("UPDATE attendance_parent_notice_state SET needs_recheck=0; UPDATE izin_tidak_masuk_kelas SET alasan='Sakit' WHERE siswa_id='s'")
    expect(sqlite.prepare('SELECT needs_recheck FROM attendance_parent_notice_state').get()?.needs_recheck).toBe(1)
    sqlite.exec("UPDATE attendance_parent_notice_state SET needs_recheck=0; DELETE FROM izin_tidak_masuk_kelas WHERE siswa_id='s'")
    expect(sqlite.prepare('SELECT needs_recheck FROM attendance_parent_notice_state').get()?.needs_recheck).toBe(1)
  })
  it('returns only the requested student and reads fresh source data for quick correction', async () => {
    sqlite.exec("INSERT INTO siswa VALUES ('other','class','aktif','Budi','456','002','L',NULL)")
    raw('ALFA')
    const data = await getFinalAttendanceForClass(runtime.db,'class',date,date,{siswaIds:['s'],fresh:true})
    expect(data?.siswa.map(s => s.id)).toEqual(['s'])
    raw('SAKIT')
    expect((await getFinalAttendanceForClass(runtime.db,'class',date,date,{siswaId:'s',fresh:true}))?.statusByStudent.get('s')?.[0].block_statuses[0].status).toBe('SAKIT')
  })
  it('splits a large cron group before binding D1 parameters', async () => {
    raw('ALFA'); await initial(); setTime('2026-10-02T05:00:00Z')
    const prepare = runtime.db.prepare.bind(runtime.db)
    runtime.db.prepare = (query: string) => {
      const statement = prepare(query)
      const bind = statement.bind.bind(statement)
      statement.bind = (...values: unknown[]) => {
        if (values.length > 100) throw new Error('D1 parameter limit')
        return bind(...values)
      }
      return statement
    }
    expect(await notifyParentsDailyAttendanceFinal(runtime.db, {kelasId:'class',tanggal:date,siswaIds:['s',...Array.from({length:100},(_,i)=>`other-${i}`)]})).toMatchObject({notified:1,students:1})
  })
})

describe('quick correction access and optimistic concurrency', () => {
  beforeEach(() => {
    sqlite.exec("UPDATE kelas SET wali_kelas_id='wali'")
    raw('ALFA')
  })
  it.each(['other',''])('rejects an unauthorized user %s', async userId => {
    runtime.userId = userId
    expect(await getKoreksiAbsensiCepat('s',date,'math')).toHaveProperty('error')
  })
  it('rejects cross-class assignments, future dates, and stale revisions', async () => {
    expect(await getKoreksiAbsensiCepat('s',date,'missing')).toHaveProperty('error')
    expect(await getKoreksiAbsensiCepat('s','2026-10-03','math')).toHaveProperty('error')
    const { data } = await getKoreksiAbsensiCepat('s',date,'math')
    setTime('2026-10-02T04:00:30Z'); raw('SAKIT')
    expect(await simpanKoreksiAbsensiCepat({ siswaId:'s',tanggal:date,penugasanId:'math',status:'HADIR',keterangan:'',revision:data!.revision })).toHaveProperty('error')
    expect(sqlite.prepare('SELECT count(*) n FROM keterangan_absensi_wali_kelas').get()?.n).toBe(0)
  })
  it('requires an explicit request for Alfa and permits ordinary corrections with durable work', async () => {
    const { data } = await getKoreksiAbsensiCepat('s',date,'math')
    expect(data).toMatchObject({ statusGuru:'ALFA',isFinal:false, pendingBlocks:1 })
    expect(await simpanKoreksiAbsensiCepat({ siswaId:'s',tanggal:date,penugasanId:'math',status:'SAKIT',keterangan:'Dikonfirmasi',revision:data!.revision })).toHaveProperty('approvalRequired.s')
    expect(sqlite.prepare('SELECT count(*) n FROM keterangan_absensi_wali_kelas').get()?.n).toBe(0)
    raw('SAKIT')
    const ordinary = (await getKoreksiAbsensiCepat('s',date,'math')).data!
    expect(await simpanKoreksiAbsensiCepat({ siswaId:'s',tanggal:date,penugasanId:'math',status:'HADIR',keterangan:'Dikonfirmasi',revision:ordinary.revision })).toHaveProperty('success')
    expect(sqlite.prepare('SELECT status FROM absensi_siswa').get()?.status).toBe('SAKIT')
    expect(sqlite.prepare('SELECT status,keterangan FROM keterangan_absensi_wali_kelas').get()).toMatchObject({status:'HADIR',keterangan:'Dikonfirmasi'})
    expect(messages().filter(m => m.validation?.kind === 'attendance_work')).toHaveLength(1)
  })
})

describe('attendance correction approvals', () => {
  beforeEach(() => {
    sqlite.exec(`UPDATE kelas SET wali_kelas_id = 'wali';
      INSERT INTO "user" (id,nama_lengkap,jabatan_struktural_id) VALUES
        ('wali','Wali',NULL),('reviewer','Pemeriksa','jbt_waka_kesiswaan');
      INSERT INTO siswa (id,kelas_id,status,nama_lengkap) VALUES ('s2','class','aktif','Budi');
    `)
    raw('ALFA')
    setTime('2026-10-02T05:00:01Z')
  })
  async function submit(status: 'SAKIT' | 'HADIR' = 'SAKIT') {
    const day = await snapshot()
    return requestAttendanceCorrection({ siswaId: 's', tanggal: date, status, reason: 'Dikonfirmasi orang tua',
      alfaKey: attendanceAlfaKey(day?.alfa_blocks ?? []) })
  }
  function reviewer(roles: string[] = ['wakamad'], id = 'reviewer') { runtime.userId = id; runtime.roles = roles }
  function requestId() { return String(sqlite.prepare('SELECT id FROM attendance_correction_requests ORDER BY rowid DESC').get()?.id) }

  function reviewNotice() { return messages().find(message => message.eventKey === ATTENDANCE_CORRECTION_REQUEST_EVENT) }

  function configureReviewers() {
    runtime.realFeatures = true
    sqlite.exec(`UPDATE "user" SET role = 'wakamad' WHERE id IN ('wali', 'reviewer');
      UPDATE "user" SET jabatan_struktural_id = 'jbt_waka_kesiswaan' WHERE id = 'wali';
      INSERT INTO "user" (id, role, jabatan_struktural_id, banned) VALUES
        ('curriculum','wakamad','jbt_waka_kurikulum',0), ('principal','kepsek',NULL,0),
        ('admin','guru',NULL,0), ('facilities','wakamad','jbt_waka_sarpras',0),
        ('banned','kepsek',NULL,1), ('store','play_reviewer',NULL,0);
      INSERT INTO user_roles VALUES ('admin','super_admin'), ('admin','kepsek'), ('store','play_reviewer'), ('store','kepsek');
    `)
  }

  it('targets eligible reviewers once and keeps a readable inbox copy without push devices', async () => {
    configureReviewers()
    expect(await submit()).toHaveProperty('success')
    expect(await submit()).toHaveProperty('error')
    const message = reviewNotice()!
    expect(message.target.ids).toEqual(['admin', 'curriculum', 'principal', 'reviewer'])
    expect(messages().filter(item => item.eventKey === ATTENDANCE_CORRECTION_REQUEST_EVENT)).toHaveLength(1)
    expect(message.title).toBe('Ajuan koreksi absensi menunggu persetujuan')
    expect(message.body).not.toMatch(/Alya|Dikonfirmasi orang tua/)
    expect(message.channels).toEqual(['fcm', 'webpush', 'in_app'])
    runtime.fcm.mockResolvedValue({ success: true, sent: 0 })
    await Promise.all([consume(message), consume(message)])
    const inbox = await getStaffInbox(runtime.db, 'reviewer', { corrections: true })
    expect(inbox.items).toHaveLength(1)
    expect(inbox.unreadCount).toBe(1)
    expect((await getStaffInbox(runtime.db, 'reviewer')).items).toHaveLength(0)
    const opened = await readStaffNotification(runtime.db, 'reviewer', inbox.items[0].id, true)
    expect(opened?.url).toBe(`/dashboard/keterangan-absensi?ajuan=${requestId()}`)
    expect((await getStaffInbox(runtime.db, 'reviewer', { corrections: true })).unreadCount).toBe(0)
    const id = new URL(opened!.url, 'https://test.invalid').searchParams.get('ajuan')!
    runtime.userId = 'facilities'
    expect(await getAttendanceCorrectionReview(id)).toHaveProperty('error')
    runtime.userId = 'reviewer'
    expect(await getAttendanceCorrectionReview(id)).toMatchObject({ data: { status: 'PENDING' } })
    await decideAttendanceCorrection(id, 'REJECTED', 'Konfirmasi guru diperlukan')
    expect(await getAttendanceCorrectionReview(id)).toMatchObject({ data: { status: 'REJECTED', reviewNote: 'Konfirmasi guru diperlukan' } })
  })

  it('rechecks access and recovers an enqueue failure for the same dispatch', async () => {
    configureReviewers()
    sqlite.exec("UPDATE \"user\" SET role='super_admin' WHERE id='wali'")
    runtime.queue.mockRejectedValueOnce(new Error('Queue temporarily unavailable'))
    expect(await submit()).toHaveProperty('success')
    const message = reviewNotice()!
    expect(message.target.ids).toContain('wali')
    sqlite.exec("INSERT INTO user_feature_overrides VALUES ('reviewer','keterangan-absensi','revoke')")
    setTime('2026-10-02T05:01:03Z')
    expect(await flushAttendanceNotificationOutbox(runtime.db)).toMatchObject({ queued: 1 })
    expect(messages().at(-1)?.dispatchId).toBe(message.dispatchId)
    await consume(message)
    expect((await getStaffInbox(runtime.db, 'reviewer', { corrections: true })).unreadCount).toBe(0)
    expect((await getStaffInbox(runtime.db, 'curriculum', { corrections: true })).unreadCount).toBe(1)
  })

  it('skips queued notifications for requests that have already been decided', async () => {
    configureReviewers()
    await submit()
    const message = reviewNotice()!
    runtime.userId = 'principal'
    await decideAttendanceCorrection(requestId(), 'REJECTED', 'Sudah ditinjau')
    expect(await consume(message)).toMatchObject({ skipped: true })
    expect(runtime.fcm).not.toHaveBeenCalled()
    expect((await getStaffInbox(runtime.db, 'reviewer', { corrections: true })).unreadCount).toBe(0)
  })

  it('rolls back the request if its notification cannot be recorded', async () => {
    configureReviewers()
    await getNotificationSetting(ATTENDANCE_CORRECTION_REQUEST_EVENT, runtime.db)
    sqlite.exec(`CREATE TRIGGER fail_correction_notice BEFORE INSERT ON notification_dispatches
      WHEN NEW.event_key = '${ATTENDANCE_CORRECTION_REQUEST_EVENT}'
      BEGIN SELECT RAISE(ABORT, 'Outbox unavailable'); END`)
    await expect(submit()).rejects.toThrow('Outbox unavailable')
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM attendance_correction_requests').get()?.total).toBe(0)
    expect(reviewNotice()).toBeUndefined()
  })

  it.each([['APPROVED', 'disetujui'], ['REJECTED', 'ditolak']] as const)(
    'sends %s privately to the original applicant and retains the internal audit',
    async (status, label) => {
      await submit()
      const id = requestId()
      reviewer()
      expect(await decideAttendanceCorrection(id, status, 'Catatan atas nama Pemeriksa')).toHaveProperty('success')
      expect(await getOwnAttendanceCorrectionResult(id)).toBeNull()
      expect(await getAttendanceCorrectionReview(id)).toMatchObject({
        data: { reviewer: 'Pemeriksa', reviewNote: 'Catatan atas nama Pemeriksa' },
      })
      const result = messages().find(message => message.eventKey === ATTENDANCE_CORRECTION_RESULT_EVENT)!
      expect(result.target.ids).toEqual(['wali'])
      expect(result.title).toContain(label)
      expect(JSON.stringify(result)).not.toMatch(/Pemeriksa|reviewer|Catatan atas nama/)
      await consume(result)
      await consume(result)
      const inbox = await getStaffInbox(runtime.db, 'wali')
      expect(inbox.items).toHaveLength(1)
      expect(inbox.items[0].url).toBe(`/dashboard/kelas-binaan/hasil-koreksi?ajuan=${id}`)
      reviewer(['kepsek'], 'wali')
      expect(await getOwnAttendanceCorrectionResult(id)).toEqual({ tanggal: date, proposed: 'SAKIT', status })
      const ownHistory = await getStudentAttendanceCorrections('s', date)
      expect(ownHistory.rows?.[0]).toMatchObject({ status })
      expect(ownHistory.rows?.[0]).not.toHaveProperty('reviewer')
      expect(ownHistory.rows?.[0]).not.toHaveProperty('reviewNote')
      expect(await getAttendanceCorrectionReview(id)).toMatchObject({ data: { reviewer: null, reviewNote: null } })
    },
  )

  it('blocks a mixed batch without committing other rows and keeps the draft target identifiable', async () => {
    const result = await simpanKeputusanAbsensiWaliBatch('class', date, [
      { siswa_id: 's2', status: 'HADIR', keterangan: '' }, { siswa_id: 's', status: 'HADIR', keterangan: 'Hadir' },
    ])
    expect(result.approvalRequired?.s[0].mapel).toBe('Matematika')
    expect(sqlite.prepare('SELECT count(*) AS total FROM keterangan_absensi_wali_kelas').get()?.total).toBe(0)
  })
  it('rolls back a mixed batch when Alfa is written after the server reads the source', async () => {
    raw('SAKIT')
    const batch = runtime.db.batch
    runtime.db.batch = (async (statements: D1PreparedStatement[]) => {
      if (statements.length > 2 && sqlite.prepare("SELECT name FROM sqlite_master WHERE name='notification_dispatches'").get()) {
        raw('ALFA')
        runtime.db.batch = batch
      }
      return batch(statements)
    }) as typeof runtime.db.batch
    const result = await simpanKeputusanAbsensiWaliBatch('class', date, [
      { siswa_id: 's2', status: 'HADIR', keterangan: '' }, { siswa_id: 's', status: 'HADIR', keterangan: '' },
    ])
    expect(result.approvalRequired?.s).toHaveLength(1)
    expect(sqlite.prepare('SELECT count(*) AS total FROM keterangan_absensi_wali_kelas').get()?.total).toBe(0)
  })
  it('rejects applicants outside the class and prevents duplicate pending requests', async () => {
    reviewer(['kepsek'])
    expect(await submit()).toHaveProperty('error')
    runtime.userId = 'wali'; runtime.roles = ['wali_kelas']
    expect(await submit()).toHaveProperty('success')
    expect(await submit('HADIR')).toHaveProperty('error')
    expect(await snapshot()).toMatchObject({ status_akhir: 'ALFA' })
  })
  it('approves once, queues the recheck atomically, and gives a new Alfa precedence', async () => {
    expect(await submit()).toHaveProperty('success')
    reviewer()
    expect(await listAttendanceCorrectionQueue()).toMatchObject({ pending: 1 })
    expect(await getAttendanceCorrectionReview(requestId())).toMatchObject({
      data: { current: 'ALFA', proposed: 'SAKIT', blocks: [{ mapel: 'Matematika' }], requester: 'Wali' },
    })
    const decisions = await Promise.all([
      decideAttendanceCorrection(requestId(), 'APPROVED', 'Diperiksa'),
      decideAttendanceCorrection(requestId(), 'APPROVED', 'Diperiksa'),
    ])
    expect(decisions.filter(result => result.success)).toHaveLength(1)
    expect(messages().filter(message => message.eventKey === ATTENDANCE_CORRECTION_RESULT_EVENT)).toHaveLength(1)
    expect(await snapshot()).toMatchObject({ status_akhir: 'SAKIT', approved_correction: true })
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM notification_dispatches WHERE event_key='attendance_source_changed'").get()?.total).toBe(1)
    expect(sqlite.prepare('SELECT status FROM absensi_siswa').get()?.status).toBe('ALFA')
    raw('ALFA', 'language')
    expect(await snapshot()).toMatchObject({ status_akhir: 'ALFA', approved_correction: false })
  })
  it('publishes an approved daily update after the original Alfa report and recap', async () => {
    setTime('2026-10-02T04:00:00Z')
    expect((await initial()).sent).toBeGreaterThan(0)
    setTime('2026-10-02T05:00:00Z')
    await dispatchAttendanceDailyNotices(runtime.db)
    expect(messages().at(-1)).toMatchObject({ eventKey: 'attendance_daily_final' })
    expect((await consume()).sent).toBeGreaterThan(0)
    expect(await submit('HADIR')).toHaveProperty('success')
    reviewer()
    expect(await decideAttendanceCorrection(requestId(), 'APPROVED', '')).toHaveProperty('success')
    const work = messages().find(message => message.eventKey === 'attendance_source_changed')
    expect(work).toBeDefined()
    await consume(work!)
    expect(messages().at(-1)).toMatchObject({ eventKey: 'attendance_daily_update', body: expect.stringContaining('Hadir') })
    setTime('2026-10-02T05:05:01Z')
    expect((await consume()).sent).toBeGreaterThan(0)
    expect(await snapshot()).toMatchObject({ status_akhir: 'HADIR' })
  })
  it('limits review to authorized positions and self-approval to Super Admin', async () => {
    await submit()
    reviewer(['wakamad'], 'wali')
    expect(await listAttendanceCorrectionQueue()).toHaveProperty('error')
    sqlite.exec("UPDATE \"user\" SET jabatan_struktural_id='jbt_waka_kurikulum' WHERE id='wali'")
    expect(await listAttendanceCorrectionQueue()).toMatchObject({ pending: 1 })
    expect(await decideAttendanceCorrection(requestId(), 'APPROVED', '')).toHaveProperty('error')
    reviewer(['kepsek'], 'wali')
    expect(await listAttendanceCorrectionQueue()).toMatchObject({ pending: 1 })
    expect(await decideAttendanceCorrection(requestId(), 'APPROVED', '')).toHaveProperty('error')
    reviewer(['admin_tu'])
    expect(await listAttendanceCorrectionQueue()).toHaveProperty('error')
    reviewer(['super_admin'], 'wali')
    expect(await decideAttendanceCorrection(requestId(), 'APPROVED', '')).toHaveProperty('success')
  })
  it('keeps Alfa after a rejection and requires a new request for changed evidence', async () => {
    await submit()
    reviewer(['kepsek'])
    expect(await decideAttendanceCorrection(requestId(), 'REJECTED', ' ')).toHaveProperty('error')
    expect(await decideAttendanceCorrection(requestId(), 'REJECTED', 'Perlu klarifikasi guru')).toHaveProperty('success')
    expect(await snapshot()).toMatchObject({ status_akhir: 'ALFA' })
    reviewer(['wali_kelas'], 'wali')
    await submit()
    raw('ALFA', 'language')
    reviewer()
    expect(await getAttendanceCorrectionReview(requestId())).toMatchObject({ data: { stale: true } })
    expect(await decideAttendanceCorrection(requestId(), 'APPROVED', '')).toHaveProperty('success')
    expect(sqlite.prepare('SELECT status FROM attendance_correction_requests ORDER BY rowid DESC').get()?.status).toBe('STALE')
    expect(await snapshot()).toMatchObject({ status_akhir: 'ALFA' })
  })
  it.each(['ALFA', 'SAKIT', 'IZIN'])('ignores legacy Hadir when its source says %s, while retaining the record', async status => {
    raw(status)
    sqlite.prepare("INSERT INTO keterangan_absensi_wali_kelas (siswa_id,tanggal,status,keterangan) VALUES ('s',?,'HADIR','Catatan lama')").run(date)
    expect(await snapshot()).toMatchObject({ status_akhir: status, wali_status: null })
    expect(sqlite.prepare('SELECT status,keterangan FROM keterangan_absensi_wali_kelas').get())
      .toMatchObject({ status: 'HADIR', keterangan: 'Catatan lama' })
    expect(messages()).toHaveLength(0)
  })
})

describe('daily attendance from real source rows', () => {
  it('presents wali correction separately without changing teacher session or official permission records', async () => {
    raw('ALFA'); raw('HADIR','language')
    sqlite.prepare('INSERT INTO keterangan_absensi_wali_kelas (siswa_id,tanggal,status,keterangan) VALUES (?,?,?,NULL)').run('s',date,'SAKIT')
    setTime('2026-10-02T05:00:00Z')
    const {parentDailyReason} = await import('./parent-attendance-presentation')
    const day = (await snapshot())!
    expect(parentDailyReason(day)).toContain('koreksi wali kelas')
    expect(day.detail_guru.some(detail => detail.sumber === 'guru' && detail.status === 'ALFA')).toBe(true)
    expect(sqlite.prepare('SELECT status FROM absensi_siswa WHERE penugasan_id=?').get('math')?.status).toBe('ALFA')
  })
  it('waits until the last effective slot, then uses one Alfa with pending input', async () => {
    raw('ALFA')
    expect(await snapshot()).toMatchObject({ status_akhir: 'BELUM_ADA_DATA', is_daily_final: false, pending_blok: 1 })
    setTime('2026-10-02T05:00:00Z')
    expect(await snapshot()).toMatchObject({ status_akhir: 'ALFA', is_daily_final: true, pending_blok: 1, kbm_end_at: `${date}T12:00:00+07:00` })
  })
  it('never finalizes early even with a wali decision and all sessions submitted', async () => {
    raw('ALFA'); raw('HADIR','language')
    sqlite.prepare('INSERT INTO keterangan_absensi_wali_kelas (siswa_id,tanggal,status,keterangan) VALUES (?,?,?,NULL)').run('s',date,'HADIR')
    expect(await snapshot()).toMatchObject({ status_akhir: 'BELUM_ADA_DATA', is_daily_final: false })
    setTime('2026-10-02T05:00:00Z')
    expect(await snapshot()).toMatchObject({ status_akhir: 'ALFA', sumber_status: 'guru' })
  })
  it.each([['Kegiatan','HADIR'],['SAKIT (DI UKS)','SAKIT']])('full-day permission %s becomes %s and retains session detail', async (reason, expected) => {
    raw('ALFA')
    sqlite.prepare('INSERT INTO izin_tidak_masuk_kelas VALUES (?,?,?,NULL,NULL,?,?)').run('s',date,reason,'teacher','2026-10-02T04:00:00Z')
    setTime('2026-10-02T05:00:00Z')
    const day = await snapshot()
    expect(day).toMatchObject({ status_akhir: expected, sumber_status: 'perizinan_siswa', submitted_blok: 2 })
    expect(day?.detail_guru.some(row => row.status === 'ALFA' && row.sumber === 'guru')).toBe(true)
  })
  it('partial official permission masks Alfa on that block but does not mask Izin from another teacher', async () => {
    raw('ALFA'); raw('IZIN','language')
    sqlite.prepare('INSERT INTO izin_tidak_masuk_kelas VALUES (?,?,?,NULL,?,?,?)').run('s',date,'Kegiatan','[1]','teacher','2026-10-02T04:00:00Z')
    setTime('2026-10-02T05:00:00Z')
    expect(await snapshot()).toMatchObject({ status_akhir: 'IZIN' })
  })
  it('school full-day present priority survives a wali Alfa decision', async () => {
    raw('ALFA')
    sqlite.exec("INSERT INTO alasan_izin_kelas VALUES ('Lomba',1)")
    sqlite.prepare('INSERT INTO izin_tidak_masuk_kelas VALUES (?,?,?,NULL,NULL,?,?)').run('s',date,'Lomba','teacher','2026-10-02T04:00:00Z')
    sqlite.prepare('INSERT INTO keterangan_absensi_wali_kelas (siswa_id,tanggal,status,keterangan) VALUES (?,?,?,NULL)').run('s',date,'ALFA')
    setTime('2026-10-02T05:00:00Z')
    expect(await snapshot()).toMatchObject({ status_akhir: 'HADIR', sumber_status: 'perizinan_sekolah' })
  })
  it('excludes holidays, deactivated classes, and excepted slots from the end time', async () => {
    raw('ALFA'); runtime.excepted = [5,6]
    expect(await snapshot()).toMatchObject({ status_akhir: 'ALFA', total_blok: 1, kbm_end_at: `${date}T08:00:00+07:00` })
    runtime.effective = false; invalidateAttendanceCache(); expect(await snapshot()).toBeUndefined()
    runtime.effective = true; sqlite.prepare('UPDATE kelas SET kbm_nonaktif_mulai = ?').run(date)
    invalidateAttendanceCache(); expect(await snapshot()).toBeUndefined()
  })
  it('requires end time today, while old dates use the new priority without end time', async () => {
    raw('ALFA')
    sqlite.exec("UPDATE tahun_ajaran SET jam_pelajaran='[]'")
    expect((await snapshot())?.status_reason).toContain('Jam pelajaran perlu dilengkapi')
    setTime('2026-10-03T00:00:00Z')
    expect(await snapshot()).toMatchObject({ status_akhir: 'ALFA', is_daily_final: true })
  })
  it('expires the temporary cache at the final clock minute without a new submission', async () => {
    raw('ALFA'); setTime('2026-10-02T04:59:59Z')
    expect((await snapshot())?.is_daily_final).toBe(false)
    vi.setSystemTime(new Date('2026-10-02T05:00:00Z'))
    expect((await snapshot())?.is_daily_final).toBe(true)
  })
  it('treats an overlapping exit permission as present for the daily aggregate', async () => {
    raw('ALFA')
    sqlite.prepare('INSERT INTO izin_keluar_komplek VALUES (?,?,?,?,?)')
      .run('s','Keperluan resmi', `${date}T07:00:00+07:00`,`${date}T08:00:00+07:00`,'teacher')
    setTime('2026-10-02T05:00:00Z')
    expect(await snapshot()).toMatchObject({ status_akhir: 'HADIR', pending_blok: 1 })
  })
})

describe('delayed attendance delivery and daily revisions', () => {
  it.each(['ALFA','SAKIT','IZIN'])('queues %s for five minutes with neutral session context', async status => {
    raw(status)
    await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    expect(runtime.queue).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining(initialAttendanceContext(status)), level: 'info' }), { contentType: 'json', delaySeconds: 300 })
    expect((await consume()).retry).toBe(true)
    expect(runtime.fcm).not.toHaveBeenCalled()
    setTime('2026-10-02T04:05:00Z')
    expect((await consume()).sent).toBeGreaterThan(0)
    expect((await consume()).sent).toBe(0)
    expect(runtime.fcm).toHaveBeenCalledTimes(1)
  })
  it('claims a single initial candidate across concurrent saves and different sessions', async () => {
    raw('ALFA'); raw('SAKIT','language')
    await Promise.all([1,2,3].map(() => notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })))
    expect(messages()).toHaveLength(1)
    setTime('2026-10-02T04:05:01Z'); await consume()
    raw('IZIN','language')
    await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'language', tanggal: date })
    expect(messages()).toHaveLength(1)
  })
  it('cancels a corrected session without validating against another Alfa session, then permits a new candidate', async () => {
    raw('ALFA')
    await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    const cancelled = messages()[0]
    setTime('2026-10-02T04:01:00Z'); raw('HADIR'); raw('ALFA','language')
    setTime('2026-10-02T04:05:01Z')
    expect(await consume(cancelled)).toMatchObject({ skipped: true })
    expect(runtime.fcm).not.toHaveBeenCalled()
    await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'language', tanggal: date })
    expect(messages()).toHaveLength(2)
    expect(messages()[1].body).toContain('Bahasa')
    expect(await consume(messages()[1])).toMatchObject({ retry: true })
    setTime('2026-10-02T04:06:00Z'); expect((await consume(messages()[1])).sent).toBeGreaterThan(0)
  })
  it('suppresses a queued report after official permission covers the session', async () => {
    raw('ALFA')
    await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    sqlite.prepare('INSERT INTO izin_tidak_masuk_kelas VALUES (?,?,?,NULL,?,?,?)').run('s',date,'Kegiatan','[1]','teacher','2026-10-02T04:00:00Z')
    setTime('2026-10-02T04:05:01Z'); expect(await consume()).toMatchObject({ skipped: true })
    expect(runtime.fcm).not.toHaveBeenCalled()
  })
  it('never replays pre-activation sources, old dates, or legacy queue messages', async () => {
    raw('ALFA','math','2026-10-01T23:59:59Z')
    await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    expect(messages()).toHaveLength(0)
    expect(attendanceDateEligible('2026-10-01','2026-10-02T00:00:00Z',new Date())).toBe(false)
    expect(attendanceDateEligible('2026-10-02','2026-10-01T17:00:00Z',new Date())).toBe(true)
    raw('ALFA'); await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    const legacy = { ...messages()[0], validation: { kind: 'attendance_status', tanggal: date, status: 'ALFA' } } as NotificationQueueMessage
    setTime('2026-10-02T04:05:00Z'); expect(await consume(legacy)).toMatchObject({ skipped: true })
    expect(runtime.fcm).not.toHaveBeenCalled()
    await notifyParentsDailyAttendanceFinal(runtime.db, { kelasId: 'class', tanggal: '2026-10-01' })
    expect(messages()).toHaveLength(1)
  })
  it('cron sends a final with pending input after KBM, and no final for an undelivered initial', async () => {
    raw('ALFA')
    await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    setTime('2026-10-02T05:00:00Z'); await dispatchAttendanceDailyNotices(runtime.db)
    expect(messages()).toHaveLength(1)
    await consume(messages()[0])
    await dispatchAttendanceDailyNotices(runtime.db)
    expect(messages()).toHaveLength(2)
    expect(messages()[1]).toMatchObject({ eventKey: 'attendance_daily_final', body: expect.stringContaining('1 sesi pelajaran belum diinput') })
    expect(messages()[1].body).toContain('Ini bukan berarti anak tidak hadir sepanjang hari.')
    setTime('2026-10-02T05:00:01Z'); await consume(messages()[1])
    await dispatchAttendanceDailyNotices(runtime.db); expect(messages()).toHaveLength(2)
  })
  it('uses monotonic revisions for Alfa → Hadir → Alfa without duplicates or note-only reports', async () => {
    raw('ALFA'); await initial()
    await notifyParentsDailyAttendanceFinal(runtime.db, { kelasId: 'class', tanggal: date })
    expect(messages()).toHaveLength(1)
    setTime('2026-10-02T05:00:00Z'); await dispatchAttendanceDailyNotices(runtime.db)
    setTime('2026-10-02T05:00:01Z'); await consume()
    setTime('2026-10-02T05:01:00Z'); raw('HADIR')
    await notifyParentsDailyAttendanceFinal(runtime.db, { kelasId: 'class', tanggal: date })
    expect(messages().at(-1)?.eventKey).toBe('attendance_daily_update')
    expect(runtime.queue.mock.calls.at(-1)?.[1].delaySeconds).toBe(300)
    setTime('2026-10-02T05:06:00Z'); await consume()
    raw('ALFA')
    await Promise.all([1,2].map(() => notifyParentsDailyAttendanceFinal(runtime.db, { kelasId: 'class', tanggal: date })))
    setTime('2026-10-02T05:11:00Z'); await consume()
    expect(sqlite.prepare('SELECT final_sent_status,final_sent_revision FROM attendance_parent_notice_state').get()).toMatchObject({ final_sent_status: 'ALFA', final_sent_revision: 3 })
    expect(runtime.fcm).toHaveBeenCalledTimes(4)
    raw('ALFA'); await dispatchAttendanceDailyNotices(runtime.db)
    expect(messages()).toHaveLength(4)
  })
  it('cancels an obsolete final update before delivering and checks latest completeness', async () => {
    raw('ALFA'); await initial()
    setTime('2026-10-02T05:00:00Z'); await dispatchAttendanceDailyNotices(runtime.db)
    setTime('2026-10-02T05:00:01Z'); await consume()
    raw('HADIR'); await notifyParentsDailyAttendanceFinal(runtime.db, { kelasId: 'class', tanggal: date })
    const stale = messages().at(-1)!
    setTime('2026-10-02T05:01:00Z'); raw('ALFA'); raw('HADIR','language')
    setTime('2026-10-02T05:05:02Z'); expect(await consume(stale)).toMatchObject({ skipped: true })
    await dispatchAttendanceDailyNotices(runtime.db)
    expect(runtime.fcm).toHaveBeenCalledTimes(2)
    expect(messages()).toHaveLength(3)
  })
  it('refreshes completeness before final delivery without generating a status update', async () => {
    raw('ALFA'); await initial()
    setTime('2026-10-02T05:00:00Z'); await dispatchAttendanceDailyNotices(runtime.db)
    expect(messages().at(-1)?.body).toContain('1 sesi pelajaran belum diinput')
    raw('HADIR','language')
    setTime('2026-10-02T05:00:01Z'); await consume()
    expect(runtime.fcm.mock.calls.at(-1)?.[0].body).not.toContain('belum diinput')
    await dispatchAttendanceDailyNotices(runtime.db)
    expect(messages()).toHaveLength(2)
  })
  it('retries a failed enqueue and preserves activation across repeated schema initialization', async () => {
    raw('ALFA'); runtime.queue.mockRejectedValueOnce(new Error('queue unavailable'))
    await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    expect(sqlite.prepare('SELECT status FROM notification_dispatches').get()?.status).toBe('failed')
    await dispatchAttendanceDailyNotices(runtime.db)
    expect(sqlite.prepare('SELECT status FROM notification_dispatches').get()?.status).toBe('queued')
    expect(sqlite.prepare('SELECT activated_at FROM attendance_notice_policy').get()?.activated_at).toBe('2026-10-02T00:00:00Z')
  })
  it('releases an obsolete candidate after enqueue failure even without a queue consumer', async () => {
    raw('ALFA'); runtime.queue.mockRejectedValueOnce(new Error('queue unavailable'))
    await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    setTime('2026-10-02T04:01:00Z'); raw('HADIR'); raw('SAKIT','language')
    await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'language', tanggal: date })
    expect(messages().at(-1)?.body).toContain('Bahasa')
    expect(sqlite.prepare('SELECT initial_revision FROM attendance_parent_notice_state').get()?.initial_revision).toBe(2)
    setTime('2026-10-02T04:06:00Z'); expect((await consume()).sent).toBeGreaterThan(0)
  })
  it('preserves custom templates while migrating untouched old defaults', async () => {
    sqlite.exec(readFileSync(new URL('../migrations/0086_add_notification_engine.sql', import.meta.url), 'utf8'))
    const oldBody = 'Ananda {nama_siswa} tercatat ALFA oleh guru pada {tanggal}. Rekap kehadiran harian masih diproses; silakan buka Portal Orang Tua untuk rincian.'
    sqlite.prepare(`INSERT INTO notification_event_settings
      (event_key,enabled,title_template,body_template,channels_json,target_json,reminder_json,level)
      VALUES ('attendance_parent_alert',1,'Laporan awal kehadiran',?,'["fcm","in_app"]','{"kind":"parent_students"}','{}','warning')`).run(oldBody)
    raw('ALFA')
    await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    const definition = getNotificationDefinition('attendance_parent_alert')!
    expect(sqlite.prepare("SELECT body_template FROM notification_event_settings WHERE event_key='attendance_parent_alert'").get()?.body_template).toBe(definition.defaultBody)
    // A fresh DB wrapper represents a new isolate, forcing template initialization.
    sqlite.exec("UPDATE notification_event_settings SET body_template='Pesan khusus {nama_siswa}' WHERE event_key='attendance_parent_alert'")
    runtime.db = { ...runtime.db }
    await dispatchAttendanceDailyNotices(runtime.db)
    expect(sqlite.prepare("SELECT body_template FROM notification_event_settings WHERE event_key='attendance_parent_alert'").get()?.body_template).toBe('Pesan khusus {nama_siswa}')
  })
  it.each(['attendance_daily_final','attendance_daily_update'])('upgrades only exact prior defaults for %s and keeps delivered messages', async key => {
    await getNotificationSetting(key,runtime.db)
    const definition = getNotificationDefinition(key)!
    const oldBody = key === 'attendance_daily_final'
      ? 'Pembelajaran pada {tanggal} telah selesai. Berdasarkan catatan yang tersedia, status harian Ananda {nama_siswa}: {status_kehadiran}.{kelengkapan} Rincian sesi tersedia di Portal Orang Tua.'
      : 'Rekap kehadiran Ananda {nama_siswa} pada {tanggal} telah diperbarui. Berdasarkan catatan terbaru, status harian: {status_kehadiran}.{kelengkapan} Rincian tersedia di Portal Orang Tua.'
    sqlite.prepare('UPDATE notification_event_settings SET body_template=? WHERE event_key=?').run(oldBody,key)
    sqlite.prepare('INSERT INTO parent_notifications VALUES (?,?,?,?,?,?)').run('s','absensi_rekap','Arsip','Pesan lama','sent','info')
    runtime.db = {...runtime.db}
    expect((await getNotificationSetting(key,runtime.db))?.body_template).toBe(definition.defaultBody)
    sqlite.prepare('UPDATE notification_event_settings SET body_template=?,title_template=? WHERE event_key=?').run(oldBody,'Judul khusus',key)
    runtime.db = {...runtime.db}
    expect((await getNotificationSetting(key,runtime.db))?.body_template).toBe(oldBody)
    sqlite.prepare('UPDATE notification_event_settings SET body_template=?,title_template=? WHERE event_key=?').run('Pesan khusus {nama_siswa}',definition.defaultTitle,key)
    runtime.db = {...runtime.db}
    expect((await getNotificationSetting(key,runtime.db))?.body_template).toBe('Pesan khusus {nama_siswa}')
    expect(sqlite.prepare('SELECT message FROM parent_notifications WHERE source_ref=?').get('sent')?.message).toBe('Pesan lama')
  })
  it('retries transient delivery with the same candidate and commits success only once', async () => {
    raw('ALFA'); await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    const message = { ...messages()[0], channels: ['fcm'] } as NotificationQueueMessage
    runtime.fcm.mockRejectedValueOnce(new Error('network timeout'))
    setTime('2026-10-02T04:05:00Z')
    expect(await consume(message)).toMatchObject({ retry: true })
    expect(sqlite.prepare('SELECT initial_sent_at FROM attendance_parent_notice_state').get()?.initial_sent_at).toBeNull()
    expect((await consume(message)).sent).toBe(1)
    expect((await consume(message)).sent).toBe(0)
    expect(runtime.fcm).toHaveBeenCalledTimes(2)
  })
  it('leases a queue dispatch so simultaneous consumers do not deliver twice', async () => {
    raw('ALFA'); await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    setTime('2026-10-02T04:05:00Z')
    await Promise.all([consume(messages()[0]),consume(messages()[0])])
    expect(runtime.fcm).toHaveBeenCalledTimes(1)
    expect((await consume(messages()[0])).sent).toBe(0)
  })
})


describe('homeroom attendance session notifications', () => {
  function assignWali() {
    sqlite.exec("INSERT INTO \"user\" (id,nama_lengkap) VALUES ('wali','Wali Kelas'); UPDATE kelas SET wali_kelas_id='wali'")
  }
  function staffMessages() { return messages().filter(m => m.eventKey === 'attendance_homeroom_alert') }
  async function enqueue() { return notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date }) }

  it.each(['ALFA','SAKIT','IZIN'])('queues %s to the student homeroom teacher via FCM immediately', async status => {
    assignWali(); raw(status); await enqueue()
    const staff = staffMessages()[0]
    expect(staff).toMatchObject({ target: { kind: 'staff_users', ids: ['wali'] }, channels: expect.arrayContaining(['fcm','in_app']),
      body: expect.stringContaining(initialAttendanceContext(status)), url: `/dashboard/kelas-binaan/koreksi?siswa=s&tanggal=${date}&penugasan=math` })
    expect((await consume(staff)).sent).toBeGreaterThan(0)
    expect(sqlite.prepare('SELECT user_id,title,message,url,read_at FROM staff_notifications').get()).toMatchObject({user_id:'wali',title:staff.title,message:staff.body,url:staff.url,read_at:null})
    await consume(staff)
    expect(sqlite.prepare('SELECT count(*) AS n FROM staff_notifications').get()?.n).toBe(1)
    setTime('2026-10-02T04:05:00Z')
    expect(runtime.fcm).toHaveBeenCalledWith(expect.objectContaining({ body: staff.body }), { userIds: ['wali'] }, expect.anything())
    expect(sqlite.prepare('SELECT initial_sent_at FROM attendance_parent_notice_state').get()?.initial_sent_at).toBeNull()
    expect((await consume(messages().find(m => m.eventKey === 'attendance_parent_alert')!)).sent).toBeGreaterThan(0)
  })

  it('works when parent notifications are disabled and does not create parent-report state', async () => {
    assignWali()
    await enqueue() // initialize defaults
    sqlite.exec("UPDATE notification_event_settings SET enabled=0 WHERE event_key='attendance_parent_alert'")
    setTime('2026-10-02T04:00:16Z'); raw('IZIN'); await enqueue()
    expect(messages()).toHaveLength(1)
    expect(staffMessages()).toHaveLength(1)
    expect(sqlite.prepare('SELECT count(*) AS n FROM attendance_parent_notice_state').get()?.n).toBe(0)
  })

  it('keeps a readable in-app report even without an active FCM device', async () => {
    assignWali(); raw('SAKIT'); await enqueue()
    runtime.fcm.mockResolvedValueOnce({success:true,sent:0})
    expect(await consume(staffMessages()[0])).toMatchObject({retry:false,sent:1})
    expect(sqlite.prepare('SELECT user_id,message FROM staff_notifications').get()).toMatchObject({user_id:'wali',message:expect.stringContaining('sakit')})
  })

  it('retries a failed inbox write rather than silently losing the report after successful push', async () => {
    assignWali(); raw('ALFA'); await enqueue()
    const originalBatch = runtime.db.batch.bind(runtime.db)
    runtime.db.batch = vi.fn().mockRejectedValueOnce(new Error('D1 temporarily unavailable'))
    expect(await consume(staffMessages()[0])).toMatchObject({retry:true})
    expect(sqlite.prepare('SELECT count(*) AS n FROM staff_notifications').get()?.n).toBe(0)
    runtime.db.batch = originalBatch
    expect(await consume(staffMessages()[0])).toMatchObject({retry:false})
    expect(sqlite.prepare('SELECT count(*) AS n FROM staff_notifications').get()?.n).toBe(1)
  })

  it('reports another session even after a parent initial has been sent; concurrent saves deduplicate', async () => {
    assignWali(); raw('ALFA')
    await Promise.all([enqueue(), enqueue(), enqueue()])
    expect(staffMessages()).toHaveLength(1)
    setTime('2026-10-02T04:05:01Z')
    await consume(staffMessages()[0]); await consume(messages().find(m => m.eventKey === 'attendance_parent_alert')!)
    raw('SAKIT', 'language'); await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'language', tanggal: date })
    expect(staffMessages()).toHaveLength(2)
    expect(messages().filter(m => m.eventKey === 'attendance_parent_alert')).toHaveLength(1)
    expect(staffMessages()[1].body).toContain('Bahasa')
  })

  it.each(['teacher','permission','homeroom'])('cancels a stale staff report after %s changes', async correction => {
    assignWali(); raw('ALFA'); await enqueue(); const staff = staffMessages()[0]
    if (correction === 'teacher') raw('HADIR')
    if (correction === 'permission') sqlite.prepare('INSERT INTO izin_tidak_masuk_kelas VALUES (?,?,?,NULL,?,?,?)').run('s',date,'Kegiatan','[1]','teacher','2026-10-02T04:00:00Z')
    if (correction === 'homeroom') sqlite.exec('UPDATE kelas SET wali_kelas_id=NULL')
    setTime('2026-10-02T04:05:00Z')
    expect(await consume(staff)).toMatchObject({ skipped: true, sent: 0 })
    expect(runtime.fcm).not.toHaveBeenCalled()
    // A staff cancellation cannot invalidate the parent's independent candidate.
    expect(sqlite.prepare('SELECT initial_ref FROM attendance_parent_notice_state').get()?.initial_ref).not.toBeNull()
  })

  it('claims concurrent consumers and retries FCM failures without duplicate success', async () => {
    assignWali(); raw('ALFA'); await enqueue(); const staff = staffMessages()[0]
    setTime('2026-10-02T04:05:00Z')
    runtime.fcm.mockResolvedValueOnce({ success: false, sent: 0, error: 'HTTP 503' })
    expect(await consume(staff)).toMatchObject({ retry: true })
    expect(sqlite.prepare('SELECT count(*) AS n FROM staff_notifications').get()?.n).toBe(1)
    runtime.fcm.mockResolvedValue({ success: true, sent: 1 })
    const results = await Promise.all([consume(staff), consume(staff)])
    expect(results.filter(result => result.sent > 0)).toHaveLength(1)
    expect(runtime.fcm).toHaveBeenCalledTimes(2)
    expect((await consume(staff)).sent).toBe(0)
    expect(sqlite.prepare('SELECT count(*) AS n FROM staff_notifications').get()?.n).toBe(1)
  })

  it('does not notify for ordinary present records or pre-activation data', async () => {
    assignWali(); raw('HADIR'); await enqueue(); expect(staffMessages()).toHaveLength(0)
    raw('ALFA','math','2026-10-01T23:59:59Z'); await enqueue(); expect(staffMessages()).toHaveLength(0)
  })

  it('recovers a failed enqueue using the existing dispatch ledger', async () => {
    assignWali(); raw('ALFA')
    runtime.queue.mockRejectedValueOnce(new Error('Queue unavailable'))
    await enqueue(); await enqueue()
    const staff = staffMessages()
    expect(staff).toHaveLength(2)
    expect(staff[0].dispatchId).toBe(staff[1].dispatchId)
  })
})
