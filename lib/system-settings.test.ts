import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSystemSettingBoolean, getSystemSettings } from './system-settings'

const state = vi.hoisted(() => ({ db: null as unknown as D1Database, cache: new Map<string, unknown>() }))
vi.mock('@/utils/db-server', () => ({ getDB: async () => state.db }))
vi.mock('@/lib/schema-guard', () => ({ ensureSchemaOnce: async (_key: string, ensure: () => Promise<unknown>) => ensure() }))
vi.mock('@/utils/mem-cache', () => ({ getMemCache: (key: string) => state.cache.get(key),
  setMemCache: (key: string, value: unknown) => state.cache.set(key, value), deleteMemCache: (key: string) => state.cache.delete(key) }))

let sqlite: DatabaseSync
beforeEach(() => {
  state.cache.clear(); sqlite = new DatabaseSync(':memory:')
  state.db = { prepare(sql: string) {
    let args: string[] = []
    return { bind(...values: string[]) { args = values; return this },
      async first() { return sqlite.prepare(sql).get(...args) || null }, async all() { return { results: sqlite.prepare(sql).all(...args) } }, async run() { sqlite.prepare(sql).run(...args) } }
  } } as unknown as D1Database
})
afterEach(() => sqlite.close())

describe('Fresh workflow boolean settings', () => {
  it('reads workflow changes immediately even when a cached setting is stale', async () => {
    expect(await getSystemSettingBoolean('komite_require_principal_approval', false)).toBe(false)
    sqlite.exec("INSERT INTO system_settings(key,value) VALUES ('komite_require_principal_approval','1')")
    expect(await getSystemSettingBoolean('komite_require_principal_approval', false, state.db)).toBe(true)
    expect(await getSystemSettingBoolean('komite_require_principal_approval', false)).toBe(false)
    sqlite.exec("UPDATE system_settings SET value='0'")
    expect(await getSystemSettingBoolean('komite_require_principal_approval', false, state.db)).toBe(false)
  })
  it('preserves both default values when a fresh setting has not been saved', async () => {
    expect(await getSystemSettingBoolean('missing', false, state.db)).toBe(false)
    expect(await getSystemSettingBoolean('missing', true, state.db)).toBe(true)
  })
})

it('reads fresh payment settings without replacing cached display values', async () => {
  const defaults = { keuangan_komite_10_accounts: '[]', missing: 'fallback' }
  expect(await getSystemSettings(defaults)).toEqual(defaults)
  sqlite.prepare('INSERT INTO system_settings(key,value) VALUES (?,?)').run('keuangan_komite_10_accounts', 'new-accounts')
  expect(await getSystemSettings(defaults, state.db)).toEqual({ ...defaults, keuangan_komite_10_accounts: 'new-accounts' })
  expect(await getSystemSettings(defaults)).toEqual(defaults)
})
