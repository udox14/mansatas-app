// BUAT FILE BARU
// Lokasi: app/dashboard/kelas/page.tsx
import { createClient } from '@/utils/supabase/server'
import { KelasClient } from './components/kelas-client'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Manajemen Kelas - MANSATAS App' }

export default async function KelasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1. Ambil data Kelas + Relasi Wali Kelas + Jumlah Siswa (Count)
  const { data: kelasData, error } = await supabase
    .from('kelas')
    .select(`
      id, tingkat, nomor_kelas, kelompok, kapasitas,
      wali_kelas:profiles(nama_lengkap),
      siswa(count)
    `)
    .order('tingkat', { ascending: true })
    .order('kelompok', { ascending: true })
    .order('nomor_kelas', { ascending: true })

  if (error) {
    return <div className="p-4 bg-red-50 text-red-600 rounded-lg">Gagal memuat data: {error.message}</div>
  }

  // 2. Format Data secara strict agar TypeScript aman
  const formattedData = (kelasData || []).map((item: any) => {
    // Handling Supabase count array structure [{ count: X }]
    const jumlahSiswa = item.siswa && item.siswa.length > 0 ? item.siswa[0].count : 0
    
    return {
      id: item.id,
      tingkat: item.tingkat,
      nomor_kelas: item.nomor_kelas,
      kelompok: item.kelompok,
      kapasitas: item.kapasitas || 32,
      wali_kelas_nama: item.wali_kelas?.nama_lengkap || 'Belum Ditentukan',
      jumlah_siswa: jumlahSiswa
    }
  })

  // 3. Ambil daftar Guru untuk dropdown Wali Kelas
  const { data: guruData } = await supabase
    .from('profiles')
    .select('id, nama_lengkap')
    .in('role', ['guru', 'guru_bk'])
    .order('nama_lengkap', { ascending: true })

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Kelas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Kelola data kelas, kapasitas (Max 32), dan penugasan Wali Kelas.
        </p>
      </div>

      <KelasClient 
        initialData={formattedData} 
        daftarGuru={guruData || []} 
      />
    </div>
  )
}