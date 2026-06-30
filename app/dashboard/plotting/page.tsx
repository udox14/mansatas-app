// Lokasi: app/dashboard/plotting/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { parseJsonCol } from '@/utils/db'
import { redirect } from 'next/navigation'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getSiswaBelumAdaKelas,
  getKelasByTingkat,
  getSiswaByTingkat,
  getSiswaLulusByRiwayatTingkat,
  getTahunAjaranList,
} from './actions'
import { TabSiswaBaru } from './components/tab-siswa-baru'
import { TabPenjurusan } from './components/tab-penjurusan'
import { TabPengacakan } from './components/tab-pengacakan'
import { TabKelulusan } from './components/tab-kelulusan'
import { PlottingTabs } from './components/plotting-tabs'
import { ExportPlottingModal } from './components/export-plotting-modal'
import { CalendarDays, Network, Users, GitBranch, Shuffle, GraduationCap } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'

export const metadata = { title: 'Command Center Plotting - MANSATAS App' }
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

type TahunAjaranOption = {
  id: string
  nama: string
  semester: number
  is_active?: number
  daftar_jurusan?: string | null
}

type PlottingContext = {
  source_tahun_ajaran_id: string
  target_tahun_ajaran_id: string
  source_tahun_ajaran_label?: string
  target_tahun_ajaran_label?: string
  is_target_active?: boolean
}

function getDefaultContext(years: TahunAjaranOption[], targetParam?: string) {
  const active = years.find((ta) => ta.is_active === 1) ?? years[0]
  const source = active
  const target =
    years.find((ta) => ta.id === targetParam) ??
    years.find((ta) => source && ta.nama > source.nama) ??
    source

  return { active, source, target }
}

function YearContextForm({
  years,
  source,
  target,
  currentTab,
}: {
  years: TahunAjaranOption[]
  source?: TahunAjaranOption
  target?: TahunAjaranOption
  currentTab: string
}) {
  if (!years.length || !source || !target) return null

  return (
    <form method="get" className="rounded-lg border border-surface bg-surface p-3">
      <input type="hidden" name="tab" value={currentTab} />
      <input type="hidden" name="source_ta" value={source.id} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,420px)_auto] md:items-end">
        <div className="rounded-md border border-surface bg-surface-2 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Data asal
          </span>
          <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {source.nama} SMT {source.semester} {source.is_active === 1 ? '(aktif)' : ''}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
            Kelas asal otomatis disimpan ke riwayat sebelum hasil plotting diterapkan.
          </p>
        </div>

        <label className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Simpan hasil ke
          </span>
          <select
            name="target_ta"
            defaultValue={target.id}
            className="h-10 w-full rounded-md border border-surface bg-surface-2 px-2 text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            {years.map((ta) => (
              <option key={ta.id} value={ta.id}>
                {ta.nama} SMT {ta.semester}{ta.is_active === 1 ? ' - aktif' : ''}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="h-10 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Terapkan
        </button>
      </div>
    </form>
  )
}

async function PlottingDataFetcher({
  currentTab,
  daftarJurusan,
  context,
}: {
  currentTab: string
  daftarJurusan?: string[]
  context: PlottingContext
}) {
  const [
    siswaBaruList, kelas10List, siswa10List,
    kelas11List, siswa11List, kelas12List, siswa12List, siswa12LulusList
  ] = await Promise.all([
    getSiswaBelumAdaKelas(),
    getKelasByTingkat(10, context.target_tahun_ajaran_id),
    getSiswaByTingkat(10, context.source_tahun_ajaran_id, context.target_tahun_ajaran_id),
    getKelasByTingkat(11, context.target_tahun_ajaran_id),
    getSiswaByTingkat(11, context.source_tahun_ajaran_id, context.target_tahun_ajaran_id),
    getKelasByTingkat(12, context.target_tahun_ajaran_id),
    getSiswaByTingkat(12, context.source_tahun_ajaran_id, context.target_tahun_ajaran_id),
    getSiswaLulusByRiwayatTingkat(12)
  ])

  const safeJurusan = daftarJurusan || ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  return (
    <PlottingTabs defaultValue={currentTab}>
      <div className="overflow-x-auto pb-1">
        <TabsList className="bg-surface-2 border border-surface p-1 h-auto grid grid-cols-4 min-w-[560px] gap-1 rounded-xl">
          <TabsTrigger value="siswa_baru" className="group flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-slate-500 dark:text-slate-400 font-medium text-sm transition-all duration-150 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-slate-700 dark:hover:text-slate-200 hover:bg-surface">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">1. Plotting Baru</span>
          </TabsTrigger>
          <TabsTrigger value="penjurusan" className="group flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-slate-500 dark:text-slate-400 font-medium text-sm transition-all duration-150 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-slate-700 dark:hover:text-slate-200 hover:bg-surface">
            <GitBranch className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">2. Penjurusan (11)</span>
          </TabsTrigger>
          <TabsTrigger value="pengacakan" className="group flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-slate-500 dark:text-slate-400 font-medium text-sm transition-all duration-150 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-slate-700 dark:hover:text-slate-200 hover:bg-surface">
            <Shuffle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">3. Acak Naik (12)</span>
          </TabsTrigger>
          <TabsTrigger value="kelulusan" className="group flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-slate-500 dark:text-slate-400 font-medium text-sm transition-all duration-150 data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-sm hover:text-slate-700 dark:hover:text-slate-200 hover:bg-surface">
            <GraduationCap className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">4. Kelulusan</span>
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="siswa_baru" className="m-0 focus-visible:ring-0">
        <TabSiswaBaru siswaList={siswaBaruList} kelasList={kelas10List} plottingContext={context} />
      </TabsContent>
      <TabsContent value="penjurusan" className="m-0 focus-visible:ring-0">
        <TabPenjurusan siswaList={siswa10List} kelasList={kelas11List} daftarJurusan={safeJurusan} plottingContext={context} />
      </TabsContent>
      <TabsContent value="pengacakan" className="m-0 focus-visible:ring-0">
        <TabPengacakan siswaList={siswa11List} kelasList={kelas12List} plottingContext={context} />
      </TabsContent>
      <TabsContent value="kelulusan" className="m-0 focus-visible:ring-0">
        <TabKelulusan siswaList={siswa12List} siswaLulusList={siswa12LulusList} />
      </TabsContent>
    </PlottingTabs>
  )
}

export default async function PlottingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; source_ta?: string; target_ta?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const currentTab = sp.tab || 'siswa_baru'
  const tahunAjaranList = await getTahunAjaranList()
  const { active, source, target } = getDefaultContext(tahunAjaranList, sp.target_ta)
  const daftarJurusan = target?.daftar_jurusan
    ? parseJsonCol<string[]>(target.daftar_jurusan, []) || undefined
    : undefined

  const plottingContext = {
    source_tahun_ajaran_id: source?.id ?? active?.id ?? '',
    target_tahun_ajaran_id: target?.id ?? source?.id ?? active?.id ?? '',
    source_tahun_ajaran_label: source ? `${source.nama} SMT ${source.semester}` : undefined,
    target_tahun_ajaran_label: target ? `${target.nama} SMT ${target.semester}` : undefined,
    is_target_active: target?.is_active === 1,
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Plotting & Kenaikan Kelas"
        description="Pusat kendali algoritma penyebaran siswa, penjurusan, dan kenaikan kelas."
        icon={Network}
        iconColor="text-blue-500"
      >
        {active && (
          <div className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400 border border-surface px-2.5 py-1 rounded-md bg-surface-2">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>TA aktif: <strong className="text-slate-800 dark:text-slate-100 font-semibold">{active.nama}</strong> SMT {active.semester}</span>
          </div>
        )}
        {plottingContext.source_tahun_ajaran_id && plottingContext.target_tahun_ajaran_id && (
          <ExportPlottingModal
            sourceTaId={plottingContext.source_tahun_ajaran_id}
            targetTaId={plottingContext.target_tahun_ajaran_id}
            targetTaLabel={plottingContext.target_tahun_ajaran_label}
          />
        )}
      </PageHeader>

      <YearContextForm years={tahunAjaranList} source={source} target={target} currentTab={currentTab} />

      <Suspense fallback={<PageLoading text="Memuat data plotting..." />}>
        {plottingContext.source_tahun_ajaran_id && plottingContext.target_tahun_ajaran_id ? (
          <PlottingDataFetcher currentTab={currentTab} daftarJurusan={daftarJurusan} context={plottingContext} />
        ) : (
          <div className="rounded-lg border border-dashed border-surface p-8 text-center text-sm text-slate-500">
            Tahun ajaran belum tersedia. Buat tahun ajaran terlebih dahulu di Pengaturan.
          </div>
        )}
      </Suspense>
    </div>
  )
}
