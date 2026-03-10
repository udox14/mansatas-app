// Lokasi: app/dashboard/guru/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { GuruClient } from './components/guru-client'
import { GraduationCap } from 'lucide-react'

export const metadata = { title: 'Data Guru & Pegawai - MANSATAS App' }

async function GuruDataFetcher() {
  const db = await getDB()

  const result = await db.prepare(`
    SELECT id, email, name, role, nama_lengkap
    FROM user
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
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-700 shadow-sm border border-indigo-200/50">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Guru & Pegawai</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola data pendidik, hak akses sistem, import massal, dan reset password.</p>
        </div>
      </div>
      <Suspense fallback={
        <div className="bg-white/50 rounded-3xl p-12 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
           <div className="bg-indigo-50 p-5 rounded-full mb-5 border border-indigo-100 relative">
             <div className="absolute inset-0 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin"></div>
             <GraduationCap className="h-8 w-8 text-indigo-600 animate-pulse" />
           </div>
           <h3 className="text-xl font-bold text-slate-800">Memuat Data Kepegawaian...</h3>
        </div>
      }>
        <GuruDataFetcher />
      </Suspense>
    </div>
  )
}