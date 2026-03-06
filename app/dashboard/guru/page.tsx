// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/guru/page.tsx
import { Suspense } from 'react'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { GuruClient } from './components/guru-client'
import { GraduationCap, Loader2 } from 'lucide-react'

export const metadata = { title: 'Data Guru & Pegawai - MANSATAS App' }

// ============================================================================
// KOMPONEN PEMUAT DATA (Berjalan Asinkron di Background)
// ============================================================================
async function GuruDataFetcher() {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()

  // Ambil data profil (Nama & Role) dari tabel profiles dan Email dari auth admin secara paralel agar lebih cepat
  const [
    { data: pegawaiData, error: pegawaiError },
    { data: authData, error: authErr }
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nama_lengkap, role')
      .neq('role', 'wali_murid')
      .order('nama_lengkap', { ascending: true }),
    
    // Dibatasi 1000 user per request, cukup untuk skala sekolah
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  ])

  if (pegawaiError) {
    return <div className="p-4 bg-rose-50 text-rose-600 rounded-xl">Gagal memuat data profil: {pegawaiError.message}</div>
  }

  if (authErr) {
     return <div className="p-4 bg-rose-50 text-rose-600 rounded-xl">Gagal memuat data autentikasi: {authErr.message}</div>
  }

  const usersAuth = authData?.users || []

  // Gabungkan data profil dengan emailnya masing-masing
  const mergedData = pegawaiData?.map(p => {
    const userAuth = usersAuth.find(u => u.id === p.id)
    return {
      ...p,
      email: userAuth?.email || 'Email tidak ditemukan'
    }
  }) || []

  return <GuruClient initialData={mergedData} />
}

// ============================================================================
// HALAMAN UTAMA (Merender Kerangka Instan)
// ============================================================================
export default async function GuruPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* HEADER HALAMAN - MUNCUL INSTAN 0 DETIK */}
      <div className="flex items-center gap-3">
        <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-700 shadow-sm border border-indigo-200/50">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Guru & Pegawai</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola data pendidik, hak akses sistem, import massal, dan reset password.
          </p>
        </div>
      </div>

      {/* SUSPENSE BOUNDARY: Loading State yang Cantik & Informatif */}
      <Suspense fallback={
        <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-12 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center min-h-[400px] animate-in zoom-in-95 duration-300 mt-6">
           <div className="bg-indigo-50 p-5 rounded-full mb-5 shadow-inner border border-indigo-100 relative">
             <div className="absolute inset-0 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
             <GraduationCap className="h-8 w-8 text-indigo-600 animate-pulse" />
           </div>
           <h3 className="text-xl font-bold text-slate-800">Memuat Data Kepegawaian...</h3>
           <p className="text-slate-500 text-sm mt-2 font-medium max-w-sm text-center">
             Menyinkronkan data profil dengan sistem autentikasi keamanan Supabase. Mohon tunggu.
           </p>
        </div>
      }>
        <GuruDataFetcher />
      </Suspense>

    </div>
  )
}