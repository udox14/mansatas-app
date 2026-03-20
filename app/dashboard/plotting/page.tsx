// Lokasi: app/dashboard/plotting/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB, parseJsonCol } from '@/utils/db'
import { redirect } from 'next/navigation'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getSiswaBelumAdaKelas, getKelasByTingkat, getSiswaByTingkat } from './actions'
import { TabSiswaBaru } from './components/tab-siswa-baru'
import { TabPenjurusan } from './components/tab-penjurusan'
import { TabPengacakan } from './components/tab-pengacakan'
import { TabKelulusan } from './components/tab-kelulusan'
import { PlottingTabs } from './components/plotting-tabs'
import { CalendarDays, Network } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'

export const metadata = { title: 'Command Center Plotting - MANSATAS App' }
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

async function PlottingDataFetcher({ currentTab, daftarJurusan }: { currentTab: string, daftarJurusan?: string[] }) {
  const [
    siswaBaruList, kelas10List, siswa10List,
    kelas11List, siswa11List, kelas12List, siswa12List
  ] = await Promise.all([
    getSiswaBelumAdaKelas(),
    getKelasByTingkat(10), getSiswaByTingkat(10),
    getKelasByTingkat(11), getSiswaByTingkat(11),
    getKelasByTingkat(12), getSiswaByTingkat(12)
  ])

  const safeJurusan = daftarJurusan || ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  return (
    <PlottingTabs defaultValue={currentTab}>
      <div className="overflow-x-auto custom-scrollbar pb-2">
        <TabsList className="bg-surface border p-1 h-auto grid grid-cols-4 min-w-[700px] gap-1 rounded-2xl shadow-sm">
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

export default async function PlottingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const currentTab = sp.tab || 'siswa_baru'

  const db = await getDB()
  const taAktif = await db.prepare('SELECT nama, semester, daftar_jurusan FROM tahun_ajaran WHERE is_active = 1').first<any>()
  const daftarJurusan = taAktif?.daftar_jurusan ? parseJsonCol<string[]>(taAktif.daftar_jurusan, []) || undefined : undefined

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Plotting & Kenaikan Kelas"
        description="Pusat kendali algoritma penyebaran siswa, penjurusan, dan kenaikan kelas."
        icon={Network}
        iconColor="text-blue-500"
      >
        {taAktif && (
          <div className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400 dark:text-slate-500 border border-surface px-2.5 py-1 rounded-md bg-surface-2">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>TA: <strong className="text-slate-800 dark:text-slate-100 font-semibold">{taAktif.nama}</strong> SMT {taAktif.semester}</span>
          </div>
        )}
      </PageHeader>
      <Suspense fallback={
<PageLoading text="Memuat data plotting..." />
      }>
        <PlottingDataFetcher currentTab={currentTab} daftarJurusan={daftarJurusan} />
      </Suspense>
    </div>
  )
}