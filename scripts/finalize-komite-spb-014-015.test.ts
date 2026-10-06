import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./finalize-komite-spb-014-015.sql', import.meta.url), 'utf8')
const ids = ['5d31b07c-c924-4c18-88e8-eb67b64ffe64', 'fe4af388-9c20-4e96-a7d3-ea6846c5fda6']
let db: DatabaseSync
beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE komite_pengajuan (id TEXT PRIMARY KEY,judul TEXT,status TEXT,current_version INTEGER,
    approved_at TEXT,final_approval_stage TEXT,realisasi_status TEXT,nomor_spb TEXT,nominal INTEGER,updated_at TEXT);
    CREATE TABLE komite_pengajuan_reviews (id TEXT,pengajuan_id TEXT,version_number INTEGER,stage TEXT,action TEXT,created_at TEXT);
    CREATE TABLE komite_pengajuan_rincian (pengajuan_id TEXT,jumlah INTEGER);
    CREATE TABLE activity_logs (id TEXT PRIMARY KEY,actor_name TEXT,actor_roles TEXT,module TEXT,action TEXT,severity TEXT,
      summary TEXT,entity_type TEXT,entity_id TEXT,entity_label TEXT,before_json TEXT,after_json TEXT,metadata_json TEXT);`)
  for (const [index, id] of ids.entries()) {
    const amount = index === 0 ? 9950000 : 5220000
    const updated = index === 0 ? '2026-10-03 03:54:07' : '2026-10-03 04:04:19'
    db.prepare('INSERT INTO komite_pengajuan VALUES (?,?,?,?,NULL,NULL,?,?,?,?)')
      .run(id, 'Kegiatan', 'menunggu_kepala', 1, 'belum', `SPB / ${index === 0 ? '014' : '015'} / KOMITE / X / 2026`, amount, updated)
    for (const stage of ['bendahara', 'ketua']) {
      db.prepare('INSERT INTO komite_pengajuan_reviews VALUES (?,?,1,?,?,?)').run(`${id}:${stage}`, id, stage, 'setujui', updated)
    }
    db.prepare('INSERT INTO komite_pengajuan_rincian VALUES (?,?)').run(id, amount)
  }
})
afterEach(() => db.close())

describe('Authorized finalization of existing Komite SPBs 014 and 015', () => {
  it('finalizes both without changing reviews or amounts and records one audit entry per proposal', () => {
    const reviews = db.prepare('SELECT * FROM komite_pengajuan_reviews').all()
    db.exec(sql)
    const proposals = db.prepare('SELECT * FROM komite_pengajuan ORDER BY id').all()
    expect(proposals.map(p => p.status)).toEqual(['disetujui', 'disetujui'])
    expect(proposals.map(p => p.final_approval_stage)).toEqual(['ketua', 'ketua'])
    expect(proposals.map(p => p.nominal)).toEqual([9950000, 5220000])
    expect(proposals.every(p => p.approved_at)).toBe(true)
    expect(db.prepare('SELECT * FROM komite_pengajuan_reviews').all()).toEqual(reviews)
    const logs = db.prepare('SELECT * FROM activity_logs').all()
    expect(logs).toHaveLength(2)
    expect(JSON.parse(String(logs[0].before_json)).status).toBe('menunggu_kepala')
    expect(JSON.parse(String(logs[0].metadata_json)).principal_approval_created).toBe(false)
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all()).toEqual([])
    db.exec(sql)
    expect(db.prepare('SELECT COUNT(*) AS total FROM activity_logs').get()?.total).toBe(2)
  })
  it.each(['review', 'amount', 'version', 'status'])('changes neither proposal if %s no longer matches the verified snapshot', change => {
    if (change === 'review') db.prepare("DELETE FROM komite_pengajuan_reviews WHERE pengajuan_id=? AND stage='ketua'").run(ids[0])
    if (change === 'amount') db.prepare('UPDATE komite_pengajuan SET nominal=1 WHERE id=?').run(ids[0])
    if (change === 'version') db.prepare('UPDATE komite_pengajuan SET current_version=2 WHERE id=?').run(ids[0])
    if (change === 'status') db.prepare("UPDATE komite_pengajuan SET status='perlu_revisi' WHERE id=?").run(ids[0])
    const before = db.prepare('SELECT * FROM komite_pengajuan').all()
    db.exec(sql)
    expect(db.prepare('SELECT * FROM komite_pengajuan').all()).toEqual(before)
    expect(db.prepare('SELECT * FROM activity_logs').all()).toEqual([])
  })
  it('rolls back the financial status update if audit insertion fails', () => {
    db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON activity_logs BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;")
    expect(() => db.exec(sql)).toThrow('audit unavailable')
    expect(db.prepare('SELECT status FROM komite_pengajuan').all().map(p => p.status)).toEqual(['menunggu_kepala', 'menunggu_kepala'])
    expect(db.prepare('SELECT * FROM activity_logs').all()).toEqual([])
  })
})
