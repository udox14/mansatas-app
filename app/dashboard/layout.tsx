// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
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
  const supabase = createClient()
  
  // 1. Dapatkan Session Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // 2. Dapatkan Role dari tabel profiles public
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nama_lengkap, avatar_url')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role || 'wali_murid'
  const userName = profile?.nama_lengkap || 'User MANSATAS'
  const avatarUrl = profile?.avatar_url || null

  return (
    // PERUBAHAN: h-screen dan overflow-hidden akan mengunci layout agar tidak jebol ke bawah
    <div className="flex h-screen w-full bg-slate-50/50 text-slate-900 overflow-hidden">
      
      {/* Sidebar akan mengambil h-full otomatis dan tertahan di kiri */}
      <Sidebar userRole={userRole} />
      
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Header otomatis diam (sticky) di bagian atas kolom kanan ini */}
        <Header 
          userRole={userRole} 
          userName={userName} 
          userEmail={user.email || ''} 
          avatarUrl={avatarUrl}
        />
        
        {/* KONTEN UTAMA: Inilah satu-satunya bagian yang bisa di-scroll (dilengkapi custom-scrollbar) */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          <div className="mx-auto max-w-7xl pb-16">
            {children}
          </div>
        </main>
      </div>
      
    </div>
  )
}