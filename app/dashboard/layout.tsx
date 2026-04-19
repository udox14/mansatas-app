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
      'SELECT nama_lengkap, role, avatar_url FROM "user" WHERE id = ?'
    ).bind(user.id).first<any>(),
    getUserRoles(db, user.id),
    getUserAllowedFeatures(db, user.id),
  ])

  const primaryRole = freshUser?.role || (user as any).role || 'guru'
  const userName = freshUser?.nama_lengkap || (user as any).nama_lengkap || user.name || 'User MANSATAS'
  const avatarUrl = freshUser?.avatar_url || null

  // Ambil pengaturan navbar khusus untuk role utama user
  let navLinks: string[] = []
  try {
    const roleConfig = await db.prepare("SELECT mobile_nav_links FROM master_roles WHERE value = ?").bind(primaryRole).first<any>()
    if (roleConfig?.mobile_nav_links) {
      navLinks = JSON.parse(roleConfig.mobile_nav_links)
    }
  } catch(e) {}
  
  const navEnabled = navLinks.length > 0;

  return (
    <div className="flex h-[100dvh] w-full bg-slate-50 dark:bg-slate-800 dark:bg-slate-950 text-slate-900 dark:text-slate-50 dark:text-slate-100 overflow-hidden">
      <PushNotificationBanner />
      <Sidebar
        userRoles={userRoles}
        primaryRole={primaryRole}
        userName={userName}
        allowedFeatures={allowedFeatures}
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
        <BottomNav activeIds={navLinks} allowedItems={allowedFeatures} />
      )}
    </div>
  )
}