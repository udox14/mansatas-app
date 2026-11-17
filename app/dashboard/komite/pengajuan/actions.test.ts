import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reviewKomiteAction, setKomiteReviewerSettingAction, setKomiteActivityReportAction, deleteKomiteAction, deleteKomiteDraftAction, getKomiteDashboardData, mapHistoricalKomiteSpb } from './actions'

const state = vi.hoisted(() => ({ db: null as unknown as D1Database, roles: ['ketua_komite'],
  userId: 'chair', requirePrincipal: false, race: false, failWrite: false,
  emit: vi.fn(), log: vi.fn(), set: vi.fn() }))
vi.mock('@/utils/db-server', () => ({ getDB: async () => state.db }))
vi.mock('@/utils/auth/server', () => ({ getSession: async () => ({ user: { id: state.userId, name: 'Reviewer' } }) }))
vi.mock('@/lib/features', () => ({ checkFeatureAccess: async () => true, getUserRoles: async () => state.roles }))
vi.mock('@/lib/komite-pengajuan', async importOriginal => ({ ...await importOriginal<object>(), ensureKomitePengajuanSchema: async () => undefined }))
vi.mock('@/lib/system-settings', () => ({ SYSTEM_SETTING_KEYS: { komiteRequirePrincipalApproval: 'komite_require_principal_approval' },
  getSystemSettingBoolean: async () => state.requirePrincipal, setSystemSetting: state.set }))
vi.mock('@/lib/notification-engine', () => ({ emitConfiguredNotification: state.emit }))
vi.mock('@/lib/activity-log', () => ({ logActivity: state.log }))
vi.mock('@/utils/r2', () => ({ deleteKomiteObjects: vi.fn(), uploadKomitePdfs: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let sqlite: DatabaseSync
beforeEach(() => {
  state.roles = ['anggota_komite']; state.userId = 'delegate'; state.requirePrincipal = false
  state.race = false; state.failWrite = false
  state.emit.mockReset().mockResolvedValue({ status: 'sent' }); state.log.mockReset(); state.set.mockReset()
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`CREATE TABLE "user" (id TEXT PRIMARY KEY,name TEXT,nama_lengkap TEXT,email TEXT,signature_url TEXT);
    INSERT INTO "user" VALUES ('chair','Ketua',NULL,'chair@test',NULL),('applicant','Pengaju',NULL,'applicant@test',NULL),
      ('principal','Kepala',NULL,'principal@test',NULL),('delegate','Anggota',NULL,'delegate@test',NULL);
    CREATE TABLE komite_pengajuan (id TEXT PRIMARY KEY,judul TEXT,uraian TEXT,nominal INTEGER CHECK(nominal>0),pengaju_id TEXT,
      status TEXT,current_version INTEGER,nomor_spb TEXT,penerima_pembayaran TEXT,tahun_anggaran TEXT,kode_rkas_program TEXT,
      ketua_delegate_id TEXT,ketua_delegated_by TEXT,ketua_delegated_at TEXT,approved_at TEXT,final_approval_stage TEXT,
      rejected_at TEXT,updated_at TEXT);
    INSERT INTO komite_pengajuan VALUES ('p1','Kegiatan','Kebutuhan',100000,'applicant','menunggu_ketua',1,'001/SPB',
      'Penyedia','2026/2027','1.2',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-06 00:00:00');
    CREATE TABLE komite_pengajuan_reviews (id TEXT PRIMARY KEY,pengajuan_id TEXT,version_number INTEGER,stage TEXT,action TEXT,
      catatan TEXT,actor_id TEXT,actor_name TEXT,actor_role TEXT,actor_signature_url TEXT,is_super_admin_bypass INTEGER,
      nomor_spb_snapshot TEXT,penerima_snapshot TEXT);
    CREATE TABLE komite_pengajuan_rincian (id TEXT PRIMARY KEY,pengajuan_id TEXT,urutan INTEGER,uraian TEXT,
      penerima_penyedia TEXT,jumlah INTEGER);
    INSERT INTO komite_pengajuan_rincian VALUES ('original','p1',1,'Kebutuhan','Penyedia',100000);`)
  sqlite.exec(`ALTER TABLE "user" ADD COLUMN role TEXT;
    ALTER TABLE "user" ADD COLUMN banned INTEGER DEFAULT 0;
    UPDATE "user" SET role=CASE id WHEN 'chair' THEN 'ketua_komite' WHEN 'delegate' THEN 'anggota_komite' WHEN 'principal' THEN 'kepsek' ELSE 'wakamad' END;
    CREATE TABLE user_roles (user_id TEXT,role TEXT);
    CREATE TABLE system_settings (key TEXT PRIMARY KEY,value TEXT,updated_at TEXT);
    INSERT INTO system_settings VALUES ('komite_verifier_user_id','delegate',NULL);
    ALTER TABLE komite_pengajuan ADD COLUMN workflow_version INTEGER DEFAULT 2;
    ALTER TABLE komite_pengajuan ADD COLUMN chairman_id_snapshot TEXT;
    ALTER TABLE komite_pengajuan ADD COLUMN chairman_name_snapshot TEXT;
    ALTER TABLE komite_pengajuan ADD COLUMN laporan_received_at TEXT;
    ALTER TABLE komite_pengajuan ADD COLUMN laporan_received_by TEXT;
    ALTER TABLE komite_pengajuan ADD COLUMN laporan_received_name TEXT;
    ALTER TABLE komite_pengajuan ADD COLUMN laporan_revision INTEGER DEFAULT 0;
    ALTER TABLE komite_pengajuan ADD COLUMN submitted_at TEXT;
    ALTER TABLE komite_pengajuan ADD COLUMN created_at TEXT;
    ALTER TABLE komite_pengajuan_reviews ADD COLUMN workflow_version INTEGER DEFAULT 1;
    ALTER TABLE komite_pengajuan_reviews ADD COLUMN created_at TEXT;
    CREATE TABLE activity_logs (id TEXT PRIMARY KEY,actor_user_id TEXT,actor_name TEXT,module TEXT,action TEXT,summary TEXT,entity_type TEXT,entity_id TEXT,before_json TEXT,after_json TEXT);
    CREATE TABLE komite_pengajuan_versions (id TEXT,pengajuan_id TEXT,version_number INTEGER);
    CREATE TABLE komite_pengajuan_files (id TEXT,version_id TEXT,r2_key TEXT,original_filename TEXT,size_bytes INTEGER,created_at TEXT);
    CREATE TABLE user_feature_overrides (user_id TEXT,feature_id TEXT,action TEXT);`)
  sqlite.exec(`CREATE TABLE siswa(tahun_masuk INTEGER); INSERT INTO siswa VALUES(2025);
    CREATE TABLE fin_cashflow_entries(id TEXT PRIMARY KEY,is_void INTEGER,direction TEXT,amount INTEGER,transaction_date TEXT,proof_number TEXT,description TEXT,method TEXT);
    CREATE TABLE fin_cashflow_categories(id TEXT PRIMARY KEY,direction TEXT,name TEXT,sort_order INTEGER,is_system INTEGER);
    ALTER TABLE komite_pengajuan ADD COLUMN realisasi_status TEXT DEFAULT 'belum';
    ALTER TABLE komite_pengajuan ADD COLUMN realisasi_tanggal TEXT;
    ALTER TABLE komite_pengajuan ADD COLUMN realisasi_metode TEXT;`)
  sqlite.exec(readFileSync(new URL('../../../../migrations/0123_add_rapbm.sql',import.meta.url),'utf8').split('INSERT OR IGNORE INTO role_features')[0])
  sqlite.exec(readFileSync(new URL('../../../../migrations/0127_komite_fund_sources.sql',import.meta.url),'utf8'))
  sqlite.exec("INSERT INTO fin_komite_allocations(id,pengajuan_id,source,amount,state,actor_id) VALUES('a1','p1','2025',100000,'review','chair')")
  state.db = { prepare(sql: string) {
    let args: (string | number | null)[] = []
    return { bind(...values: typeof args) {
        if (values.length > 100) throw new Error('D1_ERROR: too many SQL variables')
        args = values
        return this
      },
      async all() { return { results: sqlite.prepare(sql).all(...args) } },
      async first() {
        if (state.race && sql.includes('signature_url')) sqlite.exec('UPDATE komite_pengajuan SET current_version=2')
        return sqlite.prepare(sql).get(...args) || null
      },
      async run() { return /^SELECT/.test(sql.trim()) ? {results:sqlite.prepare(sql).all(...args)} : { meta: { changes: sqlite.prepare(sql).run(...args).changes } } } }
  }, async batch(statements: { run(): Promise<unknown>; all():Promise<unknown> }[]) {
    sqlite.exec('BEGIN')
    try {
      const results = []
      for (const [index, statement] of statements.entries()) {
        if (index === 1 && state.failWrite) throw new Error('Simulated write failure')
        results.push(await statement.run())
      }
      sqlite.exec('COMMIT'); return results
    } catch (error) { sqlite.exec('ROLLBACK'); throw error }
  } } as unknown as D1Database
})
afterEach(() => sqlite.close())
function approve(action = 'setujui') {
  const data = new FormData(); data.set('id', 'p1'); data.set('action', action)
  data.set('catatan', 'Catatan reviewer'); data.set('reject_confirmation', 'TOLAK')
  return reviewKomiteAction(data)
}
const proposal = () => sqlite.prepare('SELECT * FROM komite_pengajuan').get()!

describe('Komite approval workflow server actions', () => {
  it('finalizes at verifier and sends only the final approval event', async () => {
    expect(await approve()).toMatchObject({ success: 'Pengajuan disetujui dan SPB telah terbit.' })
    expect(proposal()).toMatchObject({ status: 'disetujui', final_approval_stage: 'ketua', nomor_spb: '001/SPB' })
    expect(proposal().approved_at).toBeTruthy()
    expect(state.emit.mock.calls.map(call => call[0].eventKey)).toEqual(['komite_final_approved'])
    expect(state.emit.mock.calls[0][0].context.tahap).toBe('Verifikator')
    expect(sqlite.prepare('SELECT stage,actor_id FROM komite_pengajuan_reviews').get()).toMatchObject({ stage: 'ketua', actor_id: 'delegate' })
  })
  it('does not allow the chairman or principal to approve', async () => {
    for (const [role,id] of [['ketua_komite','chair'],['kepsek','principal']]) {
      state.roles=[role]; state.userId=id
      expect(await approve()).toHaveProperty('error')
      expect(proposal().status).toBe('menunggu_ketua')
    }
  })
  it('records verifier identity and chairman snapshot without requiring chairman review', async () => {
    await approve()
    expect(proposal()).toMatchObject({ status: 'disetujui', chairman_id_snapshot: 'chair', chairman_name_snapshot: 'Ketua' })
    expect(sqlite.prepare('SELECT actor_role,workflow_version FROM komite_pengajuan_reviews').get()).toMatchObject({ actor_role:'anggota_komite',workflow_version:2 })
  })
  it('blocks approval when verifier is missing or no longer eligible, even for admin', async () => {
    state.roles=['super_admin']
    sqlite.exec("UPDATE system_settings SET value='principal'")
    expect(await approve()).toHaveProperty('error')
    expect(proposal().status).toBe('menunggu_ketua')
  })
  it('does not allow the verifier to review their own proposal', async () => {
    sqlite.exec("UPDATE komite_pengajuan SET pengaju_id='delegate'")
    expect(await approve()).toHaveProperty('error')
  })
  it('supports an audited super admin bypass when a verifier is configured', async () => {
    state.roles=['super_admin']; state.userId='principal'
    expect(await approve()).toHaveProperty('success')
    expect(sqlite.prepare('SELECT is_super_admin_bypass FROM komite_pengajuan_reviews').get()?.is_super_admin_bypass).toBe(1)
  })
  it('blocks final approval when multiple chairmen require a selection', async () => {
    sqlite.exec("UPDATE \"user\" SET role='ketua_komite' WHERE id='principal'")
    expect(await approve()).toHaveProperty('error')
    sqlite.exec("INSERT INTO system_settings VALUES ('komite_spb_chairman_user_id','chair',NULL)")
    expect(await approve()).toHaveProperty('success')
  })
  it.each([['minta_revisi', 'perlu_revisi'], ['tolak', 'ditolak']])('retains %s without publishing an SPB', async (action, status) => {
    await approve(action)
    expect(proposal()).toMatchObject({ status, final_approval_stage: null, approved_at: null })
    expect(state.emit.mock.calls[0][0].eventKey).not.toBe('komite_final_approved')
  })
  it('rejects another role and does not write approval history', async () => {
    state.roles = ['kepsek']; state.userId = 'principal'
    expect(await approve()).toHaveProperty('error')
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM komite_pengajuan_reviews').get()?.total).toBe(0)
  })
  it('does not record a stale review or send notifications if the proposal changed', async () => {
    state.race = true
    expect(await approve()).toHaveProperty('error')
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM komite_pengajuan_reviews').get()?.total).toBe(0)
    expect(proposal().status).toBe('menunggu_ketua')
    expect(state.emit).not.toHaveBeenCalled()
  })
  it('rolls back review history when the final approval write fails', async () => {
    state.failWrite = true
    expect(await approve()).toHaveProperty('error')
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM komite_pengajuan_reviews').get()?.total).toBe(0)
    expect(proposal()).toMatchObject({ status: 'menunggu_ketua', final_approval_stage: null })
    expect(state.emit).not.toHaveBeenCalled()
  })
  it('restricts verifier configuration to Super Admin and audits the setting change', async () => {
    expect(await setKomiteReviewerSettingAction('verifier','delegate')).toHaveProperty('error')
    state.roles=['super_admin']
    expect(await setKomiteReviewerSettingAction('verifier','principal')).toHaveProperty('error')
    expect(await setKomiteReviewerSettingAction('verifier','delegate')).toHaveProperty('success')
    expect(sqlite.prepare('SELECT action FROM activity_logs').get()?.action).toBe('configure_reviewer')
  })
  it('applies verifier changes immediately to the existing queue', async () => {
    state.roles=['super_admin']
    sqlite.exec("INSERT INTO user_roles VALUES ('principal','anggota_komite')")
    await setKomiteReviewerSettingAction('verifier','principal')
    state.roles=['anggota_komite']; state.userId='delegate'
    expect(await approve()).toHaveProperty('error')
    state.userId='principal'
    expect(await approve()).toHaveProperty('success')
  })
  it('offers a published cohort and maps its historical SPB after position confirmation', async () => {
    state.roles=['super_admin']
    sqlite.exec(`UPDATE fin_komite_allocations SET state='locked';
      UPDATE komite_pengajuan SET status='disetujui',komite_pre_migration=1;
      UPDATE fin_komite_allocations SET state='released';
      INSERT INTO fin_rapbm_years(year) VALUES(2026);
      INSERT INTO fin_rapbm_versions(id,year,version,title,institution,sheet,income_totals_json,expense_totals_json,notes_json,original_filename,r2_key,source_sha256,created_by_name,komite_cohort)
      VALUES('rapbm',2026,1,'RAPBM','MAN','Sheet','{}','{}','[]','RAPBM.xlsx','source','hash','Bendahara',2026);
      INSERT INTO fin_rapbm_groups(id,version_id,section,sort_order,label,account,source_ref)
      VALUES('pos','rapbm','expense',1,'Kegiatan','521111','A1');
      UPDATE fin_rapbm_versions SET status='published' WHERE id='rapbm';`)
    expect((await getKomiteDashboardData()).fundOptions).toMatchObject({years:[2026,2025],historicalPositions:[]})
    const form=new FormData()
    form.set('id','p1');form.set('reason','Sesuai SPB lama')
    form.set('fund_allocations',JSON.stringify([{source:'2026',groupId:'pos',amount:100000}]))
    expect(await mapHistoricalKomiteSpb(form)).toMatchObject({error:expect.stringContaining('Konfirmasi pagu')})
    sqlite.exec(`INSERT INTO fin_komite_rapbm_versions(version_id,cohort,activated_by,enabled) VALUES('rapbm',2026,'chair',0);
      INSERT INTO fin_komite_budget_positions(group_id,amount) VALUES('pos',100000);`)
    expect((await getKomiteDashboardData()).fundOptions).toMatchObject({positions:[],historicalPositions:[{group_id:'pos',cohort:2026}]})
    expect(await mapHistoricalKomiteSpb(form)).toHaveProperty('success')
  })
  it('maps a historical SPB to existing cash without duplicating the transaction',async()=>{
    sqlite.exec(`UPDATE fin_komite_allocations SET state='locked';
      UPDATE komite_pengajuan SET status='disetujui',komite_pre_migration=1;
      UPDATE fin_komite_allocations SET state='released';
      INSERT INTO fin_cashflow_entries(id,is_void,direction,amount,transaction_date,proof_number,description,method,komite_pre_migration)
      VALUES('legacy',0,'expense',100000,'2026-10-06','KK-1','Bukti historis','transfer',1)`)
    state.roles=['super_admin']
    const data=new FormData()
    data.set('id','p1');data.set('cash_id','legacy');data.set('reason','Sesuai bukti kas')
    data.set('fund_allocations',JSON.stringify([{source:'2025',amount:100000}]))
    expect(await mapHistoricalKomiteSpb(data)).toHaveProperty('success')
    expect(proposal()).toMatchObject({realisasi_status:'sudah',realisasi_tanggal:'2026-10-06',realisasi_metode:'Transfer'})
    expect(sqlite.prepare("SELECT cashflow_id,source,amount FROM fin_komite_spb_cash_parts").all()).toEqual([{cashflow_id:'legacy',source:'2025',amount:100000}])
    expect(await mapHistoricalKomiteSpb(data)).toHaveProperty('error')
    expect(sqlite.prepare("SELECT count(*) count FROM fin_cashflow_entries").get()?.count).toBe(1)
  })
  it('marks and reverses activity reports with audit and optimistic revision checks', async () => {
    sqlite.exec("UPDATE fin_komite_allocations SET state='locked'; UPDATE komite_pengajuan SET status='disetujui'")
    state.roles=['super_admin']
    expect(await setKomiteActivityReportAction('p1',true,0)).toHaveProperty('success')
    expect(proposal()).toMatchObject({ laporan_received_by:'delegate',laporan_received_name:'Anggota',laporan_revision:1 })
    expect(await setKomiteActivityReportAction('p1',false,0)).toHaveProperty('error')
    expect(await setKomiteActivityReportAction('p1',false,1)).toHaveProperty('success')
    expect(proposal()).toMatchObject({ laporan_received_at:null,laporan_received_by:null,laporan_revision:2 })
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM activity_logs').get()?.total).toBe(2)
  })
  it('rolls back the report audit if the status write fails', async () => {
    sqlite.exec("UPDATE fin_komite_allocations SET state='locked'; UPDATE komite_pengajuan SET status='disetujui'")
    state.roles=['super_admin']; state.failWrite=true
    await expect(setKomiteActivityReportAction('p1',true,0)).rejects.toThrow('Simulated write failure')
    expect(proposal()).toMatchObject({ laporan_received_at:null,laporan_revision:0 })
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM activity_logs').get()?.total).toBe(0)
  })
  it('keeps rejected proposals visible to the principal without granting review authority', async () => {
    sqlite.exec("UPDATE komite_pengajuan SET status='ditolak'")
    state.roles=['kepsek']; state.userId='principal'
    const data=await getKomiteDashboardData()
    expect(data.items).toHaveLength(1)
    expect(data.items[0].status).toBe('ditolak')
    expect(data.canCreate).toBe(true)
    expect(data.reviewCount).toBe(0)
  })
  it('loads the treasurer queue and its related records above the D1 parameter limit', async () => {
    state.roles = ['bendahara_komite']
    state.userId = 'treasurer'
    sqlite.exec(`
      WITH RECURSIVE ids(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM ids WHERE n<101)
      INSERT INTO komite_pengajuan (id,judul,nominal,pengaju_id,status)
        SELECT 'queue-' || n,'Kegiatan',100000,'applicant','menunggu_bendahara' FROM ids;
      INSERT INTO komite_pengajuan_versions VALUES ('v101','queue-101',1),('private','p1',1);
      INSERT INTO komite_pengajuan_files VALUES ('f101','v101','pdf-key','proposal.pdf',123,NULL);
      INSERT INTO komite_pengajuan_reviews (id,pengajuan_id,actor_id) VALUES ('r101','queue-101','chair');
      INSERT INTO komite_pengajuan_rincian VALUES ('d101','queue-101',1,'Kebutuhan','Penyedia',100000);
    `)

    const data = await getKomiteDashboardData()

    expect(data.items).toHaveLength(101)
    expect(data.reviewCount).toBe(101)
    expect(data.items.find(item => item.id === 'queue-101')).toMatchObject({
      versions: [{ id: 'v101', files: [{ id: 'f101' }] }],
      reviews: [{ id: 'r101' }],
      rincian: [{ id: 'd101' }],
    })
  })
  it('limits reports to approved proposals and permitted staff', async () => {
    expect(await setKomiteActivityReportAction('p1',true,0)).toHaveProperty('error')
    state.roles=['super_admin']
    expect(await setKomiteActivityReportAction('p1',true,0)).toHaveProperty('error')
  })
  it.each(['ditolak','disetujui','menunggu_ketua','perlu_revisi'])('prevents deleting a %s proposal and keeps its history', async status => {
    state.roles=['super_admin']
    if (status==='disetujui') sqlite.exec("UPDATE fin_komite_allocations SET state='locked'")
    sqlite.prepare('UPDATE komite_pengajuan SET status=?').run(status)
    expect(await deleteKomiteAction('p1')).toHaveProperty('error')
    expect(proposal().status).toBe(status)
  })
  it('prevents deleting a previously submitted draft through either action', async () => {
    state.roles=['super_admin']; state.userId='applicant'
    sqlite.exec("UPDATE komite_pengajuan SET status='draft',submitted_at='2026-10-01'")
    expect(await deleteKomiteAction('p1')).toHaveProperty('error')
    expect(await deleteKomiteDraftAction('p1')).toHaveProperty('error')
  })
  it.each([false, true])('keeps treasurer details atomic when a stale review is %s', async stale => {
    state.roles = ['bendahara_komite']; state.race = stale
    sqlite.exec("UPDATE komite_pengajuan SET status='menunggu_bendahara'")
    const data = new FormData()
    for (const [key, value] of Object.entries({ id: 'p1', action: 'setujui', nomor_spb: '001/SPB',
      penerima_pembayaran: 'Penyedia', nominal: '1', detail_uraian: 'Kebutuhan baru',
      detail_penerima_penyedia: 'Penyedia', detail_jumlah: '200000' })) data.set(key, value)
    data.set('fund_allocations',JSON.stringify([{source:'2025',amount:200000}]))
    const result = await reviewKomiteAction(data)
    if (stale) {
      expect(result).toHaveProperty('error')
      expect(proposal()).toMatchObject({ status: 'menunggu_bendahara', nominal: 100000 })
      expect(sqlite.prepare('SELECT id,jumlah FROM komite_pengajuan_rincian').get()).toMatchObject({ id: 'original', jumlah: 100000 })
      expect(state.emit).not.toHaveBeenCalled()
    } else {
      expect(result).toHaveProperty('success')
      expect(proposal()).toMatchObject({ status: 'menunggu_ketua', nominal: 200000, final_approval_stage: null })
      expect(sqlite.prepare('SELECT jumlah FROM komite_pengajuan_rincian').get()?.jumlah).toBe(200000)
    }
  })
})
