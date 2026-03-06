// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/akademik/page.tsx
import { Suspense } from 'react'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AkademikClient } from './akademik-client'
import { BookOpen, Loader2 } from 'lucide-react'

export const metadata = { title: 'Pusat Akademik - MANSATAS App' }

// ============================================================================
// KOMPONEN PEMUAT DATA (Berjalan Asinkron di Background)
// ============================================================================
async function AkademikDataFetcher() {
  const supabase = await createClient()

  // 1. Ambil TA Aktif dan Master Mapel secara paralel (agar lebih cepat)
  const [
    { data: taAktif },
    { data: mapelData }
  ] = await Promise.all([
    supabase.from('tahun_ajaran').select('id, nama, semester, daftar_jurusan').eq('is_active', true).single(),
    supabase.from('mata_pelajaran').select('*').order('nama_mapel', { ascending: true })
  ])

  // 2. Ambil Penugasan Mengajar (ribuan baris jadwal ASC) jika TA Aktif tersedia
  let penugasanData: any[] = []
  if (taAktif) {
    const { data } = await supabase
      .from('penugasan_mengajar')
      .select(`
        id,
        guru:profiles!inner(nama_lengkap),
        mapel:mata_pelajaran!inner(nama_mapel, kelompok),
        kelas:kelas!inner(tingkat, nomor_kelas, kelompok)
      `)
      .eq('tahun_ajaran_id', taAktif.id)
      .order('created_at', { ascending: false })

    penugasanData = data || []
  }

  const daftarJurusan = taAktif?.daftar_jurusan || ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  return (
    <AkademikClient 
      mapelData={mapelData || []} 
      penugasanData={penugasanData} 
      taAktif={taAktif} 
      daftarJurusan={daftarJurusan}
    />
  )
}

// ============================================================================
// HALAMAN UTAMA (Merender Kerangka Instan)
// ============================================================================
export default async function AkademikPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* HEADER HALAMAN - MUNCUL INSTAN */}
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-700 shadow-sm border border-emerald-200/50">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pusat Akademik</h1>
            <p className="text-sm text-slate-500 mt-1">
              Kelola master mata pelajaran dan jadwal mengajar dari ASC Timetables.
            </p>
          </div>
        </div>
      </div>

      {/* SUSPENSE BOUNDARY: Loading State yang Cantik */}
      <Suspense fallback={
        <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-12 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center min-h-[400px] animate-in zoom-in-95 duration-300">
           <div className="bg-emerald-50 p-4 rounded-full mb-4 shadow-inner border border-emerald-100">
             <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
           </div>
           <h3 className="text-xl font-bold text-slate-800">Menyusun Pusat Akademik...</h3>
           <p className="text-slate-500 text-sm mt-2 font-medium">Memuat master mata pelajaran dan ribuan jadwal mengajar.</p>
        </div>
      }>
        <AkademikDataFetcher />
      </Suspense>

    </div>
  )
}