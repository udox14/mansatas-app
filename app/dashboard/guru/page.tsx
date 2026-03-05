import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { GuruClient } from './components/guru-client'
import { GraduationCap } from 'lucide-react'

export const metadata = { title: 'Data Guru & Pegawai - MANSATAS App' }

export default async function GuruPage() {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1. Ambil data profil (Nama & Role) dari tabel profiles
  const { data: pegawaiData, error } = await supabase
    .from('profiles')
    .select('id, nama_lengkap, role')
    .neq('role', 'wali_murid')
    .order('nama_lengkap', { ascending: true })

  if (error) {
    return <div className="p-4 bg-red-50 text-red-600 rounded-lg">Gagal memuat data: {error.message}</div>
  }

  // 2. Ambil data Email dari auth.users menggunakan akses Admin
  // (Dibatasi 1000 user per request, cukup untuk skala sekolah)
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  const usersAuth = authData?.users || []

  // 3. Gabungkan data profil dengan emailnya masing-masing
  const mergedData = pegawaiData?.map(p => {
    const userAuth = usersAuth.find(u => u.id === p.id)
    return {
      ...p,
      email: userAuth?.email || 'Email tidak ditemukan'
    }
  }) || []

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-100 p-2.5 rounded-lg text-indigo-700">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Guru & Pegawai</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola data pendidik, hak akses sistem, import massal, dan reset password.
          </p>
        </div>
      </div>

      <GuruClient initialData={mergedData} />
    </div>
  )
}