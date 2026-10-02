import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { readFileSync } from 'node:fs'

const runtime = vi.hoisted(() => ({ db: null as unknown as D1Database, queue: vi.fn(), fcm: vi.fn(), effective: true, excepted: [] as number[], userId: 'wali', roles: [] as string[] }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: async () => runtime.userId ? { id: runtime.userId } : null }))
vi.mock('@/lib/features', () => ({ getUserRoles: async () => runtime.roles }))
vi.mock('@/lib/activity-log', () => ({ logActivity: vi.fn(), ensureActivityLogTables: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/utils/db-server', () => ({ getDB: async () => runtime.db }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: { NOTIFICATION_QUEUE: { send: runtime.queue } } }) }))
vi.mock('@/lib/schema-guard', () => ({ ensureSchemaOnce: async (_key: string, ensure: () => Promise<unknown>) => ensure() }))
vi.mock('@/lib/fcm', () => ({ sendFcmNotification: runtime.fcm }))
vi.mock('@/lib/web-push', () => ({ sendPushNotification: vi.fn() }))
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
import { invalidateAttendanceCache } from './attendance-cache'
import { attendanceDateEligible, initialAttendanceContext } from './attendance-notice-state'
import { notifyParentsAttendanceConfigured, notifyParentsDailyAttendanceFinal, dispatchAttendanceDailyNotices, processNotificationQueueMessage, prepareAttendanceNotificationWork, flushAttendanceNotificationOutbox, saveNotificationSetting, getNotificationSetting, type NotificationQueueMessage } from './notification-engine'
import { getNotificationDefinition } from './notification-catalog'
import { getKoreksiAbsensiCepat, simpanKoreksiAbsensiCepat } from '@/app/dashboard/kelas-binaan/attendance-actions'

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
  runtime.userId = 'wali'; runtime.roles = []
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE "user" (id TEXT PRIMARY KEY, nama_lengkap TEXT, banned INTEGER DEFAULT 0);
    CREATE TABLE kelas (id TEXT PRIMARY KEY, tingkat INTEGER, nomor_kelas TEXT, kelompok TEXT, wali_kelas_id TEXT, kbm_nonaktif_mulai TEXT);
    CREATE TABLE siswa (id TEXT PRIMARY KEY, kelas_id TEXT, status TEXT, nama_lengkap TEXT, nisn TEXT, nis_lokal TEXT, jenis_kelamin TEXT, foto_url TEXT);
    CREATE TABLE tahun_ajaran (id TEXT PRIMARY KEY, jam_pelajaran TEXT, is_active INTEGER);
    CREATE TABLE mata_pelajaran (id TEXT PRIMARY KEY, nama_mapel TEXT);
    CREATE TABLE penugasan_mengajar (id TEXT PRIMARY KEY, kelas_id TEXT, mapel_id TEXT, guru_id TEXT);
    CREATE TABLE jadwal_mengajar (hari INTEGER, jam_ke INTEGER, penugasan_id TEXT, tahun_ajaran_id TEXT);
    CREATE TABLE absensi_siswa (siswa_id TEXT, penugasan_id TEXT, tanggal TEXT, status TEXT, catatan TEXT, jam_ke_mulai INTEGER, jam_ke_selesai INTEGER, diinput_oleh TEXT, updated_at TEXT, UNIQUE(siswa_id,penugasan_id,tanggal));
    CREATE TABLE keterangan_absensi_wali_kelas (siswa_id TEXT,tanggal TEXT,status TEXT,keterangan TEXT);
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
    INSERT INTO tahun_ajaran VALUES ('year','[{"hari":[5],"slots":[{"id":1,"mulai":"07:00","selesai":"07:30"},{"id":2,"mulai":"07:30","selesai":"08:00"},{"id":5,"mulai":"11:00","selesai":"11:30"},{"id":6,"mulai":"11:30","selesai":"12:00"}]}]',1);
  `)
  sqlite.exec(readFileSync(new URL('../migrations/0114_attendance_parent_notice_state.sql', import.meta.url), 'utf8'))
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
  it.each(['SAKIT','IZIN','HADIR'])('re-reads a wali %s correction without restarting the parent delay', async status => {
    raw('ALFA'); await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    const message = messages()[0]
    sqlite.prepare('INSERT INTO keterangan_absensi_wali_kelas VALUES (?,?,?,NULL)').run('s',date,status)
    setTime('2026-10-02T04:05:00Z')
    const result = await consume(message)
    if (status === 'HADIR') {
      expect(result).toMatchObject({ skipped: true, sent: 0 }); expect(runtime.fcm).not.toHaveBeenCalled()
      expect(sqlite.prepare('SELECT initial_sent_at FROM attendance_parent_notice_state').get()?.initial_sent_at).toBeNull()
    } else {
      expect(result.sent).toBeGreaterThan(0)
      expect(runtime.fcm).toHaveBeenCalledWith(expect.objectContaining({ body: expect.stringContaining(status.toLowerCase()) }), expect.anything(), expect.anything())
      expect(runtime.fcm.mock.calls[0][0].body).toContain('wali kelas')
    }
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
    sqlite.exec(`UPDATE kelas SET wali_kelas_id='wali';
      DROP TABLE keterangan_absensi_wali_kelas;
      CREATE TABLE keterangan_absensi_wali_kelas (id TEXT,siswa_id TEXT,tanggal TEXT,status TEXT,keterangan TEXT,dibuat_oleh TEXT,updated_at TEXT,UNIQUE(siswa_id,tanggal));
      ALTER TABLE parent_notifications ADD COLUMN archived_at TEXT;`)
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
  it('saves a separate wali correction and durable work while preserving the original teacher row', async () => {
    const { data } = await getKoreksiAbsensiCepat('s',date,'math')
    expect(data).toMatchObject({ statusGuru:'ALFA',isFinal:false, pendingBlocks:1 })
    expect(await simpanKoreksiAbsensiCepat({ siswaId:'s',tanggal:date,penugasanId:'math',status:'SAKIT',keterangan:'Dikonfirmasi',revision:data!.revision })).toHaveProperty('success')
    expect(sqlite.prepare('SELECT status FROM absensi_siswa').get()?.status).toBe('ALFA')
    expect(sqlite.prepare('SELECT status,keterangan FROM keterangan_absensi_wali_kelas').get()).toMatchObject({status:'SAKIT',keterangan:'Dikonfirmasi'})
    expect(messages().filter(m => m.validation?.kind === 'attendance_work')).toHaveLength(1)
  })
})

describe('daily attendance from real source rows', () => {
  it('waits until the last effective slot, then uses one Alfa with pending input', async () => {
    raw('ALFA')
    expect(await snapshot()).toMatchObject({ status_akhir: 'BELUM_ADA_DATA', is_daily_final: false, pending_blok: 1 })
    setTime('2026-10-02T05:00:00Z')
    expect(await snapshot()).toMatchObject({ status_akhir: 'ALFA', is_daily_final: true, pending_blok: 1, kbm_end_at: `${date}T12:00:00+07:00` })
  })
  it('never finalizes early even with a wali decision and all sessions submitted', async () => {
    raw('ALFA'); raw('HADIR','language')
    sqlite.prepare('INSERT INTO keterangan_absensi_wali_kelas VALUES (?,?,?,NULL)').run('s',date,'HADIR')
    expect(await snapshot()).toMatchObject({ status_akhir: 'BELUM_ADA_DATA', is_daily_final: false })
    setTime('2026-10-02T05:00:00Z')
    expect(await snapshot()).toMatchObject({ status_akhir: 'HADIR', sumber_status: 'koreksi_wali_kelas' })
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
    sqlite.prepare('INSERT INTO keterangan_absensi_wali_kelas VALUES (?,?,?,NULL)').run('s',date,'ALFA')
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
  it.each(['permission','wali'])('suppresses a queued report after %s correction', async correction => {
    raw('ALFA')
    await notifyParentsAttendanceConfigured(runtime.db, { penugasanId: 'math', tanggal: date })
    if (correction === 'permission') sqlite.prepare('INSERT INTO izin_tidak_masuk_kelas VALUES (?,?,?,NULL,?,?,?)').run('s',date,'Kegiatan','[1]','teacher','2026-10-02T04:00:00Z')
    else sqlite.prepare('INSERT INTO keterangan_absensi_wali_kelas VALUES (?,?,?,NULL)').run('s',date,'HADIR')
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
    expect(messages()[1]).toMatchObject({ eventKey: 'attendance_daily_final', body: expect.stringContaining('1 blok pelajaran belum diinput') })
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
    expect(messages().at(-1)?.body).toContain('1 blok pelajaran belum diinput')
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
    expect(staff).toMatchObject({ target: { kind: 'staff_users', ids: ['wali'] }, channels: expect.arrayContaining(['fcm']),
      body: expect.stringContaining(initialAttendanceContext(status)), url: `/dashboard/kelas-binaan/koreksi?siswa=s&tanggal=${date}&penugasan=math` })
    expect((await consume(staff)).sent).toBeGreaterThan(0)
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

  it.each(['teacher','permission','wali','homeroom'])('cancels a stale staff report after %s changes', async correction => {
    assignWali(); raw('ALFA'); await enqueue(); const staff = staffMessages()[0]
    if (correction === 'teacher') raw('HADIR')
    if (correction === 'permission') sqlite.prepare('INSERT INTO izin_tidak_masuk_kelas VALUES (?,?,?,NULL,?,?,?)').run('s',date,'Kegiatan','[1]','teacher','2026-10-02T04:00:00Z')
    if (correction === 'wali') sqlite.prepare('INSERT INTO keterangan_absensi_wali_kelas VALUES (?,?,?,NULL)').run('s',date,'HADIR')
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
    runtime.fcm.mockResolvedValue({ success: true, sent: 1 })
    const results = await Promise.all([consume(staff), consume(staff)])
    expect(results.filter(result => result.sent > 0)).toHaveLength(1)
    expect(runtime.fcm).toHaveBeenCalledTimes(2)
    expect((await consume(staff)).sent).toBe(0)
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
