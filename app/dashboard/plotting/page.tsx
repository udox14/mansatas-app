// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/plotting/page.tsx
import { Suspense } from 'react'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getSiswaBelumAdaKelas, getKelasByTingkat, getSiswaByTingkat } from './actions'
import { TabSiswaBaru } from './components/tab-siswa-baru'
import { TabPenjurusan } from './components/tab-penjurusan'
import { TabPengacakan } from './components/tab-pengacakan'
import { TabKelulusan } from './components/tab-kelulusan'
import { PlottingTabs } from './components/plotting-tabs'
import { CalendarDays, Network, Loader2 } from 'lucide-react'

export const metadata = { title: 'Command Center Plotting - MANSATAS App' }
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// ============================================================================
// KOMPONEN PEMUAT DATA (Berjalan Asinkron di Background)
// ============================================================================
async function PlottingDataFetcher({ currentTab, daftarJurusan }: { currentTab: string, daftarJurusan?: string[] }) {
  // Tarik SEMUA data berat (ribuan siswa & kelas) secara paralel agar sangat cepat
  const [
    siswaBaruList, kelas10List, siswa10List, 
    kelas11List, siswa11List, kelas12List, siswa12List 
  ] = await Promise.all([
    getSiswaBelumAdaKelas(), 
    getKelasByTingkat(10),   
    getSiswaByTingkat(10),   
    getKelasByTingkat(11),   
    getSiswaByTingkat(11),   
    getKelasByTingkat(12),   
    getSiswaByTingkat(12)    
  ])

  const safeJurusan = daftarJurusan || ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  return (
    <PlottingTabs defaultValue={currentTab}>
      <div className="overflow-x-auto custom-scrollbar pb-2">
        <TabsList className="bg-white border p-1 h-auto grid grid-cols-4 min-w-[700px] gap-1 rounded-2xl shadow-sm">
          <TabsTrigger value="siswa_baru" className="py-2.5 rounded-xl data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 font-bold">1. Plotting Baru</TabsTrigger>
          <TabsTrigger value="penjurusan" className="py-2.5 rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 font-bold">2. Penjurusan (11)</TabsTrigger>
          <TabsTrigger value="pengacakan" className="py-2.5 rounded-xl data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 font-bold">3. Acak Naik (12)</TabsTrigger>
          <TabsTrigger value="kelulusan" className="py-2.5 rounded-xl text-rose-600 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700 font-bold">4. Kelulusan</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="siswa_baru" className="m-0 focus-visible:ring-0">
        <TabSiswaBaru siswaList={siswaBaruList} kelasList={kelas10List} />
      </TabsContent>
      <TabsContent value="penjurusan" className="m-0 focus-visible:ring-0">
        <TabPenjurusan siswaList={siswa10List} kelasList={kelas11List} daftarJurusan={safeJurusan} />
      </TabsContent>
      <TabsContent value="pengacakan" className="m-0 focus-visible:ring-0">
        <TabPengacakan siswaList={siswa11List} kelasList={kelas12List} />
      </TabsContent>
      <TabsContent value="kelulusan" className="m-0 focus-visible:ring-0">
        <TabKelulusan siswaList={siswa12List} />
      </TabsContent>
    </PlottingTabs>
  )
}

// ============================================================================
// HALAMAN UTAMA (Merender Kerangka Instan)
// ============================================================================
export default async function PlottingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const currentTab = sp.tab || 'siswa_baru'

  // Mengambil 1 baris TA Aktif di halaman utama agar header bisa langsung muncul
  const { data: taAktif } = await supabase
    .from('tahun_ajaran')
    .select('nama, semester, daftar_jurusan')
    .eq('is_active', true)
    .single()

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* HEADER HALAMAN - MUNCUL INSTAN 0 DETIK */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-3 rounded-2xl text-blue-700 shadow-sm border border-blue-200/50">
            <Network className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Command Center: Plotting</h1>
            <p className="text-sm text-slate-500 mt-1">
              Pusat kendali algoritma penyebaran siswa, penjurusan, dan kenaikan kelas.
            </p>
          </div>
        </div>
        
        {/* Info TA Aktif Langsung Ditampilkan */}
        {taAktif && (
          <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-xl border border-indigo-100 shadow-sm shrink-0">
            <CalendarDays className="h-4 w-4" />
            <div className="text-sm font-medium">Tahun Ajaran: <strong className="font-bold">{taAktif.nama}</strong> (SMT {taAktif.semester})</div>
          </div>
        )}
      </div>

      {/* SUSPENSE BOUNDARY: Loading State yang Mewah */}
      <Suspense fallback={
        <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-12 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center min-h-[500px] animate-in zoom-in-95 duration-300">
           <div className="bg-blue-50 p-5 rounded-full mb-5 shadow-inner border border-blue-100 relative">
             <div className="absolute inset-0 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
             <Network className="h-8 w-8 text-blue-600 animate-pulse" />
           </div>
           <h3 className="text-xl font-bold text-slate-800">Menghitung Matriks Algoritma...</h3>
           <p className="text-slate-500 text-sm mt-2 font-medium max-w-sm text-center">
             Mengkalkulasi sebaran ribuan siswa, kapasitas rombongan belajar, dan tiket penjurusan. Mohon tunggu.
           </p>
        </div>
      }>
        <PlottingDataFetcher currentTab={currentTab} daftarJurusan={taAktif?.daftar_jurusan} />
      </Suspense>

    </div>
  )
}