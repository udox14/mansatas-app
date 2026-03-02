// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kelas/[id]/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Users, UserCircle } from 'lucide-react'
import { DetailKelasClient } from './components/detail-client'

export const metadata = { title: 'Detail Kelas - MANSATAS App' }

export default async function DetailKelasPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: kelasData, error: kelasError } = await supabase
    .from('kelas')
    .select(`id, tingkat, kelompok, nomor_kelas, kapasitas, wali_kelas:profiles(nama_lengkap)`)
    .eq('id', params.id)
    .single()

  if (kelasError || !kelasData) return <div className="p-8 text-center text-red-500">Data kelas tidak ditemukan.</div>

  const { data: siswaData, error: siswaError } = await supabase
    .from('siswa')
    .select('id, nisn, nama_lengkap, jenis_kelamin, status')
    .eq('kelas_id', params.id)
    .eq('status', 'aktif')
    .order('nama_lengkap', { ascending: true })

  const siswaList = siswaData || []
  const isFull = siswaList.length >= kelasData.kapasitas
  const namaKelasSingkat = `${kelasData.tingkat}-${kelasData.nomor_kelas}`

  const waliKelasRaw = kelasData.wali_kelas as any
  const waliKelasObj = Array.isArray(waliKelasRaw) ? waliKelasRaw[0] : waliKelasRaw
  const namaWaliKelas = waliKelasObj?.nama_lengkap || 'Belum Ditentukan'

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/dashboard/kelas" className="hover:text-blue-600 flex items-center gap-1 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Kembali ke Manajemen Kelas
        </Link>
      </div>

      <div className="bg-white rounded-2xl p-6 border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-0 opacity-50"></div>
        
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{namaKelasSingkat}</h1>
            {kelasData.kelompok !== 'UMUM' && (
              <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 border border-indigo-200 rounded-full">
                {kelasData.kelompok}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <UserCircle className="h-4 w-4" />
            <span>Wali Kelas: <strong className="text-slate-800">{namaWaliKelas}</strong></span>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 bg-slate-50 p-4 rounded-xl border">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${isFull ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kapasitas</p>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${isFull ? 'text-red-600' : 'text-slate-900'}`}>{siswaList.length}</span>
                <span className="text-slate-500 font-medium">/ {kelasData.kapasitas}</span>
              </div>
            </div>
          </div>
          {isFull && <div className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full animate-pulse">KELAS PENUH</div>}
        </div>
      </div>

      <div className="pt-2">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Daftar Siswa Kelas Ini</h2>
        {/* FIX: Props disesuaikan penuh dengan detail-client.tsx yang baru */}
        <DetailKelasClient 
          siswaData={siswaList} 
          kelasId={kelasData.id} 
          tingkatKelas={kelasData.tingkat} 
        />
      </div>
    </div>
  )
}