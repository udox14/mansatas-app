import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { PengaturanPanel } from './components/pengaturan-panel'
import { AnalitikClient } from './components/analitik-client'
import { LineChart } from 'lucide-react'

export const metadata = { title: 'Analitik Kelulusan - MANSATAS App' }

export default async function AnalitikPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1. Ambil Pengaturan Rumus
  const { data: pengaturan } = await supabase.from('pengaturan_akademik').select('*').eq('id', 'global').single()

  // 2. Ambil Master Mapel (Untuk List Checkbox di Pengaturan)
  const { data: mapelList } = await supabase.from('mata_pelajaran').select('id, nama_mapel').order('nama_mapel')

  // 3. Ambil Seluruh Data Siswa Kelas 12 beserta Nilainya
  // Menggunakan inner join dengan kelas agar hanya ambil anak kelas 12
  const { data: dataSiswa } = await supabase
    .from('siswa')
    .select(`
      id, nisn, nama_lengkap, kelas_id,
      kelas!inner (tingkat, kelompok, nomor_kelas),
      rekap_nilai_akademik (nilai_smt1, nilai_smt2, nilai_smt3, nilai_smt4, nilai_smt5, nilai_um)
    `)
    .eq('kelas.tingkat', 12)
    .eq('status', 'aktif')
    .order('nama_lengkap')

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-700 shadow-sm border border-emerald-200/50">
          <LineChart className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analitik Kelulusan & SNBP</h1>
          <p className="text-sm text-slate-500 mt-1">
            Data Warehouse nilai dari RDM. Penghitungan otomatis kuota Eligible SNBP 40% & SPAN-PTKIN.
          </p>
        </div>
      </div>

      {/* Bagian Atas: Panel Pengaturan Rumus */}
      <PengaturanPanel 
        pengaturan={pengaturan} 
        mapelList={mapelList || []} 
      />

      {/* Bagian Bawah: Dashboard Tabel Super Canggih */}
      <AnalitikClient 
        dataSiswa={(dataSiswa as any) || []} 
        pengaturan={pengaturan} 
      />
    </div>
  )
}