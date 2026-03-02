import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { SiswaClient } from './components/siswa-client'
import { Users } from 'lucide-react'

export const metadata = { title: 'Manajemen Siswa - MANSATAS App' }

export default async function SiswaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Ambil data siswa beserta relasi kelasnya
  const { data: siswaData, error } = await supabase
    .from('siswa')
    .select(`
      id, nisn, nis_lokal, nama_lengkap, jenis_kelamin, tempat_tinggal, status,
      kelas:kelas_id (id, tingkat, nomor_kelas, kelompok)
    `)
    .order('nama_lengkap', { ascending: true })

  // Ambil master kelas untuk filter dropdown
  const { data: kelasData } = await supabase
    .from('kelas')
    .select('id, tingkat, nomor_kelas, kelompok')

  if (error) {
    return <div className="p-4 bg-rose-50 text-rose-600 rounded-xl">Gagal memuat data: {error.message}</div>
  }

  // 1. FIX ERROR TYPESCRIPT: 
  // Format data siswa karena tipe relasi Supabase sering terbaca sebagai Array [{...}]
  const formattedSiswaData = (siswaData || []).map((s: any) => ({
    ...s,
    // Ekstrak object kelas dari array jika diperlukan
    kelas: Array.isArray(s.kelas) ? s.kelas[0] : s.kelas
  }))

  // 2. NATURAL SORT KELAS:
  // Mengurutkan kelas agar 10-1, 10-2, ..., 10-10 berurutan secara logis di Dropdown Filter
  const sortedKelasData = (kelasData || []).sort((a, b) => {
    const namaA = `${a.tingkat} ${a.kelompok} ${a.nomor_kelas}`
    const namaB = `${b.tingkat} ${b.kelompok} ${b.nomor_kelas}`
    return namaA.localeCompare(namaB, undefined, { numeric: true, sensitivity: 'base' })
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-700 shadow-sm border border-emerald-200/50">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Data Siswa</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola profil, status akademik, dan import data siswa secara massal.
          </p>
        </div>
      </div>

      <SiswaClient 
        initialData={formattedSiswaData} 
        kelasList={sortedKelasData} 
      />
    </div>
  )
}