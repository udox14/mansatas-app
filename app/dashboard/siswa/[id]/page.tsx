// BUAT FILE BARU
// Lokasi: app/dashboard/siswa/[id]/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { DetailSiswaClient } from './components/detail-client'

export const metadata = { title: 'Buku Induk Siswa - MANSATAS' }

export default async function DetailSiswaPage({ params }: { params: Promise<{ id: string }> }) {
  // NEXT.JS 16: params wajib di-await
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1. Fetch Biodata Utama & Relasi Terdekat
  const { data: siswa } = await supabase
    .from('siswa')
    .select(`
      *,
      kelas(tingkat, kelompok, nomor_kelas),
      rekap_nilai_akademik(*)
    `)
    .eq('id', id)
    .single()

  if (!siswa) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
        <h1 className="text-2xl font-bold mb-2">Siswa Tidak Ditemukan</h1>
        <Link href="/dashboard/siswa" className="text-blue-600 hover:underline">Kembali ke Daftar Siswa</Link>
      </div>
    )
  }

  // 2. Fetch Riwayat Kelas (Histori Kenaikan)
  const { data: riwayatKelas } = await supabase
    .from('riwayat_kelas')
    .select('id, kelas(tingkat, kelompok, nomor_kelas), tahun_ajaran(nama, semester), created_at')
    .eq('siswa_id', id)
    .order('created_at', { ascending: false })

  // 3. Fetch Riwayat Kedisiplinan
  const { data: pelanggaran } = await supabase
    .from('siswa_pelanggaran')
    .select('id, tanggal, keterangan, foto_url, master_pelanggaran(nama_pelanggaran, poin, kategori), pelapor:profiles!siswa_pelanggaran_diinput_oleh_fkey(nama_lengkap)')
    .eq('siswa_id', id)
    .order('tanggal', { ascending: false })

  // 4. Fetch Riwayat Izin Keluar Komplek
  const { data: izinKeluar } = await supabase
    .from('izin_keluar_komplek')
    .select('id, waktu_keluar, waktu_kembali, status, keterangan, pelapor:profiles!diinput_oleh(nama_lengkap)')
    .eq('siswa_id', id)
    .order('waktu_keluar', { ascending: false })

  // 5. Fetch Riwayat Izin Tidak Masuk Kelas
  const { data: izinKelas } = await supabase
    .from('izin_tidak_masuk_kelas')
    .select('id, tanggal, jam_pelajaran, alasan, keterangan, pelapor:profiles!diinput_oleh(nama_lengkap)')
    .eq('siswa_id', id)
    .order('tanggal', { ascending: false })

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <Link href="/dashboard/siswa" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200/60 w-fit">
        <ChevronLeft className="h-4 w-4" /> Kembali ke Data Siswa
      </Link>

      <DetailSiswaClient 
        siswa={siswa}
        riwayatKelas={riwayatKelas || []}
        pelanggaran={pelanggaran || []}
        izinKeluar={izinKeluar || []}
        izinKelas={izinKelas || []}
      />
    </div>
  )
}