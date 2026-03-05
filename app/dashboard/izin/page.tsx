// BUAT FILE BARU
// Lokasi: app/dashboard/izin/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { IzinClient } from './components/izin-client'
import { DoorOpen } from 'lucide-react'

export const metadata = { title: 'Perizinan Siswa - MANSATAS App' }

export default async function IzinPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  
  // Tanggal Hari Ini untuk Filter Data
  const today = new Date().toISOString().split('T')[0]

  // Fetch Paralel (Siswa Aktif, Izin Keluar, Izin Kelas)
  const [resSiswa, resKeluar, resKelas] = await Promise.all([
    supabase.from('siswa')
      .select('id, nama_lengkap, nisn, kelas!inner(tingkat, nomor_kelas)')
      .eq('status', 'aktif')
      .order('nama_lengkap'),
      
    // Ambil izin keluar: Yang belum kembali (kapanpun), ATAU yang keluar hari ini (limit 300 data terakhir)
    supabase.from('izin_keluar_komplek')
      .select('id, waktu_keluar, waktu_kembali, status, keterangan, siswa(nama_lengkap, kelas(tingkat, nomor_kelas)), pelapor:profiles!diinput_oleh(nama_lengkap)')
      .order('waktu_keluar', { ascending: false })
      .limit(300),

    // Ambil izin kelas khusus hari ini saja
    supabase.from('izin_tidak_masuk_kelas')
      .select('id, tanggal, jam_pelajaran, alasan, keterangan, siswa(nama_lengkap, kelas(tingkat, nomor_kelas)), pelapor:profiles!diinput_oleh(nama_lengkap)')
      .eq('tanggal', today)
      .order('created_at', { ascending: false })
  ])

  // Filter izin keluar di server: hanya tampilkan yang hari ini atau yang masih 'BELUM KEMBALI'
  const filteredKeluar = (resKeluar.data || []).filter(k => {
    const isToday = k.waktu_keluar.startsWith(today)
    const isNotReturned = k.status === 'BELUM KEMBALI'
    return isToday || isNotReturned
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center gap-3">
        <div className="bg-blue-100 p-3 rounded-2xl text-blue-700 shadow-sm border border-blue-200/50">
          <DoorOpen className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Perizinan Siswa Harian</h1>
          <p className="text-sm text-slate-500 mt-1">
            Posko pencatatan siswa keluar komplek dan izin meninggalkan jam pelajaran hari ini.
          </p>
        </div>
      </div>

      <IzinClient 
        siswaList={resSiswa.data || []}
        izinKeluarList={filteredKeluar}
        izinKelasList={resKelas.data || []}
        currentUserRole={profile?.role || ''}
      />
    </div>
  )
}