// Lokasi: app/dashboard/keterangan-absensi/page.tsx
import { getCurrentUser } from '@/utils/auth/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db-server'
import { checkFeatureAccess, checkFeatureCrudAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { KeteranganClient } from './components/keterangan-client'
import { getKelasBinaan } from './actions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAttendanceCorrectionReviewer } from '@/lib/attendance-correction-reviewer'
import { ATTENDANCE_CORRECTION_INBOX, getUnreadStaffNotificationCount } from '@/lib/staff-notification-inbox'
import { getAttendanceCorrectionReview, listAttendanceCorrectionQueue } from './correction-actions'
import { AttendanceCorrectionReview } from './components/correction-review'

export const metadata = { title: 'Riwayat & Koreksi Absensi - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function KeteranganAbsensiPage({ searchParams }: { searchParams: Promise<{ ajuan?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'keterangan-absensi')
  if (!allowed) redirect('/dashboard')

  const [canReadDaily, reviewer, { ajuan }] = await Promise.all([
    checkFeatureCrudAccess(db, user.id, 'keterangan-absensi', 'read'),
    getAttendanceCorrectionReviewer(db, user.id),
    searchParams,
  ])
  const [queue, unread, selected] = reviewer ? await Promise.all([
    listAttendanceCorrectionQueue(),
    getUnreadStaffNotificationCount(db, user.id, true),
    typeof ajuan === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(ajuan)
      ? getAttendanceCorrectionReview(ajuan)
      : ajuan ? { error: 'Ajuan tidak ditemukan.', data: undefined } : null,
  ]) : [null, 0, null] as const
  if (!canReadDaily && !queue) redirect('/dashboard')
  const { kelas, error } = canReadDaily ? await getKelasBinaan() : { kelas: [], error: null }
  const correctionForm = error ? (
    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
  ) : kelas.length === 0 ? (
    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Anda belum ditugaskan sebagai wali kelas.</p>
  ) : <KeteranganClient kelasList={kelas} initialKelasId={kelas[0]?.kelas_id ?? null} />

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-24">
      <PageHeader
        title="Riwayat & Koreksi Absensi"
        description="Tetapkan koreksi status akhir harian siswa tanpa mengubah detail absensi yang diinput guru."
      />

      {queue ? <Tabs defaultValue="persetujuan">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="persetujuan">Persetujuan Koreksi</TabsTrigger>
          {canReadDaily && <TabsTrigger value="koreksi">Koreksi Harian</TabsTrigger>}
        </TabsList>
        <TabsContent value="persetujuan" className="space-y-4">
          <Link href={ATTENDANCE_CORRECTION_INBOX} className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium">
            Notifikasi ajuan ({unread} belum dibaca)
          </Link>
          <AttendanceCorrectionReview key={ajuan || 'daftar'} initial={queue} initialReview={selected?.data} initialError={selected?.error} />
        </TabsContent>
        {canReadDaily && <TabsContent value="koreksi">{correctionForm}</TabsContent>}
      </Tabs> : correctionForm}
    </div>
  )
}
