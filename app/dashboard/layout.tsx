// Lokasi: app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
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
  const userRole = (user as any).role || 'wali_murid'
  const userName = (user as any).nama_lengkap || user.name || 'User MANSATAS'
  const avatarUrl = (user as any).avatar_url || null

  return (
    <div className="flex h-screen w-full bg-slate-50/50 text-slate-900 overflow-hidden">
      <Sidebar userRole={userRole} />
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <Header
          userRole={userRole}
          userName={userName}
          userEmail={user.email || ''}
          avatarUrl={avatarUrl}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          <div className="mx-auto max-w-7xl pb-16">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
