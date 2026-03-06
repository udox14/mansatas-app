// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kehadiran/page.tsx
import { Suspense } from 'react'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { KehadiranClient } from './components/kehadiran-client'
import { CalendarCheck, Loader2 } from 'lucide-react'

export const metadata = { title: 'Kehadiran & Jurnal - MANSATAS App' }

// Mendefinisikan tipe data agar TypeScript rapi
type KelasProps = { id: string, tingkat: number, nomor_kelas: string, kelompok: string }
type PenugasanProps = { 
  id: string, 
  mapel: { nama_mapel: string }, 
  kelas: KelasProps,
  guru?: { nama_lengkap: string } 
}

// ============================================================================
// KOMPONEN PEMUAT DATA (Berjalan Asinkron di Background)
// ============================================================================
async function KehadiranDataFetcher({ profile, isAdmin }: { profile: any, isAdmin: boolean }) {
  const supabase = await createClient()

  // 1. Ambil TA Aktif dan Data Kelas secara paralel untuk kecepatan maksimal
  const [
    { data: taAktif },
    { data: kelas }
  ] = await Promise.all([
    supabase.from('tahun_ajaran').select('id, nama, semester').eq('is_active', true).single(),
    supabase.from('kelas').select('id, tingkat, nomor_kelas, kelompok')
  ])

  // Sorting Master Kelas (Untuk form Rekap Bulanan)
  const rawKelas = (kelas as KelasProps[]) || []
  const kelasList = rawKelas.sort((a, b) => {
    const nameA = `${a.tingkat} ${a.kelompok} ${a.nomor_kelas}`
    const nameB = `${b.tingkat} ${b.kelompok} ${b.nomor_kelas}`
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' })
  })

  // 2. Ambil Data Penugasan (Jadwal Jurnal Harian) jika TA Aktif ada
  let penugasanGuru: PenugasanProps[] = []
  if (taAktif) {
    let query = supabase
      .from('penugasan_mengajar')
      .select(`
        id,
        mapel:mata_pelajaran(nama_mapel),
        kelas:kelas(id, tingkat, nomor_kelas, kelompok),
        guru:profiles(nama_lengkap)
      `)
      .eq('tahun_ajaran_id', taAktif.id)

    // Jika BUKAN admin, batasi HANYA jadwal milik guru tersebut
    if (!isAdmin) {
      query = query.eq('guru_id', profile.id)
    }

    const { data: penugasan } = await query
    
    const rawPenugasan = (penugasan as unknown as PenugasanProps[]) || []
    penugasanGuru = rawPenugasan.sort((a, b) => {
      // Urutkan berdasarkan Kelas, lalu Mapel
      const nameA = `${a.kelas?.tingkat} ${a.kelas?.kelompok} ${a.kelas?.nomor_kelas} ${a.mapel?.nama_mapel}`
      const nameB = `${b.kelas?.tingkat} ${b.kelas?.kelompok} ${b.kelas?.nomor_kelas} ${b.mapel?.nama_mapel}`
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' })
    })
  }

  return (
    <KehadiranClient 
      currentUser={profile}
      taAktif={taAktif || null}
      kelasList={kelasList}
      penugasanGuru={penugasanGuru}
    />
  )
}

// ============================================================================
// HALAMAN UTAMA (Merender Kerangka Instan)
// ============================================================================
export default async function KehadiranPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, nama_lengkap')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const isAdmin = ['super_admin', 'admin_tu', 'kepsek'].includes(profile.role)

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* HEADER HALAMAN - MUNCUL INSTAN 0 DETIK */}
      <div className="flex items-center gap-3">
        <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-700 shadow-sm border border-emerald-200/50">
          <CalendarCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kehadiran & Jurnal</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin 
              ? 'Kelola rekapitulasi bulanan dan pantau jurnal harian seluruh kelas.' 
              : 'Isi jurnal kelas harian dan catat absensi/perilaku siswa.'}
          </p>
        </div>
      </div>

      {/* SUSPENSE BOUNDARY: Loading State yang Elegan */}
      <Suspense fallback={
        <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-12 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center min-h-[400px] animate-in zoom-in-95 duration-300 mt-6">
           <div className="bg-emerald-50 p-5 rounded-full mb-5 shadow-inner border border-emerald-100 relative">
             <div className="absolute inset-0 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin"></div>
             <CalendarCheck className="h-8 w-8 text-emerald-600 animate-pulse" />
           </div>
           <h3 className="text-xl font-bold text-slate-800">Menyiapkan Lembar Kehadiran...</h3>
           <p className="text-slate-500 text-sm mt-2 font-medium max-w-sm text-center">
             Mengambil jadwal mengajar dan sinkronisasi kelas. Mohon tunggu.
           </p>
        </div>
      }>
        <KehadiranDataFetcher profile={profile} isAdmin={isAdmin} />
      </Suspense>

    </div>
  )
}