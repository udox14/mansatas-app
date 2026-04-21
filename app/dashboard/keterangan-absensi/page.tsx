// Lokasi: app/dashboard/keterangan-absensi/page.tsx
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { KeteranganClient } from './components/keterangan-client'
import { getKelasBinaan } from './actions'

export const metadata = { title: 'Keterangan Absensi - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function KeteranganAbsensiPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'keterangan-absensi')
  if (!allowed) redirect('/dashboard')

  const { kelas, error } = await getKelasBinaan()

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-24">
      <PageHeader
        title="Keterangan Absensi"
        description="Input keterangan sakit atau izin siswa kelas binaan Anda."
      />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : kelas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Anda belum ditugaskan sebagai wali kelas.
          </p>
        </div>
      ) : (
        <KeteranganClient kelasList={kelas} initialKelasId={kelas[0]?.kelas_id ?? null} />
      )}
    </div>
  )
}
