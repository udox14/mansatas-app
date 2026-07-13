// Lokasi: app/dashboard/agenda/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getPrimaryRole, getUserRoles } from '@/lib/features'
import { ClipboardPen, ShieldCheck, BookOpen } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AgendaClient } from './components/agenda-client'
import { AgendaPiketClient } from './components/agenda-piket-client'
import { RiwayatMateriTab } from './components/riwayat-materi-tab'
import { getJadwalGuruHariIni, getRiwayatMateri, getRiwayatTahunAjaran, type RiwayatTahunAjaran } from './actions'
import { getJadwalPiketHariIni } from './actions-piket'
import { getEffectiveUser, getActAsUserList, getActAsDate } from '@/lib/act-as'
import { ActAsBanner } from '@/components/layout/act-as-banner'

export const metadata = { title: 'Agenda Guru - MANSATAS App' }

// ============================================================
// DATA FETCHER — Mengajar
// ============================================================
async function AgendaDataFetcher({
  effectiveUserId, role, isActingAs, dateOverride,
}: {
  effectiveUserId: string; role: string; isActingAs: boolean; dateOverride?: string
}) {
  const result = await getJadwalGuruHariIni(effectiveUserId, dateOverride)
  return <AgendaClient initialData={result} userRole={role} isActingAs={isActingAs} />
}

// ============================================================
// DATA FETCHER — Piket
// ============================================================
async function AgendaPiketDataFetcher({
  isActingAs, dateOverride,
}: {
  isActingAs: boolean; dateOverride?: string
}) {
  const result = await getJadwalPiketHariIni(dateOverride)
  return <AgendaPiketClient initialData={result} isActingAs={isActingAs} />
}

async function RiwayatDataFetcher({
  effectiveUserId,
  selectedTahunAjaranId,
  tahunAjaranOptions,
}: {
  effectiveUserId: string
  selectedTahunAjaranId?: string
  tahunAjaranOptions: RiwayatTahunAjaran[]
}) {
  const data = await getRiwayatMateri(effectiveUserId, selectedTahunAjaranId)
  const activeTahunAjaranId = tahunAjaranOptions.find(ta => ta.is_active === 1)?.id || null
  const resolvedTahunAjaranId = selectedTahunAjaranId || activeTahunAjaranId

  return (
    <RiwayatMateriTab
      key={resolvedTahunAjaranId || 'tanpa-tahun-ajaran'}
      data={data}
      tahunAjaranOptions={tahunAjaranOptions}
      selectedTahunAjaranId={resolvedTahunAjaranId}
    />
  )
}

export const dynamic = 'force-dynamic'
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; tahun_ajaran_id?: string }>
}) {
  const params = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'agenda')
  if (!allowed) redirect('/dashboard')

  const role = await getPrimaryRole(db, user.id)

  // Check super admin untuk fitur Act As
  const userRoles = await getUserRoles(db, user.id)
  const isSuperAdmin = userRoles.includes('super_admin')

  const effective = await getEffectiveUser()
  const effectiveUserId = effective?.effectiveUserId || user.id
  const isActingAs = effective?.isActingAs || false

  // Tanggal override: URL searchParam lebih prioritas dari cookie
  const urlDate = params?.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null
  const cookieDate = (isSuperAdmin && isActingAs) ? await getActAsDate() : null
  const actAsDate = urlDate || cookieDate

  // Ambil daftar guru hanya jika super admin
  const actAsUsers = isSuperAdmin ? await getActAsUserList() : []
  const tahunAjaranOptions = await getRiwayatTahunAjaran(effectiveUserId)
  const activeTahunAjaranId = tahunAjaranOptions.find(ta => ta.is_active === 1)?.id
  const requestedTahunAjaranId = params?.tahun_ajaran_id
  const selectedTahunAjaranId = requestedTahunAjaranId && tahunAjaranOptions.some(ta => ta.id === requestedTahunAjaranId)
    ? requestedTahunAjaranId
    : activeTahunAjaranId

  // Cek apakah user ini punya jadwal piket (untuk tampilkan/sembunyikan tab)
  // const targetUserId = effectiveUserId || user.id
  // const piketCheck = await db.prepare(`
  //   SELECT j.id
  //   FROM jadwal_guru_piket j
  //   WHERE j.user_id = ?
  //      OR j.id IN (
  //        SELECT jadwal_piket_id
  //        FROM guru_ppl_mapping
  //        WHERE guru_ppl_id = ?
  //          AND jadwal_piket_id IS NOT NULL
  //      )
  //   LIMIT 1
  // `).bind(targetUserId, targetUserId).first<any>()
  const hasPiketJadwal = false // !!piketCheck (disembunyikan sementara)

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Agenda Guru"
        description="Isi agenda mengajar dan catat kehadiran piket sesuai jadwal Anda hari ini."
      />

      {/* Act As Banner — hanya untuk super admin */}
      {isSuperAdmin && (
        <Suspense fallback={null}>
          <ActAsBanner
            isActingAs={isActingAs}
            actAsName={effective?.actAsName || null}
            userList={actAsUsers}
            adminName={effective?.realUserName || 'Admin'}
            actAsDate={actAsDate}
            showDatePicker={true}
          />
        </Suspense>
      )}

      {/* Tabs Layout */}
      <Tabs defaultValue="mengajar" className="space-y-3">
        <TabsList className={`grid w-full ${hasPiketJadwal ? 'grid-cols-3' : 'grid-cols-2'} max-w-sm`}>
          <TabsTrigger value="mengajar" className="text-xs sm:text-sm">
            <ClipboardPen className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Mengajar
          </TabsTrigger>
          {hasPiketJadwal && (
            <TabsTrigger value="piket" className="text-xs sm:text-sm">
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
              Piket
            </TabsTrigger>
          )}
          <TabsTrigger value="riwayat" className="text-xs sm:text-sm">
            <BookOpen className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Riwayat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mengajar">
          <Suspense fallback={<PageLoading text="Memuat jadwal hari ini..." />}>
            <AgendaDataFetcher
              effectiveUserId={effectiveUserId}
              role={role}
              isActingAs={isActingAs}
              dateOverride={actAsDate ?? undefined}
            />
          </Suspense>
        </TabsContent>

        {hasPiketJadwal && (
          <TabsContent value="piket">
            <Suspense fallback={<PageLoading text="Memuat jadwal piket..." />}>
              <AgendaPiketDataFetcher isActingAs={isActingAs} dateOverride={actAsDate ?? undefined} />
            </Suspense>
          </TabsContent>
        )}

        <TabsContent value="riwayat">
          <Suspense fallback={<PageLoading text="Memuat riwayat materi..." />}>
            <RiwayatDataFetcher
              effectiveUserId={effectiveUserId}
              selectedTahunAjaranId={selectedTahunAjaranId}
              tahunAjaranOptions={tahunAjaranOptions}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
