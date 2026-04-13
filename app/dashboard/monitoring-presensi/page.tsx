// Lokasi: app/dashboard/monitoring-presensi/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { checkFeatureAccess } from '@/lib/features'
import { MonitoringClient } from './components/monitoring-client'
import { BarChart3 } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'
import { todayWIB } from '@/lib/time'

export const metadata = { title: 'Monitoring Presensi - MANSATAS App' }

async function MonitoringDataFetcher() {
  const db = await getDB()

  const today = todayWIB()

  const [pegawaiResult, presensiHariIniResult, pengaturanPresensi, pengaturanTunjangan] = await Promise.all([
    db.prepare(`
      SELECT u.id, u.nama_lengkap, u.domisili_pegawai, j.nama as jabatan_nama
      FROM "user" u
      INNER JOIN master_jabatan_struktural j ON u.jabatan_struktural_id = j.id
      ORDER BY j.urutan ASC, u.nama_lengkap ASC
    `).all<any>(),
    db.prepare(`
      SELECT p.*, u.nama_lengkap, u.domisili_pegawai, j.nama as jabatan_nama
      FROM presensi_pegawai p
      JOIN "user" u ON p.user_id = u.id
      LEFT JOIN master_jabatan_struktural j ON u.jabatan_struktural_id = j.id
      WHERE p.tanggal = ?
      ORDER BY u.nama_lengkap ASC
    `).bind(today).all<any>(),
    db.prepare('SELECT * FROM pengaturan_presensi WHERE id = ?').bind('global').first<any>(),
    db.prepare('SELECT * FROM pengaturan_tunjangan WHERE id = ?').bind('global').first<any>(),
  ])

  let tiers = []
  try { tiers = JSON.parse(pengaturanTunjangan?.aturan_tiers || '[]') } catch {}

  return (
    <MonitoringClient
      pegawai={pegawaiResult.results || []}
      presensiHariIni={presensiHariIniResult.results || []}
      pengaturanPresensi={pengaturanPresensi || {
        jam_masuk: '07:00', jam_pulang: '14:00',
        batas_telat_menit: 15, batas_pulang_cepat_menit: 15,
        hari_kerja: '[1,2,3,4,5,6]'
      }}
      pengaturanTunjangan={{
        nominal_dalam: pengaturanTunjangan?.nominal_dalam || 0,
        nominal_luar: pengaturanTunjangan?.nominal_luar || 0,
        tanggal_bayar: pengaturanTunjangan?.tanggal_bayar || 25,
        aturan_tiers: tiers,
      }}
      tanggalHariIni={today}
    />
  )
}


export const dynamic = 'force-dynamic'
export default async function MonitoringPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'monitoring-presensi')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Monitoring Presensi"
        description="Pantau kehadiran, cetak rekap, kelola pengaturan & tunjangan."
      />
      <Suspense fallback={<PageLoading text="Memuat monitoring..." />}>
        <MonitoringDataFetcher />
      </Suspense>
    </div>
  )
}
