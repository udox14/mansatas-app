// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/siswa/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { SiswaClient } from './components/siswa-client'
import { Users } from 'lucide-react'

export const metadata = { title: 'Data Siswa - MANSATAS App' }

export default async function SiswaPage() {
  // PERBAIKAN: Gunakan await karena Next.js 16
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // PERBAIKAN: Mendefinisikan currentUser yang akan dikirim ke Client
  const currentUser = { id: profile.id, role: profile.role }
  const isAdmin = ['super_admin', 'admin_tu', 'kepsek'].includes(profile.role)

  // LOGIKA KEAMANAN: Cari tahu kelas mana saja yang diakses oleh Guru ini
  let allowedKelasIds = new Set<string>()
  if (!isAdmin && profile.role === 'guru') {
    const { data: penugasan } = await supabase.from('penugasan_mengajar').select('kelas_id').eq('guru_id', profile.id)
    const { data: wali } = await supabase.from('kelas').select('id').eq('wali_kelas_id', profile.id)

    penugasan?.forEach(p => allowedKelasIds.add(p.kelas_id))
    wali?.forEach(w => allowedKelasIds.add(w.id))
  }

  const { data: kelasData } = await supabase.from('kelas').select('id, tingkat, nomor_kelas, kelompok, wali_kelas_id')

  let allSiswa: any[] = []
  let fetchError = null
  let hasMore = true
  let page = 0
  const limit = 1000

  if (!isAdmin && allowedKelasIds.size === 0) {
    hasMore = false
  }

  while (hasMore) {
    let query = supabase
      .from('siswa')
      // PERUBAHAN: Ubah select menjadi '*' agar mengambil foto_url dan biodata lengkap
      .select(`*, kelas:kelas_id (id, tingkat, nomor_kelas, kelompok, wali_kelas_id)`)
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
    <div className="space-y-6 animate-in fade-in duration-500">
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

      {/* PERBAIKAN: Memastikan currentUser dikirim */}
      <SiswaClient 
        initialData={formattedSiswaData} 
        kelasList={sortedKelasData} 
        currentUser={currentUser}
      />
    </div>
  )
}