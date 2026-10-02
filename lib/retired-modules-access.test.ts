import { describe, expect, it } from 'vitest'
import { getUserAllowedFeatures } from './features'
import { MENU_ITEMS, DEFAULT_SIDEBAR_GROUPS, resolveSidebarGroups } from '@/config/menu'

describe('retired module access before database cleanup', () => {
  it.each(['guru', 'super_admin', 'wakamad'])('ignores stale grants for %s while preserving other permissions', async role => {
    const db = { prepare: (sql: string) => ({
      bind() { return this },
      all: async () => ({ results: sql.includes('user_roles') ? [{ role }] : sql.includes('user_feature_overrides')
        ? [{ feature_id: 'sarpras', action: 'grant' }, { feature_id: 'whatsapp', action: 'grant' }]
        : ['sarpras', 'whatsapp', 'agenda', 'monitoring-pramubakti'].map(feature_id => ({ feature_id })) }),
      first: async () => ({ jabatan_struktural_id: 'jbt_waka_sarpras' }),
    }) } as unknown as D1Database
    const features = await getUserAllowedFeatures(db, 'user')
    expect(features).not.toContain('sarpras')
    expect(features).not.toContain('whatsapp')
    expect(features).toContain('agenda')
    expect(features).toContain('monitoring-pramubakti')
  })

  it('omits retired modules from the catalog and saved sidebar configurations', () => {
    expect(MENU_ITEMS.some(item => ['sarpras', 'whatsapp'].includes(item.id))).toBe(false)
    expect(DEFAULT_SIDEBAR_GROUPS.flatMap(group => group.items)).not.toContain('sarpras')
    expect(DEFAULT_SIDEBAR_GROUPS.flatMap(group => group.items)).not.toContain('whatsapp')
    const resolved = resolveSidebarGroups(DEFAULT_SIDEBAR_GROUPS, '{"itemPlacements":{"custom":["sarpras","agenda","whatsapp"]}}', ['sarpras', 'agenda', 'whatsapp'])
    expect(resolved.flatMap(group => group.items)).toEqual(['agenda'])
  })
})
