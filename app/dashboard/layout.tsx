// Lokasi: app/dashboard/layout.tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { BottomNav } from '@/components/layout/bottom-nav'
import { getUserAllowedFeatures, getUserRoles } from '@/lib/features'
import { DashboardFrame } from '@/components/layout/dashboard-frame'
import { DashboardNavigationProvider } from '@/components/layout/dashboard-navigation'
import { groupDashboardMenus, parseDashboardShortcuts, resolveDashboardMenus, resolveDashboardShortcuts } from '@/lib/dashboard-menu'
import { PushNotificationBanner } from '@/components/shared/PushNotificationBanner'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { DEFAULT_SIDEBAR_GROUPS, parseSidebarGroups, resolveSidebarGroups, type SidebarGroupConfig } from '@/config/menu'
import { getUnreadStudentNoteCountForWali } from '@/lib/student-notes'
import { ensureSchemaOnce } from '@/lib/schema-guard'
import { PLAY_REVIEWER_ROLE } from '@/lib/play-reviewer'
import { touchStaffDeviceSession } from '@/lib/staff-device-sessions'

const SIDEBAR_TEMPLATE_KEY = 'default'

export const metadata = {
  title: 'Dashboard - MANSATAS App',
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user

  const db = await getDB()

  await touchStaffDeviceSession(db, {
    sessionId: session.session.id,
    userId: user.id,
  }).catch(error => console.error('Gagal mencatat perangkat sesi:', error))

  // Query semua data user sekaligus (parallel)
  const [freshUser, userRoles, allowedFeatures] = await Promise.all([
    db.prepare(
      'SELECT nama_lengkap, role, avatar_url, bottom_nav_override FROM "user" WHERE id = ?'
    ).bind(user.id).first<any>(),
    getUserRoles(db, user.id),
    getUserAllowedFeatures(db, user.id),
  ])

  const primaryRole = freshUser?.role || (user as any).role || 'guru'
  const userName = freshUser?.nama_lengkap || (user as any).nama_lengkap || user.name || 'User MANSATAS'
  const avatarUrl = freshUser?.avatar_url || null

  // Ambil pengaturan navbar khusus untuk role utama user
  let navLinks: string[] = []
  let sidebarGroups: SidebarGroupConfig[] = DEFAULT_SIDEBAR_GROUPS
  let featureLabels: Record<string, string> = {}
  const featureBadges: Record<string, number> = {}
  try {
    await ensureSchemaOnce('dashboard-sidebar-config', async () => {
      await Promise.all([
        db.prepare(`
          CREATE TABLE IF NOT EXISTS role_sidebar_configs (
            role TEXT PRIMARY KEY,
            groups_json TEXT NOT NULL DEFAULT '[]',
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (role) REFERENCES master_roles(value) ON DELETE CASCADE
          )
        `).run(),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS sidebar_template_config (
            id TEXT PRIMARY KEY DEFAULT '${SIDEBAR_TEMPLATE_KEY}',
            groups_json TEXT NOT NULL DEFAULT '[]',
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `).run(),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS feature_display_settings (
            feature_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `).run(),
      ])
      await db.prepare(`
        INSERT OR IGNORE INTO sidebar_template_config (id, groups_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).bind(SIDEBAR_TEMPLATE_KEY, JSON.stringify(DEFAULT_SIDEBAR_GROUPS)).run()
    })
    const roleConfig = await db.prepare(`
      SELECT mr.mobile_nav_links, rsc.groups_json AS role_sidebar_override, stc.groups_json AS sidebar_template
      FROM master_roles mr
      LEFT JOIN role_sidebar_configs rsc ON rsc.role = mr.value
      LEFT JOIN sidebar_template_config stc ON stc.id = ?
      WHERE mr.value = ?
    `).bind(SIDEBAR_TEMPLATE_KEY, primaryRole).first<any>()
    const featureLabelRows = await db.prepare('SELECT feature_id, title FROM feature_display_settings').all<{ feature_id: string; title: string }>()
    if (freshUser?.bottom_nav_override) {
      try {
        navLinks = parseDashboardShortcuts(freshUser.bottom_nav_override) ?? []
      } catch (e) {}
    } else if (roleConfig?.mobile_nav_links) {
      navLinks = parseDashboardShortcuts(roleConfig.mobile_nav_links) ?? []
    }
    const templateGroups = parseSidebarGroups(roleConfig?.sidebar_template, DEFAULT_SIDEBAR_GROUPS)
    sidebarGroups = resolveSidebarGroups(templateGroups, roleConfig?.role_sidebar_override, allowedFeatures)
    for (const row of featureLabelRows.results ?? []) featureLabels[row.feature_id] = row.title
  } catch(e) {}

  if (allowedFeatures.includes('komite-pengajuan')) {
    try {
      const queueStatuses: string[] = []
      if (userRoles.includes('super_admin') || userRoles.includes('bendahara_komite')) queueStatuses.push('menunggu_bendahara')
      if (userRoles.includes('super_admin') || userRoles.includes('ketua_komite')) queueStatuses.push('menunggu_ketua')
      if (userRoles.includes('super_admin') || userRoles.includes('kepsek')) queueStatuses.push('menunggu_kepala')
      if (queueStatuses.length > 0) {
        const placeholders = queueStatuses.map(() => '?').join(',')
        const count = await db.prepare(`SELECT COUNT(*) AS total FROM komite_pengajuan WHERE status IN (${placeholders}) AND pengaju_id <> ?`)
          .bind(...queueStatuses, user.id).first<{ total: number }>()
        featureBadges['komite-pengajuan'] = Number(count?.total || 0)
      }
    } catch {}
  }

  if (allowedFeatures.includes('kelas-binaan') && userRoles.includes('wali_kelas')) {
    try {
      featureBadges['kelas-binaan'] = await getUnreadStudentNoteCountForWali(db, user.id)
    } catch {
      // Migration catatan siswa mungkin belum diterapkan saat rolling deployment.
    }
  }
  
  const isPlayReviewer = userRoles.includes(PLAY_REVIEWER_ROLE)
  const menus = resolveDashboardMenus(allowedFeatures, featureLabels, featureBadges)
  const menuGroups = groupDashboardMenus(menus, sidebarGroups)
  let storedShortcuts: string[] | null = null
  try {
    const preferences = await db.prepare('SELECT shortcut_ids FROM user_dashboard_preferences WHERE user_id = ?')
      .bind(user.id).first<{ shortcut_ids: string }>()
    storedShortcuts = parseDashboardShortcuts(preferences?.shortcut_ids)
  } catch {
    // Keep the dashboard readable while migration 0103 is being rolled out.
  }
  const shortcutIds = resolveDashboardShortcuts(storedShortcuts, navLinks, menuGroups, [...new Set([primaryRole, ...userRoles])])

  return (
    <DashboardNavigationProvider key={user.id} menus={menus} groups={menuGroups} initialShortcutIds={shortcutIds} readOnly={isPlayReviewer}>
    <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {!isPlayReviewer && <PushNotificationBanner />}
      <Sidebar
        userRoles={userRoles}
        primaryRole={primaryRole}
        userName={userName}
        allowedFeatures={allowedFeatures}
        sidebarGroups={sidebarGroups}
        featureLabels={featureLabels}
        featureBadges={featureBadges}
        navEnabled={true}
      />
      <DashboardFrame header={<Header
          userRoles={userRoles}
          primaryRole={primaryRole}
          userName={userName}
          userEmail={user.email || ''}
          avatarUrl={avatarUrl}
        />}>
            {isPlayReviewer && (
              <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Mode Google Play Reviewer: akses hanya-baca. Data pribadi telah disamarkan dan seluruh perubahan diblokir.
              </div>
            )}
            <Suspense fallback={<PageSkeleton />}>
              {children}
            </Suspense>
      </DashboardFrame>
      <BottomNav activeIds={navLinks} />
    </div>
    </DashboardNavigationProvider>
  )
}
