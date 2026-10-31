import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureKomitePengajuanSchema } from './komite-pengajuan'

vi.mock('@/lib/activity-log', () => ({ ensureActivityLogTables: async (db: D1Database) => {
  await db.prepare(`CREATE TABLE IF NOT EXISTS activity_logs (id TEXT PRIMARY KEY,module TEXT,action TEXT,
    summary TEXT,entity_type TEXT,entity_id TEXT,before_json TEXT,after_json TEXT)`).run()
} }))
let sqlite: DatabaseSync
let db: D1Database
let failTransition = false
beforeEach(() => {
  failTransition=false
  sqlite=new DatabaseSync(':memory:')
  sqlite.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE "user" (id TEXT PRIMARY KEY);
    INSERT INTO "user" VALUES ('applicant'),('reviewer');
    CREATE TABLE master_roles (value TEXT PRIMARY KEY,label TEXT,is_custom INTEGER);
    CREATE TABLE role_features (role TEXT,feature_id TEXT,UNIQUE(role,feature_id));
    CREATE TABLE role_feature_permissions (role TEXT,feature_id TEXT,can_create INTEGER,can_read INTEGER,can_update INTEGER,can_delete INTEGER,UNIQUE(role,feature_id));`)
  sqlite.exec(readFileSync(new URL('../migrations/0071_add_komite_pengajuan.sql',import.meta.url),'utf8'))
  sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_komite_review_stage_version ON komite_pengajuan_reviews(pengajuan_id,version_number,stage);
    INSERT INTO komite_pengajuan (id,judul,uraian,nominal,pengaju_id,status,nomor_spb,approved_at)
    VALUES ('pending','Acara','Uraian',100000,'applicant','menunggu_kepala','SPB1',NULL),
      ('approved','Selesai','Uraian',200000,'applicant','disetujui','SPB2','2026-10-01'),
      ('rejected','Ditolak','Uraian',300000,'applicant','ditolak',NULL,NULL);
    INSERT INTO komite_pengajuan_reviews (id,pengajuan_id,version_number,stage,action,actor_id,actor_name,actor_role)
      VALUES ('old-review','pending',1,'ketua','setujui','reviewer','Ketua Lama','ketua_komite');`)
  db={ prepare(sql: string) {
    let args: (string|number|null)[]=[]
    return { bind(...values: typeof args) { args=values; return this },
      async run() {
        if (failTransition && sql.includes('SET workflow_version=2')) throw new Error('transition failure')
        return { meta:{ changes:sqlite.prepare(sql).run(...args).changes } }
      } }
  }, async batch(statements: { run(): Promise<unknown> }[]) {
    sqlite.exec('BEGIN')
    try { const result=[]; for (const stmt of statements) result.push(await stmt.run()); sqlite.exec('COMMIT'); return result }
    catch(error) { sqlite.exec('ROLLBACK'); throw error }
  } } as unknown as D1Database
})
afterEach(() => sqlite.close())

describe('additive Komite migration', () => {
  it.each([false,true])('transitions pending records once while preserving history (SQL migration applied: %s)', async migrated => {
    if (migrated) sqlite.exec(readFileSync(new URL('../migrations/0122_komite_verifier_and_activity_report.sql',import.meta.url),'utf8'))
    await ensureKomitePengajuanSchema(db)
    await ensureKomitePengajuanSchema(db)
    expect(sqlite.prepare("SELECT status,workflow_version,nominal,nomor_spb FROM komite_pengajuan WHERE id='pending'").get()).toMatchObject({ status:'menunggu_ketua',workflow_version:2,nominal:100000,nomor_spb:'SPB1' })
    expect(sqlite.prepare("SELECT status,workflow_version,approved_at FROM komite_pengajuan WHERE id='approved'").get()).toMatchObject({ status:'disetujui',workflow_version:1,approved_at:'2026-10-01' })
    expect(sqlite.prepare("SELECT status,workflow_version FROM komite_pengajuan WHERE id='rejected'").get()).toMatchObject({ status:'ditolak',workflow_version:1 })
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM activity_logs").get()?.total).toBe(1)
    expect(sqlite.prepare("SELECT actor_name,workflow_version FROM komite_pengajuan_reviews WHERE id='old-review'").get()).toMatchObject({ actor_name:'Ketua Lama',workflow_version:1 })
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM komite_pengajuan WHERE laporan_received_at IS NOT NULL").get()?.total).toBe(0)
    sqlite.exec(`INSERT INTO komite_pengajuan_reviews (id,pengajuan_id,version_number,stage,action,actor_name,actor_role,workflow_version)
      VALUES ('new-review','pending',1,'ketua','setujui','Verifikator','anggota_komite',2)`)
    expect(() => sqlite.exec(`INSERT INTO komite_pengajuan_reviews (id,pengajuan_id,version_number,stage,action,actor_name,actor_role,workflow_version)
      VALUES ('duplicate','pending',1,'ketua','setujui','Verifikator','anggota_komite',2)`)).toThrow(/UNIQUE/)
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })
  it('rolls back the migration audit together with the transition on failure', async () => {
    failTransition=true
    await expect(ensureKomitePengajuanSchema(db)).rejects.toThrow('transition failure')
    expect(sqlite.prepare("SELECT status,workflow_version FROM komite_pengajuan WHERE id='pending'").get()).toMatchObject({ status:'menunggu_kepala',workflow_version:1 })
    expect(sqlite.prepare('SELECT COUNT(*) AS total FROM activity_logs').get()?.total).toBe(0)
  })
})
