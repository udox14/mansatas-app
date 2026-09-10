import { beforeEach, expect, it, vi } from 'vitest'
import { MENU_ITEMS } from '@/config/menu'
import { readFileSync } from 'node:fs'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

const mock = vi.hoisted(() => ({ user: vi.fn(), db: vi.fn(), roles: vi.fn(), allowed: vi.fn(), run: vi.fn(), bind: vi.fn(), prepare: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/utils/auth/server', () => ({ getCurrentUser: mock.user }))
vi.mock('@/utils/db-server', () => ({ getDB: mock.db }))
vi.mock('@/lib/features', () => ({ getUserRoles: mock.roles, getUserAllowedFeatures: mock.allowed }))
vi.mock('next/cache', () => ({ revalidatePath: mock.revalidate }))
import { saveDashboardShortcuts } from './shortcut-actions'

const ids = MENU_ITEMS.filter(item => item.id !== 'dashboard').slice(0, 9).map(item => item.id)
beforeEach(() => {
  vi.resetAllMocks()
  mock.user.mockResolvedValue({ id: 'session-user' })
  mock.roles.mockResolvedValue(['guru'])
  mock.allowed.mockResolvedValue(ids)
  mock.run.mockResolvedValue({ success: true })
  mock.bind.mockReturnValue({ run: mock.run })
  mock.prepare.mockReturnValue({ bind: mock.bind })
  mock.db.mockResolvedValue({ prepare: mock.prepare })
})
it('saves ordered IDs for the authenticated user only', async () => {
  expect(await saveDashboardShortcuts([ids[1], ids[0]])).toEqual({ success: true })
  expect(mock.bind).toHaveBeenCalledWith('session-user', JSON.stringify([ids[1], ids[0]]))
  expect(mock.revalidate).toHaveBeenCalledWith('/dashboard', 'layout')
})
it('saves an empty selection so defaults do not reappear', async () => {
  expect(await saveDashboardShortcuts([])).toEqual({ success: true })
  expect(mock.bind).toHaveBeenCalledWith('session-user', '[]')
})
it('rejects unauthenticated requests before accessing data', async () => {
  mock.user.mockResolvedValue(null)
  expect(await saveDashboardShortcuts([])).toHaveProperty('error')
  expect(mock.db).not.toHaveBeenCalled()
})
it('blocks reviewer writes even with admin role', async () => {
  mock.roles.mockResolvedValue(['play_reviewer', 'super_admin'])
  expect(await saveDashboardShortcuts([])).toHaveProperty('error')
  expect(mock.prepare).not.toHaveBeenCalled()
})
it.each([ids, [ids[0], ids[0]], ['unauthorized']].map(selection => [selection]))('rejects invalid selection %j before SQL', async selection => {
  expect(await saveDashboardShortcuts(selection)).toHaveProperty('error')
  expect(mock.prepare).not.toHaveBeenCalled()
})
it('rechecks revoked permissions at save time', async () => {
  mock.allowed.mockResolvedValue([])
  expect(await saveDashboardShortcuts([ids[0]])).toHaveProperty('error')
  expect(mock.run).not.toHaveBeenCalled()
})
it('does not report success or invalidate on a database failure', async () => {
  mock.run.mockRejectedValue(new Error('database unavailable'))
  expect(await saveDashboardShortcuts([ids[0]])).toHaveProperty('error')
  expect(mock.revalidate).not.toHaveBeenCalled()
})

it('persists ordered favorites across reads, isolates accounts, and updates rather than duplicates', async () => {
  const storage = new DatabaseSync(':memory:')
  try {
    storage.exec('PRAGMA foreign_keys = ON; CREATE TABLE "user" (id TEXT PRIMARY KEY); INSERT INTO "user" VALUES (\'session-user\'), (\'second-user\');')
    storage.exec(readFileSync(new URL('../../migrations/0103_dashboard_preferences.sql', import.meta.url), 'utf8'))
    mock.db.mockResolvedValue({ prepare: (sql: string) => ({ bind: (...values: SQLInputValue[]) => ({ run: async () => {
      storage.prepare(sql).run(...values)
      return { success: true }
    } }) }) })
    expect(await saveDashboardShortcuts([ids[1], ids[0]])).toEqual({ success: true })
    const read = (userId: string) => storage.prepare('SELECT shortcut_ids FROM user_dashboard_preferences WHERE user_id = ?').get(userId)?.shortcut_ids
    expect(read('session-user')).toBe(JSON.stringify([ids[1], ids[0]]))
    mock.user.mockResolvedValue({ id: 'second-user' })
    expect(await saveDashboardShortcuts([ids[2]])).toEqual({ success: true })
    expect(read('second-user')).toBe(JSON.stringify([ids[2]]))
    expect(read('session-user')).toBe(JSON.stringify([ids[1], ids[0]]))
    mock.user.mockResolvedValue({ id: 'session-user' })
    expect(await saveDashboardShortcuts([])).toEqual({ success: true })
    expect(read('session-user')).toBe('[]')
    expect(storage.prepare('SELECT COUNT(*) AS count FROM user_dashboard_preferences').get()?.count).toBe(2)
    storage.prepare('DELETE FROM "user" WHERE id = ?').run('second-user')
    expect(read('second-user')).toBeUndefined()
  } finally { storage.close() }
})
