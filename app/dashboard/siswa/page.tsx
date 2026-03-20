// Lokasi: app/dashboard/siswa/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { SiswaClient } from './components/siswa-client'
import { Users, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Data Siswa - MANSATAS App' }

// Kolom minimal yang dibutuhkan untuk tabel list — tidak SELECT *
const SISWA_LIST_COLS = `s.id, s.nisn, s.nama_lengkap, s.jenis_kelamin, s.status, s.foto_url, s.tempat_tinggal, s.kelas_id,
  k.id as k_id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id`

async function SiswaDataFetcher({ userId, userRole }: { userId: string; userRole: string }) {
  const db = await getDB()
  const isAdmin = ['super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(userRole)

  let siswaResults: any[] = []
  let kelasIds: Set<string> = new Set()

  if (!isAdmin) {
    // Guru: ambil kelas yang diajar + wali kelas dalam 1 query
    const kelasRes = await db
      .prepare(
        `SELECT DISTINCT k.id FROM kelas k
         LEFT JOIN penugasan_mengajar pm ON pm.kelas_id = k.id AND pm.guru_id = ?
         WHERE pm.guru_id = ? OR k.wali_kelas_id = ?`
      )
      .bind(userId, userId, userId)
      .all<{ id: string }>()

    kelasIds = new Set((kelasRes.results ?? []).map((r) => r.id))

    if (kelasIds.size === 0) {
      // Guru tidak punya kelas — tampil kosong, jangan query siswa
      const kelasResult = await db
        .prepare('SELECT id, tingkat, nomor_kelas, kelompok, wali_kelas_id FROM kelas ORDER BY tingkat, kelompok, nomor_kelas')
        .all<any>()
      return (
        <SiswaClient
          initialData={[]}
          kelasList={kelasResult.results ?? []}
          currentUser={{ id: userId, role: userRole }}
        />
      )
    }

    const placeholders = Array.from(kelasIds).map(() => '?').join(',')
    const res = await db
      .prepare(
        `SELECT ${SISWA_LIST_COLS}
         FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id
         WHERE s.kelas_id IN (${placeholders})
         ORDER BY s.nama_lengkap ASC`
      )
      .bind(...Array.from(kelasIds))
      .all<any>()
    siswaResults = res.results ?? []
  } else {
    // Admin: ambil semua siswa — kolom minimal saja
    const res = await db
      .prepare(
        `SELECT ${SISWA_LIST_COLS}
         FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id
         ORDER BY s.nama_lengkap ASC`
      )
      .all<any>()
    siswaResults = res.results ?? []
  }

  // Ambil daftar kelas untuk dropdown (ringan, pakai cache)
  const kelasResult = await db
    .prepare('SELECT id, tingkat, nomor_kelas, kelompok, wali_kelas_id FROM kelas ORDER BY tingkat, kelompok, nomor_kelas')
    .all<any>()

  const formattedSiswa = siswaResults.map((s: any) => ({
    id: s.id,
    nisn: s.nisn,
    nama_lengkap: s.nama_lengkap,
    jenis_kelamin: s.jenis_kelamin,
    status: s.status,
    foto_url: s.foto_url,
    tempat_tinggal: s.tempat_tinggal,
    kelas_id: s.kelas_id,
    kelas: s.k_id
      ? { id: s.k_id, tingkat: s.tingkat, nomor_kelas: s.nomor_kelas, kelompok: s.kelompok, wali_kelas_id: s.wali_kelas_id }
      : null,
  }))

  const allKelas = kelasResult.results ?? []
  const dropdownKelas = isAdmin ? allKelas : allKelas.filter((k: any) => kelasIds.has(k.id))
  const sortedKelas = [...dropdownKelas].sort((a: any, b: any) =>
    `${a.tingkat} ${a.kelompok} ${a.nomor_kelas}`.localeCompare(
      `${b.tingkat} ${b.kelompok} ${b.nomor_kelas}`,
      undefined,
      { numeric: true, sensitivity: 'base' }
    )
  )

  return (
    <SiswaClient
      initialData={formattedSiswa}
      kelasList={sortedKelas}
      currentUser={{ id: userId, role: userRole }}
    />
  )
}

export default async function SiswaPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const role = (user as any).role ?? 'guru'
  const isAdmin = ['super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(role)

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Data Siswa"
        description={
          isAdmin
            ? 'Kelola data profil dan status siswa secara massal.'
            : 'Daftar siswa di kelas yang Anda ajar.'
        }
        icon={Users}
        iconColor="text-blue-500"
      />
      <Suspense
        fallback={
          <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-12 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
            <div className="bg-blue-50 p-4 rounded-full mb-4 shadow-inner">
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Menyiapkan Database Siswa...</h3>
          </div>
        }
      >
        <SiswaDataFetcher userId={user.id} userRole={role} />
      </Suspense>
    </div>
  )
}
