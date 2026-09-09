import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { revalidatePath } from 'next/cache'

const state = vi.hoisted(() => ({ db: null as unknown as D1Database, actor: 'p', roles: ['pramubakti'], date: '2026-09-07', time: '07:05', uploads: 0, denied: false }))
vi.mock('server-only', () => ({}))
vi.mock('@/utils/db-server', () => ({ getDB: async () => state.db }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/action-security', () => ({ requireActionAccess: async () => { if (state.denied) throw new Error('Forbidden'); return { id: state.actor, roles: state.roles, kind: 'staff' } } }))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: async () => ({ id: state.actor }) }))
vi.mock('@/lib/features', () => ({ getUserRoles: async (_db: D1Database, id: string) => id === 'p' ? ['pramubakti'] : state.roles, checkFeatureAccess: async () => !state.denied }))
vi.mock('@/lib/act-as', () => ({ isSuperAdmin: async () => state.roles.includes('super_admin'), getEffectiveUser: async () => null }))
vi.mock('@/lib/tpg-schema', () => ({ ensureTpgSchema: async () => {}, ensureTpgSchemaInner: async () => {} }))
vi.mock('@/lib/time', () => ({ todayWIB: () => state.date, currentTimeWIB: () => ({ hhmm: state.time }), nowWIBISO: () => `${state.date}T${state.time}:00+07:00` }))
vi.mock('@/lib/system-settings', () => ({ SYSTEM_SETTING_KEYS: { agendaTimeRestriction: 'restricted', agendaLateEnabled: 'late', agendaLateThresholdMinutes: 'threshold' }, getSystemSettingBoolean: async () => true, getSystemSettingNumber: async () => 10, getSystemSetting: async () => '', setSystemSetting: async () => {} }))
vi.mock('@/utils/r2', () => ({ validateImageFile: (file: File) => file.type !== 'image/jpeg' ? 'Invalid image' : null, uploadToR2: async () => { state.uploads++; return { url: '/api/media/pramubakti/p/photo.jpg', error: null } }, deleteFromR2: vi.fn(), uploadCkhKepalaSignature: vi.fn() }))
import { submitPramubaktiReport } from '@/app/dashboard/pelaporan-pramubakti/actions'
import { correctPramubaktiReport, setPramubaktiLeave } from '@/app/dashboard/monitoring-pramubakti/actions'
import { savePramubaktiSettings } from '@/app/dashboard/settings/pramubakti/actions'
import { refreshCkhDraft, saveCkhDayPattern, getCkhPageData, acceptCkhSuggestion } from '@/app/dashboard/ckh-generator/actions'
import { getPbData, getPbCkhDates, requirePbAccess } from './pramubakti-db'

let sqlite: DatabaseSync
const migration = readFileSync('migrations/0096_pramubakti.sql', 'utf8')
const completedStatusMigration = readFileSync('migrations/0100_pramubakti_start_date_and_completed_status.sql', 'utf8')
beforeEach(() => {
  state.actor = 'p'; state.roles = ['pramubakti']; state.date = '2026-09-07'; state.time = '07:05'; state.uploads = 0; state.denied = false
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`CREATE TABLE "user"(id TEXT PRIMARY KEY,role TEXT,nama_lengkap TEXT,name TEXT,jabatan_struktural_id TEXT);
    CREATE TABLE user_roles(user_id TEXT,role TEXT,PRIMARY KEY(user_id,role));
    CREATE TABLE role_features(role TEXT,feature_id TEXT,PRIMARY KEY(role,feature_id));
    CREATE TABLE role_feature_permissions(role TEXT,feature_id TEXT,can_create INT,can_read INT,can_update INT,can_delete INT,PRIMARY KEY(role,feature_id));
    CREATE TABLE alasan_izin_guru(id TEXT PRIMARY KEY,nama TEXT,kepentingan_sekolah INT,aktif INT);
    INSERT INTO "user" VALUES('p','pramubakti','Pegawai','Pegawai',NULL),('other','guru','Other','Other',NULL),('admin','super_admin','Admin','Admin',NULL),('waka','wakamad','Sarana','Sarana','jbt_waka_sarpras');
    INSERT INTO alasan_izin_guru VALUES('school','Tugas dinas',1,1),('ordinary','Pribadi',0,1);`)
  sqlite.exec(migration)
  sqlite.exec("UPDATE pb_members SET start_date='2026-09-07'")
  sqlite.prepare('INSERT INTO pb_schedule_versions VALUES(?,?,?,?,?)').run('v', '2026-09-07', JSON.stringify([{ id: 'slot', weekday: 1, start: '07:00', end: '08:00' }]), 'admin', '')
  const ckh = readFileSync('migrations/0033_add_ckh_generator.sql', 'utf8')
  sqlite.exec(ckh.split('INSERT OR IGNORE INTO role_features')[0])
  sqlite.exec(`ALTER TABLE "user" ADD COLUMN nip TEXT; ALTER TABLE "user" ADD COLUMN pangkat_golongan TEXT; ALTER TABLE "user" ADD COLUMN signature_url TEXT;
    ALTER TABLE ckh_templates ADD COLUMN user_id TEXT;
    CREATE TABLE ckh_day_patterns(id TEXT,user_id TEXT,weekday INT,kegiatan_bulanan TEXT,catatan_harian TEXT,vol INT,satuan TEXT);
    CREATE TABLE master_jabatan_struktural(id TEXT,nama TEXT);
    ALTER TABLE ckh_documents ADD COLUMN signature_enabled INT DEFAULT 0;
    ALTER TABLE ckh_documents ADD COLUMN signature_x_mm REAL DEFAULT 14;
    ALTER TABLE ckh_documents ADD COLUMN signature_y_mm REAL DEFAULT 12;
    ALTER TABLE ckh_documents ADD COLUMN signature_width_mm REAL DEFAULT 38;
    ALTER TABLE ckh_documents ADD COLUMN kepala_signature_enabled INT DEFAULT 0;
    ALTER TABLE ckh_documents ADD COLUMN kepala_signature_x_mm REAL DEFAULT 14;
    ALTER TABLE ckh_documents ADD COLUMN kepala_signature_y_mm REAL DEFAULT 12;
    ALTER TABLE ckh_documents ADD COLUMN kepala_signature_width_mm REAL DEFAULT 38;`)
  function prepared(sql: string, args: SQLInputValue[] = []) {
    return { bind: (...values: SQLInputValue[]) => prepared(sql, values), all: async () => ({ results: sqlite.prepare(sql).all(...args) }), first: async () => sqlite.prepare(sql).get(...args) || null, run: async () => ({ meta: sqlite.prepare(sql).run(...args), success: true }), sql, args }
  }
  state.db = { prepare: prepared, batch: async (statements: ReturnType<typeof prepared>[]) => { sqlite.exec('BEGIN'); try { const results = []; for (const s of statements) results.push(await s.run()); sqlite.exec('COMMIT'); return results } catch (e) { sqlite.exec('ROLLBACK'); throw e } } } as unknown as D1Database
})
afterEach(() => sqlite.close())
function form(slot = 'slot') {
  const data = new FormData(); data.set('tanggal', state.date); data.set('slot_id', slot); data.set('request_id', crypto.randomUUID()); data.append('jobs', 'membersihkan'); data.set('tempat', 'Halaman'); data.set('foto', new File([new Uint8Array([255, 216, 255, 1])], 'photo.jpg', { type: 'image/jpeg' })); return data
}
function admin() { state.actor = 'admin'; state.roles = ['super_admin'] }
const leavePayload = { userId: 'p', start: '2026-09-07', end: '2026-09-07', slotIds: [], status: 'IZIN' as const, reasonId: 'school', note: 'Dinas', overrideReport: false }

describe('Pramubakti migration and server actions', () => {
  it('migration is repeatable and does not duplicate active membership', () => {
    sqlite.exec(migration)
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM pb_members').get()?.n).toBe(1)
  })
  it('tracks later role membership without generating retroactive obligations', () => {
    sqlite.exec("INSERT INTO user_roles VALUES('other','pramubakti')")
    expect(sqlite.prepare("SELECT start_date FROM pb_members WHERE user_id='other' AND end_date IS NULL").get()).toBeTruthy()
    sqlite.exec("DELETE FROM user_roles WHERE user_id='other'")
    expect(sqlite.prepare("SELECT id FROM pb_members WHERE user_id='other' AND end_date IS NULL").get()).toBeUndefined()
  })
  it('starts Pramubakti obligations on 9 September 2026 and normalizes legacy late reports', async () => {
    sqlite.exec(completedStatusMigration)
    expect(sqlite.prepare("SELECT start_date FROM pb_members WHERE user_id='p'").get()?.start_date).toBe('2026-09-09')
    expect((await getPbData(state.db, '2026-09-07', '2026-09-08', 'p')).items).toHaveLength(0)
    sqlite.exec("INSERT INTO pb_reports(id,user_id,tanggal,slot_id,jobs_json,tempat,foto_url,waktu_input,status,actor_id) VALUES('legacy','p','2026-09-07','slot','[\"Membersihkan\"]','Halaman','/foto.jpg','2026-09-07T07:30:00+07:00','TELAT','p')")
    sqlite.exec(completedStatusMigration)
    expect(sqlite.prepare('SELECT status FROM pb_reports').get()?.status).toBe('TEPAT_WAKTU')
  })
  it('rejects incomplete, historical, forged-slot and inactive-job submissions before upload', async () => {
    for (const mutate of [(f: FormData) => f.delete('foto'), (f: FormData) => f.delete('jobs'), (f: FormData) => f.set('tempat', ''), (f: FormData) => f.set('tanggal', '2026-09-06'), (f: FormData) => f.set('slot_id', 'fake'), (f: FormData) => f.set('jobs', 'fake')]) { const f = form(); mutate(f); expect((await submitPramubaktiReport(f)).error).toBeTruthy() }
    expect(state.uploads).toBe(0)
  })
  it('accepts both stable job IDs and job names from a cached client', async () => {
    const cachedClientForm = form()
    cachedClientForm.set('jobs', 'Membersihkan')
    expect((await submitPramubaktiReport(cachedClientForm)).success).toBeTruthy()
    expect(JSON.parse(String(sqlite.prepare('SELECT jobs_json FROM pb_reports').get()?.jobs_json))).toEqual(['Membersihkan'])
  })
  it('uses authenticated ownership and makes repeated request IDs idempotent', async () => {
    const f = form(); f.set('user_id', 'other')
    expect((await submitPramubaktiReport(f)).success).toBeTruthy()
    expect((await submitPramubaktiReport(f)).success).toBeTruthy()
    expect(sqlite.prepare('SELECT user_id FROM pb_reports').get()?.user_id).toBe('p')
    expect(state.uploads).toBe(1)
    expect((await submitPramubaktiReport(form())).error).toBeTruthy()
  })
  it('allows multiple additional reports on non-workdays', async () => {
    state.date = '2026-09-06'; state.time = '23:59'
    expect((await submitPramubaktiReport(form(''))).success).toBeTruthy()
    expect((await submitPramubaktiReport(form(''))).success).toBeTruthy()
    expect(sqlite.prepare('SELECT COUNT(*) n FROM pb_reports').get()?.n).toBe(2)
  })
  it('requires explicit override for attendance conflicts, preserves evidence and supports cancellation', async () => {
    await submitPramubaktiReport(form()); admin()
    expect((await setPramubaktiLeave(leavePayload)).error).toMatch(/konfirmasi/)
    expect((await setPramubaktiLeave({ ...leavePayload, overrideReport: true })).success).toBeTruthy()
    const data = await getPbData(state.db, state.date, state.date, 'p')
    expect(data.items[0].status).toBe('IZIN'); expect(data.items[0].report).toBeTruthy()
    expect(await getPbCkhDates(state.db, 'p', state.date, state.date)).toEqual([])
    expect((await setPramubaktiLeave({ ...leavePayload, status: 'BATAL' })).success).toBeTruthy()
    expect((await getPbData(state.db, state.date, state.date, 'p')).items[0].status).toBe('TEPAT_WAKTU')
  })
  it('prevents a report from racing an already-recorded leave', async () => {
    admin(); await setPramubaktiLeave(leavePayload)
    state.actor = 'p'; state.roles = ['pramubakti']
    expect((await submitPramubaktiReport(form())).error).toBeTruthy()
  })
  it('enforces role and structural assignment for monitor writes', async () => {
    await expect(requirePbAccess('monitor', true)).rejects.toThrow()
    state.actor = 'waka'; state.roles = ['wakamad']; await expect(requirePbAccess('monitor', true)).resolves.toBeTruthy()
    sqlite.exec("UPDATE \"user\" SET jabatan_struktural_id='jbt_waka_humas' WHERE id='waka'")
    await expect(requirePbAccess('monitor', true)).rejects.toThrow()
    state.roles = ['kepsek']; await expect(requirePbAccess('monitor')).resolves.toBeTruthy(); await expect(requirePbAccess('monitor', true)).rejects.toThrow()
    state.denied = true; await expect(requirePbAccess('monitor')).rejects.toThrow('Forbidden')
  })
  it('rejects same-day schedule changes and preserves older job names', async () => {
    await submitPramubaktiReport(form()); admin()
    expect((await savePramubaktiSettings({ type: 'schedule', effective_date: state.date, slots: [] })).error).toBeTruthy()
    expect((await savePramubaktiSettings({ type: 'job', job: { id: 'membersihkan', name: 'Nama baru', sort_order: 1, active: 0 } })).success).toBeTruthy()
    expect(JSON.parse(String(sqlite.prepare('SELECT jobs_json FROM pb_reports').get()?.jobs_json))).toEqual(['Membersihkan'])
  })
  it('audits corrections and rejects a stale revision', async () => {
    const f = form(); await submitPramubaktiReport(f); admin()
    const payload = { id: String(f.get('request_id')), revision: 1, jobs: ['Membersihkan'], tempat: 'Koridor', status: 'TEPAT_WAKTU' as const, reason: 'Perbaikan tempat' }
    expect((await correctPramubaktiReport(payload)).success).toBeTruthy()
    expect((await correctPramubaktiReport(payload)).error).toMatch(/berubah/)
    expect(sqlite.prepare("SELECT COUNT(*) n FROM pb_audit WHERE action='report.correct'").get()?.n).toBe(1)
  })
})

describe('CKH integration with Pramubakti sources', () => {
  it('opening a draft syncs new sources but opening a final document does not change it', async () => {
    sqlite.exec("INSERT INTO ckh_documents(id,user_id,year,month) VALUES('doc','p',2026,9)")
    await submitPramubaktiReport(form())
    vi.mocked(revalidatePath).mockClear()
    const draft = await getCkhPageData(2026, 9)
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(draft.rows.some(r => r.source_key?.startsWith('pramubakti:'))).toBe(true)
    sqlite.exec("UPDATE ckh_documents SET status='FINAL' WHERE id='doc'")
    await submitPramubaktiReport(form(''))
    const final = await getCkhPageData(2026, 9)
    expect(final.document.status).toBe('FINAL')
    expect(final.rows).toEqual(draft.rows)
  })
  it('removes invalidated automatic rows and asks before removing a manually edited source', async () => {
    sqlite.exec("INSERT INTO ckh_documents(id,user_id,year,month) VALUES('doc','p',2026,9)")
    await submitPramubaktiReport(form()); await refreshCkhDraft('doc')
    const row = sqlite.prepare("SELECT id FROM ckh_rows WHERE source_key LIKE 'pramubakti:%'").get()!
    sqlite.prepare("UPDATE ckh_rows SET is_manual=1,catatan_harian='Edited' WHERE id=?").run(row.id)
    admin(); await setPramubaktiLeave({ ...leavePayload, overrideReport: true }); state.actor = 'p'; state.roles = ['pramubakti']
    await refreshCkhDraft('doc')
    expect(sqlite.prepare('SELECT has_conflict FROM ckh_rows WHERE id=?').get(row.id)?.has_conflict).toBe(1)
    expect((await acceptCkhSuggestion(String(row.id)))).toMatchObject({ removed: true })
    expect(sqlite.prepare('SELECT id FROM ckh_rows WHERE id=?').get(row.id)).toBeUndefined()
  })
  it('syncs holiday extras once and preserves manual edits as conflicts', async () => {
    const f = form(''); await submitPramubaktiReport(f)
    sqlite.exec("INSERT INTO ckh_documents(id,user_id,year,month) VALUES('doc','p',2026,9)")
    expect((await refreshCkhDraft('doc')).success).toBeTruthy()
    await refreshCkhDraft('doc')
    const key = `pramubakti:${String(f.get('request_id'))}`
    expect(sqlite.prepare('SELECT COUNT(*) n FROM ckh_rows WHERE source_key=?').get(key)?.n).toBe(1)
    sqlite.prepare("UPDATE ckh_rows SET catatan_harian='Catatan manual',is_manual=1 WHERE source_key=?").run(key)
    await refreshCkhDraft('doc')
    expect(sqlite.prepare('SELECT catatan_harian,has_conflict FROM ckh_rows WHERE source_key=?').get(key)).toMatchObject({ catatan_harian: 'Catatan manual', has_conflict: 1 })
  })
  it('refuses saving day patterns for Pramubakti at the server', async () => {
    expect((await saveCkhDayPattern({ weekday: 1, kegiatan_bulanan: 'Pola', catatan_harian: 'Pola' })).error).toMatch(/tanpa Pola/)
  })
})
