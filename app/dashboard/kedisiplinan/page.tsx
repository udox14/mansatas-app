// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kedisiplinan/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ShieldAlert, CalendarDays } from 'lucide-react'
import { KedisiplinanClient } from './components/kedisiplinan-client'

export const metadata = { title: 'Kedisiplinan & Tata Tertib - MANSATAS App' }

export default async function KedisiplinanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('id, role, nama_lengkap').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const currentUser = { id: profile.id, role: profile.role, nama: profile.nama_lengkap }

  // 1. Ambil Tahun Ajaran Aktif
  const { data: taAktif } = await supabase.from('tahun_ajaran').select('id, nama').eq('is_active', true).single()
  if (!taAktif) return <div className="p-8 text-center text-rose-500 font-bold bg-rose-50 rounded-xl m-8">Tahun Ajaran aktif belum diatur oleh Admin. Hubungi Tata Usaha.</div>

  // 2. Fetch Data Paralel untuk kecepatan
  const [resKasus, resSiswa, resMaster] = await Promise.all([
    // Ambil history pelanggaran di tahun ini
    supabase.from('siswa_pelanggaran').select(`
      id, tanggal, keterangan, foto_url, siswa_id, master_pelanggaran_id, diinput_oleh,
      siswa(nama_lengkap, kelas(tingkat, nomor_kelas, kelompok)),
      master_pelanggaran(nama_pelanggaran, poin),
      pelapor:profiles!siswa_pelanggaran_diinput_oleh_fkey(nama_lengkap)
    `).eq('tahun_ajaran_id', taAktif.id).order('tanggal', { ascending: false }).order('created_at', { ascending: false }),

    // Ambil list siswa aktif 
    supabase.from('siswa').select(`
      id, nama_lengkap, nisn,
      kelas!inner(tingkat, nomor_kelas, kelompok)
    `).eq('status', 'aktif').order('nama_lengkap'),

    // Ambil kamus master pelanggaran
    supabase.from('master_pelanggaran').select('*').order('poin', { ascending: true })
  ])

  // Mapping nama kelas untuk dropdown pencarian siswa
  const formattedSiswa = (resSiswa.data || []).map(s => {
    const k = s.kelas as any
    return {
      id: s.id,
      nama_lengkap: s.nama_lengkap,
      nisn: s.nisn, 
      kelas: k ? `${k.tingkat}-${k.nomor_kelas} ${k.kelompok!=='UMUM'?k.kelompok:''}`.trim() : 'Tanpa Kelas'
    }
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* HEADER YANG LEBIH CANTIK & MOBILE FRIENDLY */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-3">
          <div className="bg-rose-100 p-3 rounded-2xl text-rose-700 shadow-sm border border-rose-200/50 shrink-0 mt-1 md:mt-0">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">Kedisiplinan & Tata Tertib</h1>
            <p className="text-sm text-slate-500 mt-1">
              Catat pelanggaran siswa, pantau akumulasi poin, dan lampirkan bukti.
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-2 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-md border border-slate-700 w-full md:w-auto shrink-0">
          <CalendarDays className="h-4 w-4 text-slate-300" />
          <span>Tahun Ajaran: <strong className="font-bold text-rose-400">{taAktif.nama}</strong></span>
        </div>
      </div>

      <KedisiplinanClient 
        currentUser={currentUser}
        kasusList={resKasus.data || []}
        siswaList={formattedSiswa}
        masterList={resMaster.data || []}
      />
    </div>
  )
}