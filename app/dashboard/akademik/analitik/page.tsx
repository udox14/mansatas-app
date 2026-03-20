// Lokasi: app/dashboard/akademik/analitik/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB, parseJsonCol } from '@/utils/db'
import { redirect } from 'next/navigation'
import { PengaturanPanel } from './components/pengaturan-panel'
import { AnalitikClient } from './components/analitik-client'
import { LineChart } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'

export const metadata = { title: 'Analitik Kelulusan - MANSATAS App' }

async function AnalitikDataFetcher() {
  const db = await getDB()

  const [pengaturan, mapelResult, siswaResult] = await Promise.all([
    db.prepare("SELECT * FROM pengaturan_akademik WHERE id = 'global'").first<any>(),
    db.prepare('SELECT id, nama_mapel FROM mata_pelajaran ORDER BY nama_mapel').all<any>(),
    db.prepare(`
      SELECT s.id, s.nisn, s.nama_lengkap, s.kelas_id,
        k.tingkat, k.kelompok, k.nomor_kelas,
        rn.nilai_smt1, rn.nilai_smt2, rn.nilai_smt3, rn.nilai_smt4, rn.nilai_smt5, rn.nilai_um
      FROM siswa s
      JOIN kelas k ON s.kelas_id = k.id
      LEFT JOIN rekap_nilai_akademik rn ON rn.siswa_id = s.id
      WHERE k.tingkat = 12 AND s.status = 'aktif'
      ORDER BY s.nama_lengkap
    `).all<any>()
  ])

  const parsedPengaturan = pengaturan ? {
    ...pengaturan,
    mapel_snbp: parseJsonCol(pengaturan.mapel_snbp, []),
    mapel_span: parseJsonCol(pengaturan.mapel_span, []),
    daftar_jurusan: parseJsonCol(pengaturan.daftar_jurusan, ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']),
  } : null

  const dataSiswa = (siswaResult.results || []).map((s: any) => ({
    ...s,
    kelas: { tingkat: s.tingkat, kelompok: s.kelompok, nomor_kelas: s.nomor_kelas },
    rekap_nilai_akademik: {
      nilai_smt1: parseJsonCol(s.nilai_smt1, null),
      nilai_smt2: parseJsonCol(s.nilai_smt2, null),
      nilai_smt3: parseJsonCol(s.nilai_smt3, null),
      nilai_smt4: parseJsonCol(s.nilai_smt4, null),
      nilai_smt5: parseJsonCol(s.nilai_smt5, null),
      nilai_um: parseJsonCol(s.nilai_um, null),
    }
  }))

  return (
    <div className="space-y-4 mt-2">
      <PengaturanPanel pengaturan={parsedPengaturan} mapelList={mapelResult.results || []} />
      <AnalitikClient dataSiswa={dataSiswa} pengaturan={parsedPengaturan} />
    </div>
  )
}

export default async function AnalitikPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Analitik Kelulusan & SNBP"
        description="Data nilai RDM. Kalkulasi otomatis kuota Eligible SNBP 40% & SPAN-PTKIN."
        icon={LineChart}
        iconColor="text-violet-500"
      />
      <Suspense fallback={<PageLoading text="Memuat data warehouse nilai..." />}>
        <AnalitikDataFetcher />
      </Suspense>
    </div>
  )
}
