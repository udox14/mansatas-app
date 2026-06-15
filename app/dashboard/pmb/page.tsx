// Lokasi: app/dashboard/pmb/page.tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { PmbClient } from './components/pmb-client'

export const metadata = { title: 'PMB - MANSATAS App' }
export const dynamic = 'force-dynamic'

async function PmbFetcher() {
  const db = await getDB()
  const [pendaftarRes, jadwalRes, pengaturanRes] = await Promise.all([
    db.prepare(
      `SELECT p.id, p.no_pendaftaran, p.tahun_ajaran, p.jalur, p.status_verifikasi, p.status_kelulusan,
        p.berkas_ditolak, p.siswa_id, p.nisn, p.nik, p.nama_lengkap, p.jenis_kelamin, p.asal_sekolah,
        p.no_telepon_ortu, p.tanggal_tes, p.sesi_tes, p.ruang_tes, p.daftar_ulang_status, p.created_at, p.foto_url,
        d.status AS dspt_status
       FROM pmb_pendaftar p
       LEFT JOIN fin_dspt d ON p.siswa_id IS NOT NULL AND d.siswa_id = p.siswa_id
       ORDER BY p.no_pendaftaran`,
    ).all<any>(),
    db.prepare('SELECT * FROM pmb_jadwal_tes ORDER BY tanggal, sesi').all<any>(),
    db.prepare('SELECT key, value FROM pmb_pengaturan').all<{ key: string; value: string }>(),
  ])

  const pengaturan: Record<string, string> = {}
  for (const r of pengaturanRes.results || []) pengaturan[r.key] = r.value

  return (
    <PmbClient
      pendaftar={pendaftarRes.results || []}
      jadwal={jadwalRes.results || []}
      pengaturan={pengaturan}
    />
  )
}

export default async function PmbPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'pmb')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="PMB - Penerimaan Murid Baru"
        description="Verifikasi berkas, penjadwalan tes, kelulusan, dan konversi ke data siswa."
      />
      <Suspense fallback={<PageLoading text="Menyiapkan data PMB..." />}>
        <PmbFetcher />
      </Suspense>
    </div>
  )
}
