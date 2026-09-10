import { describe, expect, it } from 'vitest'
import { MENU_ITEMS } from '@/config/menu'
import { groupDashboardMenus, moveDashboardShortcut, parseDashboardShortcuts, resolveDashboardMenus, resolveDashboardShortcuts, searchDashboardMenus, validateDashboardShortcuts } from './dashboard-menu'

const ids = MENU_ITEMS.filter(item => item.id !== 'dashboard').slice(0, 12).map(item => item.id)

describe('dashboard menu permissions and discovery', () => {
  it('exposes only allowed routes with custom labels and badges', () => {
    const menus = resolveDashboardMenus([ids[0], 'dashboard'], { [ids[0]]: 'Menu saya' }, { [ids[0]]: 5 })
    expect(menus).toHaveLength(1)
    expect(menus[0]).toMatchObject({ id: ids[0], title: 'Menu saya', badge: 5 })
  })
  it('keeps finance aliases and filters unknown IDs', () => {
    const menus = resolveDashboardMenus(['keuangan-laporan', 'keuangan-spp', 'unknown']).map(item => item.id)
    expect(menus).toContain('keuangan-transaksi')
    expect(menus).toContain('keuangan-export')
    expect(menus).not.toContain('unknown')
    expect(resolveDashboardMenus([])).toEqual([])
  })
  it('includes ungrouped and root menus exactly once', () => {
    const menus = resolveDashboardMenus(ids)
    const groups = groupDashboardMenus(menus, [{ id: 'one', label: 'Pertama', items: [ids[1], ids[0], 'unknown'] }, { id: 'two', label: 'Kedua', items: [ids[0]] }])
    expect(groups[0].items.map(item => item.id)).toEqual([ids[1], ids[0]])
    expect(groups.flatMap(group => group.items)).toHaveLength(menus.length)
    expect(groups.at(-1)?.label).toBe('Lainnya')
  })
  it('searches custom labels and descriptions case-insensitively', () => {
    const menus = [{ ...resolveDashboardMenus([ids[0]])[0], title: 'Absensi', desc: 'Laporan Kehadiran Guru' }]
    expect(searchDashboardMenus(menus, '  ABSENSI ')).toEqual(menus)
    expect(searchDashboardMenus(menus, 'kehadiran')).toEqual(menus)
    expect(searchDashboardMenus(menus, 'xyz')).toEqual([])
  })
})

describe('dashboard favorite preferences', () => {
  const groups = groupDashboardMenus(resolveDashboardMenus(ids), [])
  it('seeds nav first, deduplicates, then fills by group order to eight', () => {
    const selected = resolveDashboardShortcuts(null, [ids[3], ids[3], 'dashboard', 'unknown'], groups)
    expect(selected).toHaveLength(8)
    expect(selected[0]).toBe(ids[3])
    expect(selected.slice(1, 4)).toEqual([ids[0], ids[1], ids[2]])
  })
  it('keeps an intentional empty or partial selection without filling it', () => {
    expect(parseDashboardShortcuts('[]')).toEqual([])
    expect(resolveDashboardShortcuts([], ids, groups)).toEqual([])
    expect(resolveDashboardShortcuts([ids[4]], ids, groups)).toEqual([ids[4]])
  })
  it('hides revoked and removed menus while preserving the remaining order', () => {
    expect(resolveDashboardShortcuts([ids[2], 'revoked', ids[0]], [], groups)).toEqual([ids[2], ids[0]])
  })
  it('treats missing or malformed stored preferences as unconfigured', () => {
    for (const value of [null, undefined, '{', '{}', '[1]']) expect(parseDashboardShortcuts(value)).toBeNull()
  })
  it('rejects ninth, duplicate, non-string, unknown, or unauthorized entries', () => {
    expect(validateDashboardShortcuts(ids.slice(0, 8), ids)).toBeNull()
    expect(validateDashboardShortcuts([], ids)).toBeNull()
    for (const value of [ids.slice(0, 9), [ids[0], ids[0]], [1], null, ['unknown'], [ids[10]]]) {
      expect(validateDashboardShortcuts(value, ids.slice(0, 10))).toBeTypeOf('string')
    }
  })
  it('reorders without mutating and handles boundaries', () => {
    const initial = [ids[0], ids[1], ids[2]]
    expect(moveDashboardShortcut(initial, 1, -1)).toEqual([ids[1], ids[0], ids[2]])
    expect(moveDashboardShortcut(initial, 1, 1)).toEqual([ids[0], ids[2], ids[1]])
    expect(moveDashboardShortcut(initial, 0, -1)).toEqual(initial)
    expect(initial).toEqual(ids.slice(0, 3))
  })
})
