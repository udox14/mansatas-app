import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reviewKomiteAction, setKomiteApprovalFlowAction } from './actions'

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
  state.roles = ['ketua_komite']; state.userId = 'chair'; state.requirePrincipal = false
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
      nomor_spb_snapshot TEXT,penerima_snapshot TEXT, UNIQUE(pengajuan_id,version_number,stage));
    CREATE TABLE komite_pengajuan_rincian (id TEXT PRIMARY KEY,pengajuan_id TEXT,urutan INTEGER,uraian TEXT,
      penerima_penyedia TEXT,jumlah INTEGER);
    INSERT INTO komite_pengajuan_rincian VALUES ('original','p1',1,'Kebutuhan','Penyedia',100000);`)
  state.db = { prepare(sql: string) {
    let args: (string | number | null)[] = []
    return { bind(...values: typeof args) { args = values; return this },
      async first() {
        if (state.race && sql.includes('signature_url')) sqlite.exec('UPDATE komite_pengajuan SET current_version=2')
        return sqlite.prepare(sql).get(...args) || null
      },
      async run() { return { meta: { changes: sqlite.prepare(sql).run(...args).changes } } } }
  }, async batch(statements: { run(): Promise<unknown> }[]) {
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
  it('finalizes at chairman and sends only the final approval event', async () => {
    expect(await approve()).toMatchObject({ success: 'Pengajuan disetujui dan SPB telah terbit.' })
    expect(proposal()).toMatchObject({ status: 'disetujui', final_approval_stage: 'ketua', nomor_spb: '001/SPB' })
    expect(proposal().approved_at).toBeTruthy()
    expect(state.emit.mock.calls.map(call => call[0].eventKey)).toEqual(['komite_final_approved'])
    expect(state.emit.mock.calls[0][0].context.tahap).toBe('Ketua Komite')
    expect(sqlite.prepare('SELECT stage,actor_id FROM komite_pengajuan_reviews').get()).toMatchObject({ stage: 'ketua', actor_id: 'chair' })
  })
  it('routes to principal when configured, then records principal final approval', async () => {
    state.requirePrincipal = true
    await approve()
    expect(proposal()).toMatchObject({ status: 'menunggu_kepala', approved_at: null, final_approval_stage: null })
    expect(state.emit.mock.calls.map(call => call[0].eventKey)).toEqual(['komite_chairman_approved', 'komite_principal_review_requested'])
    state.roles = ['kepsek']; state.userId = 'principal'; state.requirePrincipal = false
    await approve()
    expect(proposal()).toMatchObject({ status: 'disetujui', final_approval_stage: 'kepala' })
  })
  it('allows the valid chairman delegate to finalize using the same default workflow', async () => {
    state.roles = ['anggota_komite']; state.userId = 'delegate'
    sqlite.exec("UPDATE komite_pengajuan SET ketua_delegate_id='delegate'")
    await approve()
    expect(proposal()).toMatchObject({ status: 'disetujui', final_approval_stage: 'ketua' })
    expect(sqlite.prepare('SELECT actor_role FROM komite_pengajuan_reviews').get()?.actor_role).toBe('anggota_komite')
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
  it('restricts workflow configuration to Super Admin and audits the setting change', async () => {
    expect(await setKomiteApprovalFlowAction(true)).toHaveProperty('error')
    expect(state.set).not.toHaveBeenCalled()
    state.roles = ['super_admin']
    expect(await setKomiteApprovalFlowAction(true)).toHaveProperty('success')
    expect(state.set).toHaveBeenCalledWith('komite_require_principal_approval', '1')
    expect(state.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'configure_approval_flow' }))
  })
  it.each([false, true])('keeps treasurer details atomic when a stale review is %s', async stale => {
    state.roles = ['bendahara_komite']; state.race = stale
    sqlite.exec("UPDATE komite_pengajuan SET status='menunggu_bendahara'")
    const data = new FormData()
    for (const [key, value] of Object.entries({ id: 'p1', action: 'setujui', nomor_spb: '001/SPB',
      penerima_pembayaran: 'Penyedia', nominal: '1', detail_uraian: 'Kebutuhan baru',
      detail_penerima_penyedia: 'Penyedia', detail_jumlah: '200000' })) data.set(key, value)
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
