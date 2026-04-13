// Lokasi: app/dashboard/presensi/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { PresensiClient } from './components/presensi-client'
import { ClipboardCheck } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'
import { todayWIB } from '@/lib/time'

export const metadata = { title: 'Presensi Pegawai - MANSATAS App' }

async function PresensiDataFetcher({ currentUserId, isSuperAdmin }: { currentUserId: string; isSuperAdmin: boolean }) {
  const db = await getDB()
  const today = todayWIB()

  const [pegawaiResult, presensiResult, settingResult] = await Promise.all([
    db.prepare(`
      SELECT u.id, u.nama_lengkap, u.email, u.domisili_pegawai, u.avatar_url,
             u.jabatan_struktural_id, u.role,
             j.nama as jabatan_nama
      FROM "user" u
      LEFT JOIN master_jabatan_struktural j ON u.jabatan_struktural_id = j.id
      WHERE u.role NOT IN ('siswa', 'wali_murid')
      ORDER BY CASE WHEN u.jabatan_struktural_id IS NOT NULL THEN 0 ELSE 1 END ASC,
               j.urutan ASC, u.nama_lengkap ASC
    `).all<any>(),
    db.prepare(`
      SELECT * FROM presensi_pegawai WHERE tanggal = ?
    `).bind(today).all<any>(),
    db.prepare('SELECT * FROM pengaturan_presensi WHERE id = ?').bind('global').first<any>(),
  ])

  return (
    <PresensiClient
      pegawai={(pegawaiResult.results || []).map((p: any) => ({
        ...p,
        jabatan_nama: p.jabatan_nama || p.role?.replace(/_/g, ' ').toUpperCase() || 'Staf / Guru',
        is_struktural: !!p.jabatan_struktural_id
      }))}
      presensiHariIni={presensiResult.results || []}
      pengaturan={settingResult || { jam_masuk: '07:00', jam_pulang: '14:00', batas_telat_menit: 15, batas_pulang_cepat_menit: 15 }}
      tanggal={today}
      currentUserId={currentUserId}
      isSuperAdmin={isSuperAdmin}
    />
  )
}

export const dynamic = 'force-dynamic'
export default async function PresensiPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'presensi')
  if (!allowed) redirect('/dashboard')

  const userRoles = await getUserRoles(db, user.id)
  const isSuperAdmin = userRoles.includes('super_admin')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Presensi Pegawai"
        description="Input presensi harian pejabat struktural & TU."
      />
      <Suspense fallback={<PageLoading text="Memuat data presensi..." />}>
        <PresensiDataFetcher currentUserId={user.id} isSuperAdmin={isSuperAdmin} />
      </Suspense>
    </div>
  )
}
