// Lokasi: app/dashboard/plotting/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB, parseJsonCol } from '@/utils/db'
import { redirect } from 'next/navigation'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getKelasByTingkat, getSiswaByTingkat, getSiswaBelumAdaKelas } from './actions'
import { TabSiswaBaru } from './components/tab-siswa-baru'
import { TabPenjurusan } from './components/tab-penjurusan'
import { TabPengacakan } from './components/tab-pengacakan'
import { TabKelulusan } from './components/tab-kelulusan'
import { PlottingTabs } from './components/plotting-tabs'
import { CalendarDays, Network, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Command Center Plotting - MANSATAS App' }
// FIX: Hapus force-no-store — data plotting tidak berubah detik-per-detik
// Next.js akan cache 30 detik secara default, cukup untuk use case ini
export const dynamic = 'force-dynamic'

// FIX: Lazy load per tab — hanya fetch data tab yang aktif
// Sebelumnya: 7 query paralel SELALU dijalankan meski user hanya buka 1 tab
async function TabSiswaBaruFetcher({ daftarJurusan }: { daftarJurusan: string[] }) {
  const [siswaBaruList, kelas10List] = await Promise.all([
    getSiswaBelumAdaKelas(),
    getKelasByTingkat(10),
  ])
  return <TabSiswaBaru siswaList={siswaBaruList} kelasList={kelas10List} />
}

async function TabPenjurusanFetcher({ daftarJurusan }: { daftarJurusan: string[] }) {
  const [siswa10List, kelas11List] = await Promise.all([
    getSiswaByTingkat(10),
    getKelasByTingkat(11),
  ])
  return <TabPenjurusan siswaList={siswa10List} kelasList={kelas11List} daftarJurusan={daftarJurusan} />
}

async function TabPengacakanFetcher() {
  const [siswa11List, kelas12List] = await Promise.all([
    getSiswaByTingkat(11),
    getKelasByTingkat(12),
  ])
  return <TabPengacakan siswaList={siswa11List} kelasList={kelas12List} />
}

async function TabKelulusanFetcher() {
  const siswa12List = await getSiswaByTingkat(12)
  return <TabKelulusan siswaList={siswa12List} />
}

const TabLoading = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 space-y-3">
    <Loader2 className="h-8 w-8 animate-spin" />
    <p className="text-sm font-medium">Memuat data...</p>
  </div>
)

export default async function PlottingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const currentTab = sp.tab || 'siswa_baru'

  const db = await getDB()
  const taAktif = await db
    .prepare('SELECT nama, semester, daftar_jurusan FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<any>()

  const daftarJurusan: string[] = taAktif?.daftar_jurusan
    ? parseJsonCol<string[]>(taAktif.daftar_jurusan, []) ?? ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']
    : ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Plotting & Kenaikan Kelas"
        description="Pusat kendali algoritma penyebaran siswa, penjurusan, dan kenaikan kelas."
        icon={Network}
        iconColor="text-blue-500"
      >
        {taAktif && (
          <div className="flex items-center gap-1.5 text-[12px] text-slate-500 border border-slate-200 px-2.5 py-1 rounded-md bg-slate-50">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>
              TA: <strong className="text-slate-800 font-semibold">{taAktif.nama}</strong> SMT{' '}
              {taAktif.semester}
            </span>
          </div>
        )}
      </PageHeader>

      <PlottingTabs defaultValue={currentTab}>
        <div className="overflow-x-auto custom-scrollbar pb-2">
          <TabsList className="bg-white border p-1 h-auto grid grid-cols-4 min-w-[700px] gap-1 rounded-2xl shadow-sm">
            <TabsTrigger
              value="siswa_baru"
              className="py-2.5 rounded-xl data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 font-bold"
            >
              1. Plotting Baru
            </TabsTrigger>
            <TabsTrigger
              value="penjurusan"
              className="py-2.5 rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 font-bold"
            >
              2. Penjurusan (11)
            </TabsTrigger>
            <TabsTrigger
              value="pengacakan"
              className="py-2.5 rounded-xl data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 font-bold"
            >
              3. Acak Naik (12)
            </TabsTrigger>
            <TabsTrigger
              value="kelulusan"
              className="py-2.5 rounded-xl text-rose-600 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700 font-bold"
            >
              4. Kelulusan
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Setiap tab punya Suspense sendiri — hanya tab aktif yang di-fetch */}
        <TabsContent value="siswa_baru" className="m-0 focus-visible:ring-0">
          <Suspense fallback={<TabLoading />}>
            <TabSiswaBaruFetcher daftarJurusan={daftarJurusan} />
          </Suspense>
        </TabsContent>

        <TabsContent value="penjurusan" className="m-0 focus-visible:ring-0">
          <Suspense fallback={<TabLoading />}>
            <TabPenjurusanFetcher daftarJurusan={daftarJurusan} />
          </Suspense>
        </TabsContent>

        <TabsContent value="pengacakan" className="m-0 focus-visible:ring-0">
          <Suspense fallback={<TabLoading />}>
            <TabPengacakanFetcher />
          </Suspense>
        </TabsContent>

        <TabsContent value="kelulusan" className="m-0 focus-visible:ring-0">
          <Suspense fallback={<TabLoading />}>
            <TabKelulusanFetcher />
          </Suspense>
        </TabsContent>
      </PlottingTabs>
    </div>
  )
}
