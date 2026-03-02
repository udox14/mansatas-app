// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/plotting/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getSiswaBelumAdaKelas, getKelasByTingkat, getTahunAjaranAktif, getSiswaByTingkat } from './actions'
import { TabSiswaBaru } from './components/tab-siswa-baru'
import { TabPenjurusan } from './components/tab-penjurusan'
import { TabPengacakan } from './components/tab-pengacakan'
import { TabKelulusan } from './components/tab-kelulusan' // IMPORT BARU
import { CalendarDays } from 'lucide-react'

export const metadata = { title: 'Command Center Plotting - MANSATAS App' }

export default async function PlottingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Parallel data fetching yang sangat efisien untuk semua tab
  const [
    taAktif, 
    siswaBaruList, 
    kelas10List, 
    siswa10List, 
    kelas11List,
    siswa11List, 
    kelas12List,
    siswa12List // DATA BARU UNTUK TAB 4
  ] = await Promise.all([
    getTahunAjaranAktif(),
    getSiswaBelumAdaKelas(), // Tab 1
    getKelasByTingkat(10),   // Tab 1
    getSiswaByTingkat(10),   // Tab 2
    getKelasByTingkat(11),   // Tab 2
    getSiswaByTingkat(11),   // Tab 3
    getKelasByTingkat(12),   // Tab 3
    getSiswaByTingkat(12)    // Tab 4: Ambil anak kelas 12 yang siap diluluskan
  ])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Command Center: Plotting & Kenaikan</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pusat kendali algoritma penyebaran siswa, penjurusan, dan kenaikan kelas massal.
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg border border-indigo-100 shadow-sm">
          <CalendarDays className="h-4 w-4" />
          <div className="text-sm font-medium">
            Tahun Ajaran: <strong className="font-bold">{taAktif?.nama}</strong> (SMT {taAktif?.semester})
          </div>
        </div>
      </div>

      <Tabs defaultValue="siswa_baru" className="w-full space-y-6">
        <TabsList className="bg-white border p-1 h-auto grid grid-cols-2 md:grid-cols-4 gap-1">
          <TabsTrigger value="siswa_baru" className="py-2.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">1. Plotting Siswa Baru</TabsTrigger>
          <TabsTrigger value="penjurusan" className="py-2.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">2. Penjurusan (10 ke 11)</TabsTrigger>
          <TabsTrigger value="pengacakan" className="py-2.5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">3. Acak Kenaikan (11 ke 12)</TabsTrigger>
          <TabsTrigger value="kelulusan" className="py-2.5 text-rose-600 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700">4. Kelulusan (12)</TabsTrigger>
        </TabsList>

        <TabsContent value="siswa_baru" className="m-0 focus-visible:ring-0">
          <TabSiswaBaru siswaList={siswaBaruList} kelasList={kelas10List} />
        </TabsContent>

        <TabsContent value="penjurusan" className="m-0 focus-visible:ring-0">
          <TabPenjurusan siswaList={siswa10List} kelasList={kelas11List} />
        </TabsContent>

        <TabsContent value="pengacakan" className="m-0 focus-visible:ring-0">
          <TabPengacakan siswaList={siswa11List} kelasList={kelas12List} />
        </TabsContent>

        {/* KONTEN BARU TAB 4 */}
        <TabsContent value="kelulusan" className="m-0 focus-visible:ring-0">
          <TabKelulusan siswaList={siswa12List} />
        </TabsContent>
      </Tabs>
    </div>
  )
}