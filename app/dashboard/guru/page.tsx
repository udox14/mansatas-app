// Lokasi: app/dashboard/guru/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { GuruClient } from './components/guru-client'
import { GraduationCap } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Data Guru & Pegawai - MANSATAS App' }

async function GuruDataFetcher() {
  const db = await getDB()

  const result = await db.prepare(`
    SELECT id, email, name, role, nama_lengkap
    FROM "user"
    WHERE role != 'wali_murid'
    ORDER BY nama_lengkap ASC
  `).all<any>()

  const mergedData = (result.results || []).map((u: any) => ({
    id: u.id,
    nama_lengkap: u.nama_lengkap || u.name || '',
    role: u.role || '',
    email: u.email || 'Email tidak ditemukan'
  }))

  return <GuruClient initialData={mergedData} />
}

export default async function GuruPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader title="Guru & Pegawai" description="Kelola data pendidik, hak akses, dan reset password." icon={GraduationCap} iconColor="text-indigo-500" />
      <Suspense fallback={
<PageLoading text="Memuat data kepegawaian..." />
      }>
        <GuruDataFetcher />
      </Suspense>
    </div>
  )
}