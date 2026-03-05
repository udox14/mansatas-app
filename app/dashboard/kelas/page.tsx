// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kelas/page.tsx
import { createClient } from '@/utils/supabase/server'
import { KelasClient } from './components/kelas-client'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Manajemen Kelas - MANSATAS App' }

export default async function KelasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: kelasData, error } = await supabase
    .from('kelas')
    .select(`
      id, tingkat, nomor_kelas, kelompok, kapasitas, wali_kelas_id,
      wali_kelas:profiles!wali_kelas_id(nama_lengkap),
      siswa(count)
    `)
    .order('tingkat', { ascending: true })
    .order('kelompok', { ascending: true })
    .order('nomor_kelas', { ascending: true })

  if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-lg">Gagal memuat data: {error.message}</div>

  const formattedData = (kelasData || []).map((item: any) => {
    const jumlahSiswa = item.siswa && item.siswa.length > 0 ? item.siswa[0].count : 0
    const waliObj = Array.isArray(item.wali_kelas) ? item.wali_kelas[0] : item.wali_kelas
    return {
      id: item.id, tingkat: item.tingkat, nomor_kelas: item.nomor_kelas, kelompok: item.kelompok,
      kapasitas: item.kapasitas || 36, wali_kelas_id: item.wali_kelas_id || 'none',
      wali_kelas_nama: waliObj?.nama_lengkap || 'Belum Ditentukan', jumlah_siswa: jumlahSiswa
    }
  })

  const { data: guruData } = await supabase
    .from('profiles')
    .select('id, nama_lengkap')
    .in('role', ['guru', 'guru_bk'])
    .order('nama_lengkap', { ascending: true })

  // PERBAIKAN: Ambil daftar jurusan dari Tahun Ajaran yang AKTIF
  const { data: taAktif } = await supabase.from('tahun_ajaran').select('daftar_jurusan').eq('is_active', true).single()
  const daftarJurusan = taAktif?.daftar_jurusan || ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Kelas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Kelola data kelas, kapasitas, dan penugasan Wali Kelas langsung dari tabel.
        </p>
      </div>

      <KelasClient 
        initialData={formattedData} 
        daftarGuru={guruData || []} 
        daftarJurusan={daftarJurusan}
      />
    </div>
  )
}