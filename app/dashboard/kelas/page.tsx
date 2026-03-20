// Lokasi: app/dashboard/kelas/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB, parseJsonCol } from '@/utils/db'
import { redirect } from 'next/navigation'
import { KelasClient } from './components/kelas-client'
import { Library } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Manajemen Kelas - MANSATAS App' }
export const dynamic = 'force-dynamic'

async function KelasDataFetcher() {
  const db = await getDB()

  const [kelasResult, guruResult, taAktif] = await Promise.all([
    // FIX: Ganti correlated subquery (N+1) → LEFT JOIN + GROUP BY (1 query flat)
    // Sebelumnya: (SELECT COUNT(*) FROM siswa WHERE kelas_id = k.id) per baris = ~80k rows
    // Sekarang: 1 pass GROUP BY = jauh lebih efisien
    db.prepare(`
      SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.kapasitas, k.wali_kelas_id,
        u.nama_lengkap as wali_kelas_nama,
        COUNT(CASE WHEN s.status = 'aktif' THEN 1 END) as jumlah_siswa
      FROM kelas k
      LEFT JOIN "user" u ON k.wali_kelas_id = u.id
      LEFT JOIN siswa s ON s.kelas_id = k.id
      GROUP BY k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.kapasitas, k.wali_kelas_id, u.nama_lengkap
      ORDER BY k.tingkat ASC, k.kelompok ASC, k.nomor_kelas ASC
    `).all<any>(),
    db.prepare(`SELECT id, nama_lengkap FROM "user" WHERE role IN ('guru','guru_bk','wakamad','kepsek') ORDER BY nama_lengkap ASC`).all<any>(),
    db.prepare(`SELECT daftar_jurusan FROM tahun_ajaran WHERE is_active = 1`).first<any>()
  ])

  const formattedData = (kelasResult.results || []).map((item: any) => ({
    id: item.id, tingkat: item.tingkat, nomor_kelas: item.nomor_kelas,
    kelompok: item.kelompok, kapasitas: item.kapasitas || 36,
    wali_kelas_id: item.wali_kelas_id || 'none',
    wali_kelas_nama: item.wali_kelas_nama || 'Belum Ditentukan',
    jumlah_siswa: item.jumlah_siswa || 0
  }))

  const daftarJurusan = taAktif?.daftar_jurusan
    ? parseJsonCol<string[]>(taAktif.daftar_jurusan, []) || ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']
    : ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  return <KelasClient initialData={formattedData} daftarGuru={guruResult.results || []} daftarJurusan={daftarJurusan} />
}

export default async function KelasPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader title="Manajemen Kelas" description="Kelola data kelas, kapasitas, dan penugasan Wali Kelas." icon={Library} iconColor="text-blue-500" />
      <Suspense fallback={<PageLoading text="Memuat data kelas..." />}>
        <KelasDataFetcher />
      </Suspense>
    </div>
  )
}