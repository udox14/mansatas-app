// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/plotting/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getSiswaBelumAdaKelas, getKelasByTingkat, getTahunAjaranAktif, getSiswaByTingkat } from './actions'
import { TabSiswaBaru } from './components/tab-siswa-baru'
import { TabPenjurusan } from './components/tab-penjurusan'
import { TabPengacakan } from './components/tab-pengacakan'
import { TabKelulusan } from './components/tab-kelulusan'
import { PlottingTabs } from './components/plotting-tabs'
import { CalendarDays } from 'lucide-react'

export const metadata = { title: 'Command Center Plotting - MANSATAS App' }
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function PlottingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const currentTab = sp.tab || 'siswa_baru'

  // PERBAIKAN: Ambil daftar jurusan dari Tahun Ajaran yang AKTIF
  const { data: taUtama } = await supabase.from('tahun_ajaran').select('daftar_jurusan').eq('is_active', true).single()
  const daftarJurusan = taUtama?.daftar_jurusan || ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  const [
    taAktif, siswaBaruList, kelas10List, siswa10List, 
    kelas11List, siswa11List, kelas12List, siswa12List 
  ] = await Promise.all([
    getTahunAjaranAktif(),
    getSiswaBelumAdaKelas(), 
    getKelasByTingkat(10),   
    getSiswaByTingkat(10),   
    getKelasByTingkat(11),   
    getSiswaByTingkat(11),   
    getKelasByTingkat(12),   
    getSiswaByTingkat(12)    
  ])

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Command Center: Plotting & Kenaikan</h1>
          <p className="text-sm text-slate-500 mt-1">Pusat kendali algoritma penyebaran siswa, penjurusan, dan kenaikan kelas massal.</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg border border-indigo-100 shadow-sm">
          <CalendarDays className="h-4 w-4" />
          <div className="text-sm font-medium">Tahun Ajaran: <strong className="font-bold">{taAktif?.nama}</strong> (SMT {taAktif?.semester})</div>
        </div>
      </div>

      <PlottingTabs defaultValue={currentTab}>
        <div className="overflow-x-auto custom-scrollbar pb-2">
          <TabsList className="bg-white border p-1 h-auto grid grid-cols-4 min-w-[700px] gap-1 rounded-2xl shadow-sm">
            <TabsTrigger value="siswa_baru" className="py-2.5 rounded-xl data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">1. Plotting Baru</TabsTrigger>
            <TabsTrigger value="penjurusan" className="py-2.5 rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">2. Penjurusan (11)</TabsTrigger>
            <TabsTrigger value="pengacakan" className="py-2.5 rounded-xl data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">3. Acak Naik (12)</TabsTrigger>
            <TabsTrigger value="kelulusan" className="py-2.5 rounded-xl text-rose-600 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700">4. Kelulusan (Lulus)</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="siswa_baru" className="m-0 focus-visible:ring-0"><TabSiswaBaru siswaList={siswaBaruList} kelasList={kelas10List} /></TabsContent>
        <TabsContent value="penjurusan" className="m-0 focus-visible:ring-0"><TabPenjurusan siswaList={siswa10List} kelasList={kelas11List} daftarJurusan={daftarJurusan} /></TabsContent>
        <TabsContent value="pengacakan" className="m-0 focus-visible:ring-0"><TabPengacakan siswaList={siswa11List} kelasList={kelas12List} /></TabsContent>
        <TabsContent value="kelulusan" className="m-0 focus-visible:ring-0"><TabKelulusan siswaList={siswa12List} /></TabsContent>
      </PlottingTabs>
    </div>
  )
}