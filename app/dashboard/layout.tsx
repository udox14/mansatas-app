// Lokasi: app/dashboard/layout.tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { BottomNav } from '@/components/layout/bottom-nav'
import { getUserAllowedFeatures, getUserRoles, getPrimaryRole } from '@/lib/features'
import { PushNotificationBanner } from '@/components/shared/PushNotificationBanner'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { DEFAULT_SIDEBAR_GROUPS, parseSidebarGroups, resolveSidebarGroups, type SidebarGroupConfig } from '@/config/menu'
import { getUnreadStudentNoteCountForWali } from '@/lib/student-notes'

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
        navLinks = JSON.parse(freshUser.bottom_nav_override)
      } catch (e) {}
    } else if (roleConfig?.mobile_nav_links) {
      navLinks = JSON.parse(roleConfig.mobile_nav_links)
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
  
  const navEnabled = navLinks.length > 0;

  return (
    <div className="flex h-[100dvh] w-full bg-slate-50 dark:bg-slate-800 dark:bg-slate-950 text-slate-900 dark:text-slate-50 dark:text-slate-100 overflow-hidden">
      <PushNotificationBanner />
      <Sidebar
        userRoles={userRoles}
        primaryRole={primaryRole}
        userName={userName}
        allowedFeatures={allowedFeatures}
        sidebarGroups={sidebarGroups}
        featureLabels={featureLabels}
        featureBadges={featureBadges}
        navEnabled={navEnabled}
      />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header
          userRoles={userRoles}
          primaryRole={primaryRole}
          userName={userName}
          userEmail={user.email || ''}
          avatarUrl={avatarUrl}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5">
          <div className={`mx-auto max-w-7xl ${navEnabled ? 'pb-24' : 'pb-8'}`}>
            <Suspense fallback={<PageSkeleton />}>
              {children}
            </Suspense>
          </div>
        </main>
      </div>
      {navEnabled && (
        <BottomNav activeIds={navLinks} allowedItems={allowedFeatures} featureLabels={featureLabels} />
      )}
    </div>
  )
}
