import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  calculateAgendaAccessRisk,
  canManageAgendaAccessAudit,
  canViewAgendaAccessAudit,
  dateKeyWIB,
  riskLevelForScore,
  stableAuditHash,
} from './agenda-access-audit'

describe('agenda access audit risk', () => {
  it('does not flag one account using multiple devices', () => {
    expect(calculateAgendaAccessRisk({ accountSwitch: false })).toEqual({ score: 0, level: 'low' })
  })

  it('rates a same-device account switch as medium', () => {
    expect(calculateAgendaAccessRisk({ accountSwitch: true })).toEqual({ score: 40, level: 'medium' })
  })

  it('rates logout, account switch, and agenda submission as high', () => {
    expect(calculateAgendaAccessRisk({ accountSwitch: true, logoutThenLogin: true, agendaAfterSwitch: true }))
      .toEqual({ score: 100, level: 'high' })
  })

  it('rates a repeated cross-account device pattern as high', () => {
    expect(calculateAgendaAccessRisk({ accountSwitch: true, repeatedDifferentDay: true }))
      .toEqual({ score: 80, level: 'high' })
  })

  it('caps historical indicators at medium only when no agenda submission', () => {
    expect(calculateAgendaAccessRisk({ accountSwitch: true, logoutThenLogin: true, agendaAfterSwitch: false, historical: true }))
      .toEqual({ score: 60, level: 'medium' })
    expect(calculateAgendaAccessRisk({ accountSwitch: true, repeatedDifferentDay: true, agendaAfterSwitch: false, historical: true }))
      .toEqual({ score: 79, level: 'medium' })
  })

  it('allows historical indicators to reach high when agenda submission occurs', () => {
    expect(calculateAgendaAccessRisk({ accountSwitch: true, logoutThenLogin: true, agendaAfterSwitch: true, historical: true }))
      .toEqual({ score: 100, level: 'high' })
  })

  it('uses stable WIB dates and hashes', () => {
    expect(dateKeyWIB('2026-09-01T18:00:00.000Z')).toBe('2026-09-02')
    expect(stableAuditHash('same')).toBe(stableAuditHash('same'))
    expect(riskLevelForScore(80)).toBe('high')
  })

  it('limits audit viewing to super admin, principal, and curriculum vice principal', () => {
    expect(canViewAgendaAccessAudit(['super_admin'])).toBe(true)
    expect(canViewAgendaAccessAudit(['kepsek'])).toBe(true)
    expect(canViewAgendaAccessAudit(['wakamad'], 'jbt_waka_kurikulum')).toBe(true)
    expect(canViewAgendaAccessAudit(['wakamad'], 'jbt_waka_sarpras')).toBe(false)
    expect(canViewAgendaAccessAudit(['guru'])).toBe(false)
  })

  it('allows only super admin to manage blocks', () => {
    expect(canManageAgendaAccessAudit(['super_admin'])).toBe(true)
    expect(canManageAgendaAccessAudit(['kepsek'])).toBe(false)
    expect(canManageAgendaAccessAudit(['wakamad'])).toBe(false)
  })
})

import { DatabaseSync } from 'node:sqlite'
import { cleanupGuruMapelAndPplAlerts, isGuruMapelAndGuruPplPair } from './agenda-access-audit'

describe('guru mapel and guru ppl pair detection', () => {
  let sqlite: DatabaseSync

  function d1(): D1Database {
    return {
      prepare(sql: string) {
        let args: Array<string | number | null> = []
        const statement = {
          bind(...values: Array<string | number | null>) { args = values; return statement },
          async first<T>() { return (sqlite.prepare(sql).get(...args) || null) as T | null },
          async run() {
            const info = sqlite.prepare(sql).run(...args)
            return { meta: { changes: info.changes } }
          },
        }
        return statement
      },
    } as unknown as D1Database
  }

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:')
    sqlite.exec(`
      CREATE TABLE "user" (id TEXT PRIMARY KEY, role TEXT);
      CREATE TABLE user_roles (user_id TEXT, role TEXT);
      CREATE TABLE penugasan_mengajar (id TEXT PRIMARY KEY, guru_id TEXT);
      CREATE TABLE guru_ppl_mapping (id TEXT PRIMARY KEY, guru_ppl_id TEXT, guru_utama_id TEXT);
      CREATE TABLE guru_ppl_profile (user_id TEXT PRIMARY KEY, kampus_id TEXT);
      CREATE TABLE agenda_access_alerts (
        id TEXT PRIMARY KEY, user_a_id TEXT, user_b_id TEXT
      );

      INSERT INTO "user" VALUES
        ('guru_1', 'guru'),
        ('guru_2', 'guru'),
        ('ppl_1', 'guru_ppl'),
        ('ppl_2', 'guru_ppl'),
        ('admin_1', 'admin_tu'),
        ('siswa_1', 'siswa');

      INSERT INTO penugasan_mengajar VALUES ('pm1', 'guru_1');
      INSERT INTO guru_ppl_mapping VALUES ('m1', 'ppl_1', 'guru_1');
    `)
  })

  afterEach(() => {
    sqlite.close()
  })

  it('menganggap pasangan guru mapel dan guru PPL yang dimapping sebagai sah', async () => {
    const isPair = await isGuruMapelAndGuruPplPair(d1(), 'guru_1', 'ppl_1')
    expect(isPair).toBe(true)
    const isPairReverse = await isGuruMapelAndGuruPplPair(d1(), 'ppl_1', 'guru_1')
    expect(isPairReverse).toBe(true)
  })

  it('menganggap pasangan guru mapel dan guru PPL tanpa mapping langsung tetap sah', async () => {
    // ppl_2 belum dimapping ke guru_1, tapi satu guru mapel dan satu guru PPL
    const isPair = await isGuruMapelAndGuruPplPair(d1(), 'guru_1', 'ppl_2')
    expect(isPair).toBe(true)
  })

  it('tetap menganggap kejanggalan jika terjadi antara sesama guru mapel', async () => {
    const isPair = await isGuruMapelAndGuruPplPair(d1(), 'guru_1', 'guru_2')
    expect(isPair).toBe(false)
  })

  it('tetap menganggap kejanggalan jika terjadi antara sesama guru PPL', async () => {
    const isPair = await isGuruMapelAndGuruPplPair(d1(), 'ppl_1', 'ppl_2')
    expect(isPair).toBe(false)
  })

  it('tetap menganggap kejanggalan jika terjadi antara guru/PPL dengan non-guru (admin/siswa)', async () => {
    expect(await isGuruMapelAndGuruPplPair(d1(), 'guru_1', 'admin_1')).toBe(false)
    expect(await isGuruMapelAndGuruPplPair(d1(), 'ppl_1', 'siswa_1')).toBe(false)
  })

  it('membersihkan alert yang melibatkan pasangan guru mapel dan guru PPL', async () => {
    sqlite.exec(`
      INSERT INTO agenda_access_alerts VALUES
        ('a1', 'guru_1', 'ppl_1'),
        ('a2', 'guru_1', 'guru_2'),
        ('a3', 'ppl_1', 'ppl_2');
    `)

    await cleanupGuruMapelAndPplAlerts(d1())

    const remaining = sqlite.prepare('SELECT id FROM agenda_access_alerts ORDER BY id').all() as Array<{ id: string }>
    expect(remaining).toEqual([{ id: 'a2' }, { id: 'a3' }])
  })
})

import { parseDeviceInfo } from './device-info'

describe('parseDeviceInfo', () => {
  it('mendeteksi perangkat Android Redmi Note 12 dari screenshot', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 15; 23021RAA2Y Build/AQ3A.240829.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/151.0.7922.200 Mobile Safari/537.36'
    const result = parseDeviceInfo(ua)
    expect(result).toMatchObject({
      type: 'mobile',
      platformLabel: 'Smartphone Android',
      deviceBrand: 'Xiaomi Redmi Note 12',
      model: '23021RAA2Y',
      os: 'Android 15',
    })
    expect(result.browser).toContain('Chrome Mobile')
  })

  it('mendeteksi perangkat Samsung Android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A.231005.007) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'
    const result = parseDeviceInfo(ua)
    expect(result).toMatchObject({
      type: 'mobile',
      platformLabel: 'Smartphone Android',
      deviceBrand: 'Samsung Galaxy (SM-A546B)',
      model: 'SM-A546B',
      os: 'Android 14',
    })
  })

  it('mendeteksi Apple iPhone', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    const result = parseDeviceInfo(ua)
    expect(result).toMatchObject({
      type: 'mobile',
      platformLabel: 'Apple iPhone',
      deviceBrand: 'Apple iPhone',
      os: 'iOS 17.5.1',
    })
  })

  it('mendeteksi Komputer Desktop Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    const result = parseDeviceInfo(ua)
    expect(result).toMatchObject({
      type: 'desktop',
      platformLabel: 'Komputer Desktop / Laptop',
      deviceBrand: 'PC / Laptop (Windows)',
      os: 'Windows 10 / 11',
    })
  })

  it('menangani string kosong atau null secara aman', () => {
    expect(parseDeviceInfo(null)).toMatchObject({
      type: 'unknown',
      platformLabel: 'Perangkat tidak dikenal',
    })
    expect(parseDeviceInfo('')).toMatchObject({
      type: 'unknown',
    })
  })
})
