// Lokasi: app/dashboard/kedisiplinan/page.tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { redirect } from 'next/navigation'
import { checkFeatureAccess, getPrimaryRole, getUserRoles } from '@/lib/features'
import { BarChart3, BookOpen, CalendarDays, ClipboardList, MessageSquareText, Users } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { KedisiplinanClient } from './components/kedisiplinan-client'
import { PageHeader } from '@/components/layout/page-header'
import { loadSanksiList, type SanksiConfig } from '@/lib/sanksi-service'
import { canReviewDisciplineRecord, ensureParentDisciplineSchema } from '@/lib/parent-discipline'
import { getActiveDisciplineYear, loadDisciplineHistory, loadPublishedDisciplineTotals } from '@/lib/discipline-history'
import { AnalitikKedisiplinanClient } from './components/analitik-client'
import { MonitoringKedisiplinanClient } from '../monitoring-kedisiplinan/components/monitoring-kedisiplinan-client'
import { getAnalitikKedisiplinan } from './actions'
import { resolveKedisiplinanTab, type KedisiplinanTab } from '@/lib/kedisiplinan-tabs'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Kedisiplinan - MANSATAS App' }

const TABS: { id: KedisiplinanTab; label: string; icon: typeof ClipboardList }[] = [
  { id: 'riwayat', label: 'Riwayat Pelanggaran', icon: ClipboardList },
  { id: 'monitoring', label: 'Monitoring Pelanggar', icon: Users },
  { id: 'analitik', label: 'Analitik & Radar', icon: BarChart3 },
  { id: 'kamus', label: 'Kamus & Poin', icon: BookOpen },
  { id: 'klarifikasi', label: 'Klarifikasi Ortu', icon: MessageSquareText },
]

async function KedisiplinanDataFetcher({ currentUser, taAktifId, sanksiList, lifetimePoin, initialTab }: {
  currentUser: any
  taAktifId: string
  sanksiList: SanksiConfig[]
  lifetimePoin: Record<string, number>
  initialTab: 'riwayat' | 'kamus' | 'klarifikasi'
}) {
  const db = await getDB()
  await ensureParentDisciplineSchema(db)

  const [kasus, masterResult, tingkatResult, clarificationResult] = await Promise.all([
    loadDisciplineHistory(db, taAktifId),
    db.prepare(`SELECT id, kategori, nama_pelanggaran, poin FROM master_pelanggaran ORDER BY poin ASC`).all<any>(),
    db.prepare(`SELECT DISTINCT tingkat FROM kelas WHERE tingkat IS NOT NULL`).all<{ tingkat: string | number }>(),
    db.prepare(`
      SELECT pdc.*, s.nama_lengkap AS siswa_nama
      FROM parent_discipline_clarifications pdc
      JOIN siswa s ON s.id = pdc.siswa_id
      ORDER BY CASE pdc.status WHEN 'baru' THEN 0 WHEN 'diproses' THEN 1 ELSE 2 END, pdc.created_at DESC
      LIMIT 100
    `).all<any>(),
  ])

  const formattedKasus = kasus.map(p => ({
    id: p.id, tanggal: p.tanggal, jam_input: p.jam_input ?? '', keterangan: p.keterangan, foto_url: p.foto_url,
    publication_status: p.publication_status || 'published', review_note: p.review_note, reviewed_at: p.reviewed_at,
    siswa_id: p.siswa_id, master_pelanggaran_id: p.master_pelanggaran_id, diinput_oleh: p.diinput_oleh,
    siswa: { nama_lengkap: p.siswa_nama, foto_url: p.siswa_foto ?? null, kelas: p.tingkat ? { tingkat: p.tingkat, nomor_kelas: p.nomor_kelas, kelompok: p.kelompok } : null },
    master_pelanggaran: { nama_pelanggaran: p.nama_pelanggaran, kategori: p.kategori, poin: p.poin },
    pelapor: { nama_lengkap: p.pelapor_nama }
  }))

  const tingkatList = (tingkatResult.results || []).map(row => String(row.tingkat))
  const reviewableStudentIds = new Set<string>()
  const studentIds = Array.from(new Set([
    ...kasus.map(row => row.siswa_id),
    ...(clarificationResult.results || []).map((row: any) => String(row.siswa_id)),
  ]))
  await Promise.all(studentIds.map(async siswaId => {
    if (await canReviewDisciplineRecord(db, currentUser.id, siswaId)) reviewableStudentIds.add(siswaId)
  }))
  const reviewableRecordIds = formattedKasus.filter(row => reviewableStudentIds.has(row.siswa_id)).map(row => row.id)
  const clarifications = (clarificationResult.results || []).filter((row: any) => reviewableStudentIds.has(String(row.siswa_id)))

  return <KedisiplinanClient
    currentUser={currentUser}
    kasusList={formattedKasus}
    masterList={masterResult.results || []}
    taAktifId={taAktifId}
    sanksiList={sanksiList}
    lifetimePoin={lifetimePoin}
    tingkatList={tingkatList}
    reviewableRecordIds={reviewableRecordIds}
    clarifications={clarifications}
    initialTab={initialTab}
    showTabNavigation={false}
  />
}

async function KedisiplinanFetcher({ currentUser, taAktifId, initialTab }: {
  currentUser: any
  taAktifId: string
  initialTab: 'riwayat' | 'kamus' | 'klarifikasi'
}) {
  const db = await getDB()
  await ensureParentDisciplineSchema(db)
  const [sanksiList, lifetimePoin] = await Promise.all([
    loadSanksiList(db),
    loadPublishedDisciplineTotals(db),
  ])
  return <KedisiplinanDataFetcher currentUser={currentUser} taAktifId={taAktifId} sanksiList={sanksiList} lifetimePoin={lifetimePoin} initialTab={initialTab} />
}

async function MonitoringDataFetcher({ currentUser, taAktifId, sanksiList, lifetimePoin }: {
  currentUser: any
  taAktifId: string
  sanksiList: SanksiConfig[]
  lifetimePoin: Record<string, number>
}) {
  const db = await getDB()
  const [kasusResult, masterResult, tingkatResult] = await Promise.all([
    db.prepare(`
      SELECT sp.id, sp.tanggal, sp.jam_input, sp.keterangan, sp.foto_url, sp.siswa_id, sp.master_pelanggaran_id, sp.diinput_oleh,
        s.nama_lengkap as siswa_nama, s.foto_url as siswa_foto, k.tingkat, k.nomor_kelas, k.kelompok,
        COALESCE(sp.nama_pelanggaran_snapshot, mp.nama_pelanggaran) AS nama_pelanggaran,
        COALESCE(sp.kategori_snapshot, mp.kategori) AS kategori,
        COALESCE(sp.poin_snapshot, mp.poin) AS poin, u.nama_lengkap as pelapor_nama
      FROM siswa_pelanggaran sp
      JOIN siswa s ON sp.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      LEFT JOIN "user" u ON sp.diinput_oleh = u.id
      WHERE sp.tahun_ajaran_id = ?
      ORDER BY sp.tanggal DESC, sp.created_at DESC
    `).bind(taAktifId).all<any>(),
    db.prepare(`SELECT id, kategori, nama_pelanggaran, poin FROM master_pelanggaran ORDER BY poin ASC`).all<any>(),
    db.prepare(`SELECT DISTINCT tingkat FROM kelas WHERE tingkat IS NOT NULL`).all<{ tingkat: string | number }>(),
  ])

  const formattedKasus = (kasusResult.results || []).map((p: any) => ({
    id: p.id,
    tanggal: p.tanggal,
    jam_input: p.jam_input ?? '',
    keterangan: p.keterangan,
    foto_url: p.foto_url,
    siswa_id: p.siswa_id,
    master_pelanggaran_id: p.master_pelanggaran_id,
    diinput_oleh: p.diinput_oleh,
    siswa: { nama_lengkap: p.siswa_nama, foto_url: p.siswa_foto ?? null, kelas: p.tingkat ? { tingkat: p.tingkat, nomor_kelas: p.nomor_kelas, kelompok: p.kelompok } : null },
    master_pelanggaran: { nama_pelanggaran: p.nama_pelanggaran, kategori: p.kategori, poin: p.poin },
    pelapor: { nama_lengkap: p.pelapor_nama },
  }))
  const tingkatList = (tingkatResult.results || []).map(row => String(row.tingkat))

  return <MonitoringKedisiplinanClient
    currentUser={currentUser}
    kasusList={formattedKasus}
    masterList={masterResult.results || []}
    taAktifId={taAktifId}
    sanksiList={sanksiList}
    lifetimePoin={lifetimePoin}
    tingkatList={tingkatList}
  />
}

async function MonitoringFetcher({ currentUser, taAktifId }: { currentUser: any; taAktifId: string }) {
  const db = await getDB()
  const [sanksiList, lifetimePoinRes] = await Promise.all([
    loadSanksiList(db),
    db.prepare(`
      SELECT sp.siswa_id, SUM(mp.poin) as total_poin
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      GROUP BY sp.siswa_id
    `).all<any>(),
  ])
  const lifetimePoin: Record<string, number> = {}
  for (const row of (lifetimePoinRes.results || [])) lifetimePoin[row.siswa_id] = row.total_poin
  return <MonitoringDataFetcher currentUser={currentUser} taAktifId={taAktifId} sanksiList={sanksiList} lifetimePoin={lifetimePoin} />
}

async function AnalitikFetcher({ taAktifId, isAdmin }: { taAktifId: string; isAdmin: boolean }) {
  const data = await getAnalitikKedisiplinan(taAktifId)
  return <AnalitikKedisiplinanClient data={data} isAdmin={isAdmin} />
}

export const dynamic = 'force-dynamic'
export default async function KedisiplinanPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeTab = resolveKedisiplinanTab(resolvedSearchParams?.tab)
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'kedisiplinan')
    || await checkFeatureAccess(db, user.id, 'monitoring-kedisiplinan')
  if (!allowed) redirect('/dashboard')

  const [role, roles] = await Promise.all([
    getPrimaryRole(db, user.id),
    getUserRoles(db, user.id),
  ])
  const currentUser = { id: user.id, role, roles, nama: (user as any).nama_lengkap ?? user.name ?? '' }
  const isAdmin = ['super_admin', 'admin_tu', 'kepsek'].includes(role)
  const innerDisciplineTab = activeTab === 'kamus' || activeTab === 'klarifikasi' ? activeTab : 'riwayat'
  const taAktif = await getActiveDisciplineYear(db)
  if (!taAktif) return (
    <div className="p-8 text-center text-rose-500 font-bold bg-rose-50 rounded-xl m-8">
      Tahun Ajaran aktif belum diatur oleh Admin. Hubungi Tata Usaha.
    </div>
  )

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Kedisiplinan"
        description="Catat pelanggaran, pantau siswa berisiko, dan tindak lanjuti pembinaan dalam satu modul."
      >
        <div className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800/60 dark:border-slate-700">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>TA: <strong className="text-slate-800 dark:text-slate-200 dark:text-slate-100 font-semibold">{taAktif.nama}</strong></span>
        </div>
      </PageHeader>

      <div className="space-y-4">
        <nav aria-label="Bagian kedisiplinan" className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-surface bg-surface p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={`/dashboard/kedisiplinan?tab=${id}`}
              aria-current={activeTab === id ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm',
                activeTab === id
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </Link>
          ))}
        </nav>

        {activeTab === 'monitoring' ? (
          <Suspense fallback={<PageLoading text="Memuat monitoring pelanggar..." />}>
            <MonitoringFetcher currentUser={currentUser} taAktifId={taAktif.id} />
          </Suspense>
        ) : activeTab === 'analitik' ? (
          <Suspense fallback={<PageLoading text="Memuat analitik kedisiplinan..." />}>
            <AnalitikFetcher taAktifId={taAktif.id} isAdmin={isAdmin} />
          </Suspense>
        ) : (
          <Suspense fallback={<PageLoading text="Memuat data kedisiplinan..." />}>
            <KedisiplinanFetcher currentUser={currentUser} taAktifId={taAktif.id} initialTab={innerDisciplineTab} />
          </Suspense>
        )}
      </div>
    </div>
  )
}
