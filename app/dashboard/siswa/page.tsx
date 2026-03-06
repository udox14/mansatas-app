// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/siswa/page.tsx
import { Suspense } from 'react'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { SiswaClient } from './components/siswa-client'
import { Users, Loader2 } from 'lucide-react'

export const metadata = { title: 'Data Siswa - MANSATAS App' }

// ============================================================================
// KOMPONEN PEMUAT DATA (Berjalan Asinkron di Background)
// ============================================================================
async function SiswaDataFetcher({ profile, isAdmin, allowedKelasIds, currentUser }: any) {
  const supabase = await createClient()

  // Ambil Data Kelas
  const { data: kelasData } = await supabase.from('kelas').select('id, tingkat, nomor_kelas, kelompok, wali_kelas_id')

  let allSiswa: any[] = []
  let fetchError = null
  let hasMore = true
  let page = 0
  const limit = 1000

  if (!isAdmin && allowedKelasIds.size === 0) {
    hasMore = false
  }

  // Loop pengambilan data untuk mem-bypass limit 1000 baris Supabase
  while (hasMore) {
    let query = supabase
      .from('siswa')
      .select(`id, nisn, nama_lengkap, jenis_kelamin, status, foto_url, tempat_tinggal, kelas_id, kelas:kelas_id(id, tingkat, nomor_kelas, kelompok, wali_kelas_id)`)
      .order('nama_lengkap', { ascending: true })
      .range(page * limit, (page + 1) * limit - 1)

    if (!isAdmin) {
      query = query.in('kelas_id', Array.from(allowedKelasIds))
    }

    const { data, error } = await query

    if (error) {
      fetchError = error
      break
    }

    allSiswa = [...allSiswa, ...(data || [])]
    if (data.length < limit) {
      hasMore = false
    }
    page++
  }

  if (fetchError) {
    return <div className="p-4 bg-rose-50 text-rose-600 rounded-xl">Gagal memuat data: {fetchError.message}</div>
  }

  const formattedSiswaData = allSiswa.map((s: any) => ({
    ...s,
    kelas: Array.isArray(s.kelas) ? s.kelas[0] : s.kelas
  }))

  const rawKelasData = (kelasData || []) as any[]
  const dropdownKelasData = isAdmin 
    ? rawKelasData 
    : rawKelasData.filter(k => allowedKelasIds.has(k.id))

  const sortedKelasData = dropdownKelasData.sort((a, b) => {
    const nameA = `${a.tingkat} ${a.kelompok} ${a.nomor_kelas}`
    const nameB = `${b.tingkat} ${b.kelompok} ${b.nomor_kelas}`
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' })
  })

  return (
    <SiswaClient 
      initialData={formattedSiswaData} 
      kelasList={sortedKelasData} 
      currentUser={currentUser}
    />
  )
}

// ============================================================================
// KOMPONEN HALAMAN UTAMA (Merender Instan)
// ============================================================================
export default async function SiswaPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const currentUser = { id: profile.id, role: profile.role }
  const isAdmin = ['super_admin', 'admin_tu', 'kepsek'].includes(profile.role)

  let allowedKelasIds = new Set<string>()
  if (!isAdmin && profile.role === 'guru') {
    const { data: penugasan } = await supabase.from('penugasan_mengajar').select('kelas_id').eq('guru_id', profile.id)
    const { data: wali } = await supabase.from('kelas').select('id').eq('wali_kelas_id', profile.id)

    penugasan?.forEach(p => allowedKelasIds.add(p.kelas_id))
    wali?.forEach(w => allowedKelasIds.add(w.id))
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER HALAMAN - AKAN MUNCUL INSTAN TANPA MENUNGGU DATA */}
      <div className="flex items-center gap-3">
        <div className="bg-blue-100 p-3 rounded-2xl text-blue-700 shadow-sm border border-blue-200/50">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Data Siswa</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin 
              ? 'Kelola data profil dan status siswa secara massal.' 
              : 'Daftar siswa di kelas yang Anda ajar.'}
          </p>
        </div>
      </div>

      {/* SUSPENSE BOUNDARY: Menampilkan efek loading sambil menunggu data selesai ditarik */}
      <Suspense fallback={
        <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-12 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center min-h-[400px] animate-in zoom-in-95 duration-300">
           <div className="bg-blue-50 p-4 rounded-full mb-4 shadow-inner">
             <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
           </div>
           <h3 className="text-xl font-bold text-slate-800">Menyiapkan Database Siswa...</h3>
           <p className="text-slate-500 text-sm mt-2 font-medium">Mengambil dan menyusun ribuan data, mohon tunggu beberapa detik.</p>
        </div>
      }>
        <SiswaDataFetcher 
          profile={profile}
          isAdmin={isAdmin}
          allowedKelasIds={allowedKelasIds}
          currentUser={currentUser}
        />
      </Suspense>

    </div>
  )
}