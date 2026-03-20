// Lokasi: app/dashboard/akademik/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB, parseJsonCol } from '@/utils/db'
import { redirect } from 'next/navigation'
import { AkademikClient } from './akademik-client'
import { BookOpen } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Pusat Akademik - MANSATAS App' }

async function AkademikDataFetcher() {
  const db = await getDB()

  const [taAktif, mapelResult] = await Promise.all([
    db.prepare('SELECT id, nama, semester, daftar_jurusan FROM tahun_ajaran WHERE is_active = 1').first<any>(),
    db.prepare('SELECT * FROM mata_pelajaran ORDER BY nama_mapel ASC').all<any>()
  ])

  let penugasanData: any[] = []
  if (taAktif) {
    const res = await db.prepare(`
      SELECT pm.id, u.nama_lengkap as guru_nama, mp.nama_mapel, mp.kelompok as mapel_kelompok,
        k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok
      FROM penugasan_mengajar pm
      JOIN "user" u ON pm.guru_id = u.id
      JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
      JOIN kelas k ON pm.kelas_id = k.id
      WHERE pm.tahun_ajaran_id = ?
      ORDER BY pm.created_at DESC
    `).bind(taAktif.id).all<any>()

    penugasanData = (res.results || []).map((p: any) => ({
      id: p.id,
      guru: { nama_lengkap: p.guru_nama },
      mapel: { nama_mapel: p.nama_mapel, kelompok: p.mapel_kelompok },
      kelas: { tingkat: p.tingkat, nomor_kelas: p.nomor_kelas, kelompok: p.kelas_kelompok }
    }))
  }

  const daftarJurusan = taAktif?.daftar_jurusan
    ? parseJsonCol<string[]>(taAktif.daftar_jurusan, []) || ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']
    : ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  return <AkademikClient mapelData={mapelResult.results || []} penugasanData={penugasanData} taAktif={taAktif} daftarJurusan={daftarJurusan} />
}

export default async function AkademikPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader title="Pusat Akademik" description="Kelola master mata pelajaran dan jadwal mengajar." icon={BookOpen} iconColor="text-emerald-500" />
      <Suspense fallback={
<PageLoading text="Memuat pusat akademik..." />
      }>
        <AkademikDataFetcher />
      </Suspense>
    </div>
  )
}