// Lokasi: app/dashboard/siswa/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { SiswaClient } from './components/siswa-client'
import { Users } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Data Siswa - MANSATAS App' }
export const dynamic = 'force-dynamic'

async function SiswaDataFetcher({ userId, isAdmin, allowedKelasIds }: {
  userId: string, isAdmin: boolean, allowedKelasIds: Set<string>
}) {
  const db = await getDB()

  // Ambil kelas — kolom minimal saja
  const kelasResult = await db.prepare(
    'SELECT id, tingkat, nomor_kelas, kelompok, wali_kelas_id FROM kelas ORDER BY tingkat ASC, kelompok ASC, nomor_kelas ASC'
  ).all<any>()
  const kelasData = kelasResult.results || []

  let siswaQuery: string
  let siswaParams: any[] = []

  if (isAdmin) {
    // FIX: Tidak filter status di sini — filter dilakukan di client
    // Tapi batasi kolom yang diambil (tidak perlu semua field biodata)
    siswaQuery = `
      SELECT s.id, s.nisn, s.nama_lengkap, s.jenis_kelamin, s.status, s.foto_url,
        s.tempat_tinggal, s.kelas_id,
        k.id as k_id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id
      FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id
      ORDER BY s.nama_lengkap ASC
    `
  } else if (allowedKelasIds.size > 0) {
    const placeholders = Array.from(allowedKelasIds).map(() => '?').join(',')
    siswaQuery = `
      SELECT s.id, s.nisn, s.nama_lengkap, s.jenis_kelamin, s.status, s.foto_url,
        s.tempat_tinggal, s.kelas_id,
        k.id as k_id, k.tingkat, k.nomor_kelas, k.kelompok, k.wali_kelas_id
      FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id
      WHERE s.kelas_id IN (${placeholders})
      ORDER BY s.nama_lengkap ASC
    `
    siswaParams = Array.from(allowedKelasIds)
  } else {
    return <SiswaClient initialData={[]} kelasList={[]} currentUser={{ id: userId, role: 'guru' }} />
  }

  const siswaResult = await db.prepare(siswaQuery).bind(...siswaParams).all<any>()

  const formattedSiswaData = (siswaResult.results || []).map((s: any) => ({
    id: s.id, nisn: s.nisn, nama_lengkap: s.nama_lengkap,
    jenis_kelamin: s.jenis_kelamin, status: s.status, foto_url: s.foto_url,
    tempat_tinggal: s.tempat_tinggal, kelas_id: s.kelas_id,
    kelas: s.k_id ? {
      id: s.k_id, tingkat: s.tingkat, nomor_kelas: s.nomor_kelas,
      kelompok: s.kelompok, wali_kelas_id: s.wali_kelas_id
    } : null
  }))

  const dropdownKelasData = isAdmin ? kelasData : kelasData.filter((k: any) => allowedKelasIds.has(k.id))

  return (
    <SiswaClient
      initialData={formattedSiswaData}
      kelasList={dropdownKelasData}
      currentUser={{ id: userId, role: isAdmin ? 'admin_tu' : 'guru' }}
    />
  )
}

export default async function SiswaPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const role = (user as any).role ?? 'guru'
  const isAdmin = ['super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(role)
  let allowedKelasIds = new Set<string>()

  if (!isAdmin) {
    const db = await getDB()
    const [penugasan, wali] = await Promise.all([
      db.prepare('SELECT DISTINCT kelas_id FROM penugasan_mengajar WHERE guru_id = ?').bind(user.id).all<{ kelas_id: string }>(),
      db.prepare('SELECT id FROM kelas WHERE wali_kelas_id = ?').bind(user.id).all<{ id: string }>()
    ])
    penugasan.results?.forEach((p) => allowedKelasIds.add(p.kelas_id))
    wali.results?.forEach((w) => allowedKelasIds.add(w.id))
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Data Siswa"
        description={isAdmin ? 'Kelola data profil dan status siswa secara massal.' : 'Daftar siswa di kelas yang Anda ajar.'}
        icon={Users}
        iconColor="text-blue-500"
      />
      <Suspense fallback={<PageLoading text="Menyiapkan data siswa..." />}>
        <SiswaDataFetcher userId={user.id} isAdmin={isAdmin} allowedKelasIds={allowedKelasIds} />
      </Suspense>
    </div>
  )
}