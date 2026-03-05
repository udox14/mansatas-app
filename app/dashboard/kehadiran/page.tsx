import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { KehadiranClient } from './components/kehadiran-client'
import { CalendarCheck } from 'lucide-react'

export const metadata = { title: 'Kehadiran & Jurnal - MANSATAS App' }

// Mendefinisikan tipe data agar TypeScript tidak protes "any[]"
type KelasProps = { id: string, tingkat: number, nomor_kelas: string, kelompok: string }
type PenugasanProps = { id: string, mapel: { nama_mapel: string }, kelas: KelasProps }

export default async function KehadiranPage() {
  const supabase = await createClient()
  
  // 1. Cek User & Role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, nama_lengkap')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // 2. Ambil Tahun Ajaran Aktif (Wajib untuk semua role)
  const { data: taAktif } = await supabase
    .from('tahun_ajaran')
    .select('id, nama, semester')
    .eq('is_active', true)
    .single()

  // PERBAIKAN: Memberikan tipe data eksplisit pada variabel array
  let kelasList: KelasProps[] = []
  let penugasanGuru: PenugasanProps[] = []

  // 3. Ambil data sesuai Role
  const isAdmin = ['super_admin', 'admin_tu', 'kepsek'].includes(profile.role)

  if (isAdmin) {
    // Jika Admin: Ambil semua daftar kelas untuk form rekap
    const { data: kelas } = await supabase
      .from('kelas')
      .select('id, tingkat, nomor_kelas, kelompok')
      .order('tingkat', { ascending: true })
      .order('nomor_kelas', { ascending: true })
      
    kelasList = (kelas as KelasProps[]) || []
  } else if (profile.role === 'guru') {
    // Jika Guru: Ambil JADWAL MENGAJAR dia saja di tahun ajaran aktif
    if (taAktif) {
      const { data: penugasan } = await supabase
        .from('penugasan_mengajar')
        .select(`
          id,
          mapel:mata_pelajaran(nama_mapel),
          kelas:kelas(id, tingkat, nomor_kelas, kelompok)
        `)
        .eq('guru_id', profile.id)
        .eq('tahun_ajaran_id', taAktif.id)
      
      penugasanGuru = (penugasan as unknown as PenugasanProps[]) || []
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-700 shadow-sm border border-emerald-200/50">
          <CalendarCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kehadiran & Jurnal</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin 
              ? 'Kelola rekapitulasi kehadiran bulanan siswa untuk e-rapor.' 
              : 'Isi jurnal kelas harian dan catat absensi/perilaku siswa.'}
          </p>
        </div>
      </div>

      <KehadiranClient 
        currentUser={profile}
        taAktif={taAktif}
        kelasList={kelasList}
        penugasanGuru={penugasanGuru}
      />
    </div>
  )
}