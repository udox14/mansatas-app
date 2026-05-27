// Lokasi: app/dashboard/kelas/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB, parseJsonCol } from '@/utils/db'
import { redirect } from 'next/navigation'
import { checkFeatureAccess, getPrimaryRole } from '@/lib/features'
import { KelasClient } from './components/kelas-client'
import { Library } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Manajemen Kelas - MANSATAS App' }
export const dynamic = 'force-dynamic'

async function KelasDataFetcher({ userRole }: { userRole: string }) {
  const db = await getDB()
  const kandidatWaliRoles = ['guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_tahfidz', 'guru_ppl']

  const [kelasResult, guruResult, siswaResult, taAktif] = await Promise.all([
    db.prepare(`
      SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.kapasitas, k.wali_kelas_id, k.km_siswa_id, k.kbm_nonaktif_mulai,
        u.nama_lengkap as wali_kelas_nama,
        km.nama_lengkap as km_siswa_nama,
        COUNT(CASE WHEN s.status = 'aktif' THEN 1 END) as jumlah_siswa
      FROM kelas k
      LEFT JOIN "user" u ON k.wali_kelas_id = u.id
      LEFT JOIN siswa km ON k.km_siswa_id = km.id AND km.kelas_id = k.id AND km.status = 'aktif'
      LEFT JOIN siswa s ON s.kelas_id = k.id
      GROUP BY k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.kapasitas, k.wali_kelas_id, k.km_siswa_id, u.nama_lengkap, km.nama_lengkap
      ORDER BY k.tingkat ASC, CAST(k.nomor_kelas AS INTEGER) ASC, k.kelompok ASC
    `).all<any>(),
    db.prepare(`
      SELECT DISTINCT u.id, u.nama_lengkap
      FROM "user" u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.role IN (${kandidatWaliRoles.map(() => '?').join(', ')})
         OR ur.role IN (${kandidatWaliRoles.map(() => '?').join(', ')})
      ORDER BY u.nama_lengkap ASC
    `).bind(...kandidatWaliRoles, ...kandidatWaliRoles).all<any>(),
    db.prepare(`
      SELECT id, kelas_id, nama_lengkap
      FROM siswa
      WHERE status = 'aktif' AND kelas_id IS NOT NULL
      ORDER BY nama_lengkap ASC
    `).all<any>(),
    db.prepare(`SELECT daftar_jurusan FROM tahun_ajaran WHERE is_active = 1`).first<any>()
  ])

  const formattedData = (kelasResult.results || []).map((item: any) => ({
    id: item.id, tingkat: item.tingkat, nomor_kelas: item.nomor_kelas,
    kelompok: item.kelompok, kapasitas: item.kapasitas || 36,
    wali_kelas_id: item.wali_kelas_id || 'none',
    wali_kelas_nama: item.wali_kelas_nama || 'Belum Ditentukan',
    km_siswa_id: item.km_siswa_nama ? (item.km_siswa_id || 'none') : 'none',
    km_siswa_nama: item.km_siswa_nama || 'Belum Ditentukan',
    jumlah_siswa: item.jumlah_siswa || 0,
    kbm_nonaktif_mulai: item.kbm_nonaktif_mulai || null,
  }))

  const siswaByKelas = (siswaResult.results || []).reduce<Record<string, Array<{ id: string; nama_lengkap: string }>>>((acc, item: any) => {
    if (!acc[item.kelas_id]) acc[item.kelas_id] = []
    acc[item.kelas_id].push({ id: item.id, nama_lengkap: item.nama_lengkap })
    return acc
  }, {})

  const daftarJurusan = taAktif?.daftar_jurusan
    ? parseJsonCol<string[]>(taAktif.daftar_jurusan, []) || ['MIPA-F', 'MIPA-M', 'SOSHUM', 'KEAGAMAAN', 'UMUM']
    : ['MIPA-F', 'MIPA-M', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  return (
    <KelasClient
      initialData={formattedData}
      daftarGuru={guruResult.results || []}
      daftarSiswaByKelas={siswaByKelas}
      daftarJurusan={daftarJurusan}
      userRole={userRole}
    />
  )
}

export default async function KelasPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'kelas')
  if (!allowed) redirect('/dashboard')

  const userRole = await getPrimaryRole(db, user.id)

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader title="Manajemen Kelas" description="Kelola data kelas, kapasitas, dan penugasan Wali Kelas." />
      <Suspense fallback={<PageLoading text="Memuat data kelas..." />}>
        <KelasDataFetcher userRole={userRole} />
      </Suspense>
    </div>
  )
}
