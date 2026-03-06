// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/akademik/analitik/page.tsx
import { Suspense } from 'react'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { PengaturanPanel } from './components/pengaturan-panel'
import { AnalitikClient } from './components/analitik-client'
import { LineChart, Loader2 } from 'lucide-react'

export const metadata = { title: 'Analitik Kelulusan - MANSATAS App' }

// ============================================================================
// KOMPONEN PEMUAT DATA (Berjalan Asinkron di Background)
// ============================================================================
async function AnalitikDataFetcher() {
  const supabase = await createClient()

  // Ambil semua data berat (Pengaturan, Master Mapel, dan JSONB Nilai Siswa) 
  // secara paralel agar prosesnya jauh lebih cepat
  const [
    { data: pengaturan },
    { data: mapelList },
    { data: dataSiswa }
  ] = await Promise.all([
    supabase.from('pengaturan_akademik').select('*').eq('id', 'global').single(),
    supabase.from('mata_pelajaran').select('id, nama_mapel').order('nama_mapel'),
    supabase.from('siswa')
      .select(`
        id, nisn, nama_lengkap, kelas_id,
        kelas!inner (tingkat, kelompok, nomor_kelas),
        rekap_nilai_akademik (nilai_smt1, nilai_smt2, nilai_smt3, nilai_smt4, nilai_smt5, nilai_um)
      `)
      .eq('kelas.tingkat', 12)
      .eq('status', 'aktif')
      .order('nama_lengkap')
  ])

  return (
    <>
      {/* Bagian Atas: Panel Pengaturan Rumus */}
      <PengaturanPanel 
        pengaturan={pengaturan} 
        mapelList={mapelList || []} 
      />

      {/* Bagian Bawah: Dashboard Tabel Super Canggih */}
      <AnalitikClient 
        dataSiswa={(dataSiswa as any) || []} 
        pengaturan={pengaturan} 
      />
    </>
  )
}

// ============================================================================
// HALAMAN UTAMA (Merender Kerangka Instan)
// ============================================================================
export default async function AnalitikPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* HEADER HALAMAN - MUNCUL INSTAN 0 DETIK */}
      <div className="flex items-center gap-3">
        <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-700 shadow-sm border border-emerald-200/50">
          <LineChart className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analitik Kelulusan & SNBP</h1>
          <p className="text-sm text-slate-500 mt-1">
            Data Warehouse nilai dari RDM. Penghitungan otomatis kuota Eligible SNBP 40% & SPAN-PTKIN.
          </p>
        </div>
      </div>

      {/* SUSPENSE BOUNDARY: Loading State yang Cantik & Informatif */}
      <Suspense fallback={
        <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-12 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center min-h-[500px] animate-in zoom-in-95 duration-300 mt-6">
           <div className="bg-emerald-50 p-5 rounded-full mb-5 shadow-inner border border-emerald-100 relative">
             <div className="absolute inset-0 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin"></div>
             <LineChart className="h-8 w-8 text-emerald-600 animate-pulse" />
           </div>
           <h3 className="text-xl font-bold text-slate-800">Menarik Data Warehouse RDM...</h3>
           <p className="text-slate-500 text-sm mt-2 font-medium max-w-sm text-center">
             Mengkalkulasi matriks nilai 5 semester dan memproses perankingan algoritma SNBP & SPAN. Mohon tunggu.
           </p>
        </div>
      }>
        <AnalitikDataFetcher />
      </Suspense>

    </div>
  )
}