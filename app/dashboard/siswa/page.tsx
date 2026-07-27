// Lokasi: app/dashboard/siswa/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { getUserRoles, checkFeatureAccess } from '@/lib/features'
import { SiswaClient } from './components/siswa-client'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Data Siswa - MANSATAS App' }
export const dynamic = 'force-dynamic'

async function SiswaDataFetcher({ userId, userRoles }: {
  userId: string
  userRoles: string[]
}) {
  const db = await getDB()

  const [kelasResult, siswaResult] = await Promise.all([
    db.prepare(
      'SELECT id, tingkat, nomor_kelas, kelompok, wali_kelas_id FROM kelas ORDER BY tingkat ASC, CAST(nomor_kelas AS INTEGER) ASC, kelompok ASC'
    ).all<any>(),
    // Direktori siswa dapat dibaca oleh setiap pengguna yang memiliki akses modul.
    // Halaman detail tetap memeriksa kewenangan role secara terpisah.
    db.prepare(`
      SELECT s.id, s.nisn, s.nama_lengkap, s.jenis_kelamin, s.status, s.foto_url,
        s.tempat_tinggal, s.kelas_id, s.tahun_masuk,
        k.id AS k_id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id
      FROM siswa s
      LEFT JOIN kelas k ON s.kelas_id = k.id
      WHERE s.status != 'dihapus'
      ORDER BY s.nama_lengkap ASC
    `).all<any>(),
  ])

  const formattedSiswaData = (siswaResult.results || []).map((s: any) => ({
    id: s.id,
    nisn: s.nisn,
    nama_lengkap: s.nama_lengkap,
    jenis_kelamin: s.jenis_kelamin,
    status: s.status,
    foto_url: s.foto_url,
    tempat_tinggal: s.tempat_tinggal,
    kelas_id: s.kelas_id,
    tahun_masuk: s.tahun_masuk,
    kelas: s.k_id ? {
      id: s.k_id,
      tingkat: s.tingkat,
      nomor_kelas: s.nomor_kelas,
      kelompok: s.kelompok,
      wali_kelas_id: s.wali_kelas_id,
    } : null,
  }))

  return (
    <SiswaClient
      initialData={formattedSiswaData}
      kelasList={kelasResult.results || []}
      currentUser={{ id: userId, roles: userRoles }}
    />
  )
}

export default async function SiswaPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'siswa')
  if (!allowed) redirect('/dashboard')

  const userRoles = await getUserRoles(db, user.id)

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Data Siswa"
        description="Direktori seluruh siswa. Akses buku induk mengikuti kewenangan masing-masing role."
      />
      <Suspense fallback={<PageLoading text="Menyiapkan data siswa..." />}>
        <SiswaDataFetcher userId={user.id} userRoles={userRoles} />
      </Suspense>
    </div>
  )
}
