import { describe, expect, it } from 'vitest'
import { DEFAULT_SIDEBAR_GROUPS, MENU_ITEMS, resolveSidebarGroups } from '@/config/menu'
import { getUserAllowedFeatures } from './features'

describe('Cuti Guru navigation', () => {
  it.each([
    { role: 'super_admin', position: null, visible: true },
    { role: 'wakamad', position: 'jbt_waka_kurikulum', visible: true },
    { role: 'wakamad', position: 'jbt_waka_sarpras', visible: false },
    { role: 'admin_tu', position: null, visible: false },
    { role: 'play_reviewer', position: null, visible: false },
  ])('resolves access for $role at $position', async ({ role, position, visible }) => {
    const db = {
      prepare(sql: string) {
        return {
          bind() { return this },
          async all() {
            if (sql.includes('FROM user_roles')) return { results: [{ role }] }
            if (sql.includes('FROM user_feature_overrides')) return { results: [{ feature_id: 'cuti-guru', action: 'grant' }] }
            return { results: [] }
          },
          async first() { return { jabatan_struktural_id: position } },
        }
      },
    } as unknown as D1Database
    const allowed = await getUserAllowedFeatures(db, 'user')
    expect(allowed.includes('cuti-guru')).toBe(visible)
  })

  it('adds Cuti Guru to Administrasi & HR for an older saved sidebar template', () => {
    const template = DEFAULT_SIDEBAR_GROUPS.map(group => ({
      ...group, items: group.items.filter(id => id !== 'cuti-guru'),
    }))
    expect(resolveSidebarGroups(template, null, ['cuti-guru'])).toEqual([
      { id: 'administrasi-hr', label: 'Administrasi & HR', items: ['cuti-guru'] },
    ])
    expect(MENU_ITEMS.find(item => item.id === 'cuti-guru')?.href).toBe('/dashboard/cuti-guru')
  })
})
