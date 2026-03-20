// Lokasi: app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

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

  // Query DB langsung untuk data terbaru (nama, avatar, role)
  const db = await getDB()
  const freshUser = await db.prepare(
    'SELECT nama_lengkap, role, avatar_url FROM "user" WHERE id = ?'
  ).bind(user.id).first<any>()

  const userRole = freshUser?.role || (user as any).role || 'wali_murid'
  const userName = freshUser?.nama_lengkap || (user as any).nama_lengkap || user.name || 'User MANSATAS'
  const avatarUrl = freshUser?.avatar_url || null

  return (
    <div className="flex h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      <Sidebar userRole={userRole} userName={userName} />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header
          userRole={userRole}
          userName={userName}
          userEmail={user.email || ''}
          avatarUrl={avatarUrl}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5">
          <div className="mx-auto max-w-7xl pb-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}