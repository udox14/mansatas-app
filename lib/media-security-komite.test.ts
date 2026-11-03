import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authorizeMediaRequest } from './media-security'
const state = vi.hoisted(() => ({ db: null as unknown as D1Database, actor: { kind: 'parent', siswaId: 'student' } as unknown }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: { DB: state.db } }) }))
vi.mock('@/lib/action-security', () => ({ getAuthenticatedActor: async () => state.actor, assertStudentScope: vi.fn(), isAdministrativeActor: () => false }))
vi.mock('@/lib/features', () => ({ checkFeatureCrudAccess: async () => false }))
let sqlite: DatabaseSync
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`CREATE TABLE siswa(id TEXT, kelas_id TEXT); CREATE TABLE kelas(id TEXT, tingkat INTEGER);
    CREATE TABLE system_settings(key TEXT, value TEXT);
    INSERT INTO siswa VALUES ('student','class'); INSERT INTO kelas VALUES ('class',10);
    INSERT INTO system_settings VALUES ('keuangan_komite_10_qris_url','/api/media/keuangan_settings/komite-qris-10-new.png'),
      ('keuangan_komite_10_qris_enabled','1'), ('keuangan_komite_11_qris_url','/api/media/keuangan_settings/komite-qris-11.png'),
      ('keuangan_komite_11_qris_enabled','1');`)
  state.actor = { kind: 'parent', siswaId: 'student' }
  state.db = { prepare(sql: string) { let args: string[] = []; return { bind(...values: string[]) { args = values; return this }, async first() { return sqlite.prepare(sql).get(...args) ?? null } } } } as unknown as D1Database
})
afterEach(() => sqlite.close())
const request = new Request('https://example.com/api/media/keuangan_settings/qris.png')
describe('parent QRIS media access', () => {
  it('permits current grade QRIS and blocks other grades, replaced images, and other setting files', async () => {
    expect(await authorizeMediaRequest(request, 'keuangan_settings/komite-qris-10-new.png')).not.toBeNull()
    for (const key of ['komite-qris-11.png', 'komite-qris-10-old.png', 'other.png']) {
      expect(await authorizeMediaRequest(request, `keuangan_settings/${key}`)).toBeNull()
    }
  })
  it('revokes access immediately when QRIS is disabled or the student changes grade', async () => {
    sqlite.prepare('UPDATE system_settings SET value = ? WHERE key = ?')
      .run('0', 'keuangan_komite_10_qris_enabled')
    expect(await authorizeMediaRequest(request, 'keuangan_settings/komite-qris-10-new.png')).toBeNull()
    sqlite.exec('UPDATE kelas SET tingkat=11')
    expect(await authorizeMediaRequest(request, 'keuangan_settings/komite-qris-11.png')).not.toBeNull()
    sqlite.exec('UPDATE siswa SET kelas_id=NULL')
    expect(await authorizeMediaRequest(request, 'keuangan_settings/komite-qris-11.png')).toBeNull()
  })
  it('does not expose QRIS to unauthenticated visitors', async () => {
    state.actor = null
    expect(await authorizeMediaRequest(request, 'keuangan_settings/komite-qris-10-new.png')).toBeNull()
  })
})
