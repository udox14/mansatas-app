import { MENU_ITEMS, SIDEBAR_HIDDEN_SUBROUTE_IDS, type SidebarGroupConfig } from '@/config/menu'

const HIDDEN_UNASSIGNED_IDS = new Set<string>(SIDEBAR_HIDDEN_SUBROUTE_IDS)

export const MAX_DASHBOARD_SHORTCUTS = 8
export type DashboardMenuItem = {
  id: string
  title: string
  href: string
  icon: string
  desc?: string
  badge: number
}
export type DashboardMenuGroup = { id: string; label: string; items: DashboardMenuItem[] }

// Keep the finance aliases supported by the previous dashboard menu.
export function canAccessDashboardMenu(id: string, allowed: readonly string[]) {
  return allowed.includes(id) ||
    (id === 'keuangan-transaksi' && allowed.includes('keuangan-laporan')) ||
    (id === 'keuangan-export' && (allowed.includes('keuangan-dspt') || allowed.includes('keuangan-spp')))
}

export function resolveDashboardMenus(
  allowed: readonly string[], labels: Record<string, string> = {}, badges: Record<string, number> = {},
): DashboardMenuItem[] {
  return MENU_ITEMS.filter(item => item.id !== 'dashboard' && canAccessDashboardMenu(item.id, allowed))
    .map(item => ({ id: item.id, title: labels[item.id] || item.title, href: item.href,
      icon: String(item.icon), desc: item.desc, badge: badges[item.id] || 0 }))
}

export function groupDashboardMenus(menus: DashboardMenuItem[], groups: SidebarGroupConfig[]): DashboardMenuGroup[] {
  const remaining = new Map(menus.map(item => [item.id, item]))
  const result: DashboardMenuGroup[] = []
  for (const group of groups) {
    const items: DashboardMenuItem[] = []
    for (const id of group.items) {
      const item = remaining.get(id)
      if (item) { items.push(item); remaining.delete(id) }
    }
    if (items.length) result.push({ id: group.id, label: group.label, items })
  }
  const unassigned = [...remaining.values()].filter(item => !HIDDEN_UNASSIGNED_IDS.has(item.id))
  if (unassigned.length) result.push({ id: 'dashboard-unassigned', label: 'Lainnya', items: unassigned })
  return result
}

export function searchDashboardMenus(menus: DashboardMenuItem[], query: string) {
  const normalized = query.trim().toLocaleLowerCase('id-ID')
  return menus.filter(item => `${item.title} ${item.desc || ''}`.toLocaleLowerCase('id-ID').includes(normalized))
}

// null means never configured; [] is an intentional empty selection.
export function parseDashboardShortcuts(value: string | null | undefined): string[] | null {
  if (value == null) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every(id => typeof id === 'string') ? parsed : null
  } catch { return null }
}

export function resolveDashboardShortcuts(stored: string[] | null, nav: string[], groups: DashboardMenuGroup[], roles: readonly string[] = []) {
  const allowed = new Set(groups.flatMap(group => group.items.map(item => item.id)))
  const defaults = roles.includes('guru') ? [
    'agenda', 'kehadiran', 'penugasan', roles.includes('wali_kelas') ? 'kelas-binaan' : 'siswa',
    'catatan-siswa', 'nilai-harian', 'ckh-generator', 'tpg-dokumen',
  ] : [...nav, ...allowed]
  const candidates = stored ?? defaults
  return [...new Set(candidates)].filter(id => allowed.has(id)).slice(0, MAX_DASHBOARD_SHORTCUTS)
}

export function validateDashboardShortcuts(value: unknown, allowed: readonly string[]): string | null {
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string')) return 'Pilihan menu tidak valid.'
  if (value.length > MAX_DASHBOARD_SHORTCUTS) return 'Maksimal 8 menu favorit.'
  if (new Set(value).size !== value.length) return 'Menu favorit tidak boleh duplikat.'
  const available = new Set(resolveDashboardMenus(allowed).map(item => item.id))
  if (value.some(id => !available.has(id))) return 'Ada menu yang tidak lagi dapat diakses. Muat ulang halaman.'
  return null
}

export function moveDashboardShortcut(ids: string[], index: number, direction: -1 | 1) {
  const next = index + direction
  if (index < 0 || index >= ids.length || next < 0 || next >= ids.length) return ids
  const result = [...ids]
  ;[result[index], result[next]] = [result[next], result[index]]
  return result
}
