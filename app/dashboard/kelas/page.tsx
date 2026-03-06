// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kelas/page.tsx
import { Suspense } from 'react'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { KelasClient } from './components/kelas-client'
import { Library } from 'lucide-react'

export const metadata = { title: 'Manajemen Kelas - MANSATAS App' }

// ============================================================================
// KOMPONEN PEMUAT DATA (Berjalan Asinkron di Background)
// ============================================================================
async function KelasDataFetcher() {
  const supabase = await createClient()

  // Ambil data secara paralel (bersamaan) agar jauh lebih cepat
  const [
    { data: kelasData, error: kelasError },
    { data: guruData },
    { data: taAktif }
  ] = await Promise.all([
    // 1. Ambil data Kelas + Relasi Wali Kelas + Jumlah Siswa (Count)
    supabase
      .from('kelas')
      .select(`
        id, tingkat, nomor_kelas, kelompok, kapasitas, wali_kelas_id,
        wali_kelas:profiles!wali_kelas_id(nama_lengkap),
        siswa(count)
      `)
      .order('tingkat', { ascending: true })
      .order('kelompok', { ascending: true })
      .order('nomor_kelas', { ascending: true }),
      
    // 2. Ambil daftar Guru untuk dropdown Wali Kelas
    supabase
      .from('profiles')
      .select('id, nama_lengkap')
      .in('role', ['guru', 'guru_bk'])
      .order('nama_lengkap', { ascending: true }),

    // 3. Ambil Daftar Jurusan Dinamis dari Tahun Ajaran Aktif
    supabase
      .from('tahun_ajaran')
      .select('daftar_jurusan')
      .eq('is_active', true)
      .single()
  ])

  if (kelasError) {
    return <div className="p-4 bg-red-50 text-red-600 rounded-lg">Gagal memuat data: {kelasError.message}</div>
  }

  // Format Data secara strict agar TypeScript aman
  const formattedData = (kelasData || []).map((item: any) => {
    // Handling Supabase count array structure [{ count: X }]
    const jumlahSiswa = item.siswa && item.siswa.length > 0 ? item.siswa[0].count : 0
    
    // Mencegah error jika wali_kelas bentuknya array (karena RLS)
    const waliObj = Array.isArray(item.wali_kelas) ? item.wali_kelas[0] : item.wali_kelas
    
    return {
      id: item.id,
      tingkat: item.tingkat,
      nomor_kelas: item.nomor_kelas,
      kelompok: item.kelompok,
      kapasitas: item.kapasitas || 36,
      wali_kelas_id: item.wali_kelas_id || 'none',
      wali_kelas_nama: waliObj?.nama_lengkap || 'Belum Ditentukan',
      jumlah_siswa: jumlahSiswa
    }
  })

  const daftarJurusan = taAktif?.daftar_jurusan || ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  return (
    <KelasClient 
      initialData={formattedData} 
      daftarGuru={guruData || []} 
      daftarJurusan={daftarJurusan}
    />
  )
}

// ============================================================================
// HALAMAN UTAMA (Merender Kerangka Instan)
// ============================================================================
export default async function KelasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* HEADER HALAMAN - AKAN MUNCUL INSTAN TANPA MENUNGGU DATA */}
      <div className="flex items-center gap-3">
        <div className="bg-blue-100 p-3 rounded-2xl text-blue-700 shadow-sm border border-blue-200/50">
          <Library className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Kelas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola data kelas, kapasitas, dan penugasan Wali Kelas langsung dari tabel.
          </p>
        </div>
      </div>

      {/* SUSPENSE BOUNDARY: Menggunakan CSS Ring Spinner yang 100% Anti-Freeze */}
      <Suspense fallback={
        <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-12 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center min-h-[400px] animate-in zoom-in-95 duration-300 mt-6">
           <div className="bg-blue-50 p-5 rounded-full mb-5 shadow-inner border border-blue-100 relative">
             {/* Elemen Cincin Melingkar yang Berputar Bebas */}
             <div className="absolute inset-0 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
             {/* Ikon di Tengah */}
             <Library className="h-8 w-8 text-blue-600 animate-pulse" />
           </div>
           <h3 className="text-xl font-bold text-slate-800">Membaca Rombongan Belajar...</h3>
           <p className="text-slate-500 text-sm mt-2 font-medium">Mengkalkulasi jumlah siswa tiap kelas, mohon tunggu.</p>
        </div>
      }>
        <KelasDataFetcher />
      </Suspense>

    </div>
  )
}