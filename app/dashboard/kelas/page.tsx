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

type TahunAjaranOption = {
  id: string
  nama: string
  semester: number
  is_active: number
  daftar_jurusan?: string | null
}

async function KelasDataFetcher({ userRole, selectedTahunAjaranId }: { userRole: string; selectedTahunAjaranId?: string }) {
  const db = await getDB()
  const kandidatWaliRoles = ['guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'guru_tahfidz', 'guru_ppl']
  const tahunAjaranRows = (await db
    .prepare('SELECT id, nama, semester, is_active, daftar_jurusan FROM tahun_ajaran ORDER BY nama DESC, semester DESC')
    .all<TahunAjaranOption>()).results ?? []
  const activeTA = tahunAjaranRows.find(ta => ta.is_active === 1) ?? tahunAjaranRows[0]
  const selectedTA = tahunAjaranRows.find(ta => ta.id === selectedTahunAjaranId) ?? activeTA
  const isSelectedActive = !selectedTA || selectedTA.is_active === 1

  const kelasQuery = isSelectedActive
    ? `
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
    `
    : `
      SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.kapasitas, k.wali_kelas_id, k.km_siswa_id, k.kbm_nonaktif_mulai,
        u.nama_lengkap as wali_kelas_nama,
        km.nama_lengkap as km_siswa_nama,
        COUNT(rk.siswa_id) as jumlah_siswa
      FROM kelas k
      LEFT JOIN "user" u ON k.wali_kelas_id = u.id
      LEFT JOIN siswa km ON k.km_siswa_id = km.id
      LEFT JOIN riwayat_kelas rk ON rk.kelas_id = k.id AND rk.tahun_ajaran_id = ?
      GROUP BY k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.kapasitas, k.wali_kelas_id, k.km_siswa_id, u.nama_lengkap, km.nama_lengkap
      ORDER BY k.tingkat ASC, CAST(k.nomor_kelas AS INTEGER) ASC, k.kelompok ASC
    `

  const siswaQuery = isSelectedActive
    ? `
      SELECT id, kelas_id, nama_lengkap
      FROM siswa
      WHERE status = 'aktif' AND kelas_id IS NOT NULL
      ORDER BY nama_lengkap ASC
    `
    : `
      SELECT s.id, rk.kelas_id, s.nama_lengkap
      FROM riwayat_kelas rk
      JOIN siswa s ON s.id = rk.siswa_id
      WHERE rk.tahun_ajaran_id = ?
      ORDER BY s.nama_lengkap ASC
    `

  const [kelasResult, guruResult, siswaResult] = await Promise.all([
    isSelectedActive
      ? db.prepare(kelasQuery).all<any>()
      : db.prepare(kelasQuery).bind(selectedTA?.id).all<any>(),
    db.prepare(`
      SELECT DISTINCT u.id, u.nama_lengkap
      FROM "user" u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.role IN (${kandidatWaliRoles.map(() => '?').join(', ')})
         OR ur.role IN (${kandidatWaliRoles.map(() => '?').join(', ')})
      ORDER BY u.nama_lengkap ASC
    `).bind(...kandidatWaliRoles, ...kandidatWaliRoles).all<any>(),
    isSelectedActive
      ? db.prepare(siswaQuery).all<any>()
      : db.prepare(siswaQuery).bind(selectedTA?.id).all<any>(),
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

  const daftarJurusan = selectedTA?.daftar_jurusan
    ? parseJsonCol<string[]>(selectedTA.daftar_jurusan, []) || ['MIPA-F', 'MIPA-M', 'SOSHUM', 'KEAGAMAAN', 'UMUM']
    : ['MIPA-F', 'MIPA-M', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  return (
    <KelasClient
      initialData={formattedData}
      daftarGuru={guruResult.results || []}
      daftarSiswaByKelas={siswaByKelas}
      daftarJurusan={daftarJurusan}
      userRole={userRole}
      tahunAjaranOptions={tahunAjaranRows.map(ta => ({
        id: ta.id,
        label: `${ta.nama} SMT ${ta.semester}${ta.is_active === 1 ? ' - aktif' : ''}`,
        is_active: ta.is_active === 1,
      }))}
      selectedTahunAjaranId={selectedTA?.id}
      selectedTahunAjaranLabel={selectedTA ? `${selectedTA.nama} SMT ${selectedTA.semester}` : undefined}
      isHistoricalView={!isSelectedActive}
    />
  )
}

export default async function KelasPage({
  searchParams,
}: {
  searchParams: Promise<{ ta?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'kelas')
  if (!allowed) redirect('/dashboard')

  const userRole = await getPrimaryRole(db, user.id)
  const sp = await searchParams

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader title="Manajemen Kelas" description="Kelola data kelas, kapasitas, dan penugasan Wali Kelas." />
      <Suspense fallback={<PageLoading text="Memuat data kelas..." />}>
        <KelasDataFetcher userRole={userRole} selectedTahunAjaranId={sp.ta} />
      </Suspense>
    </div>
  )
}
