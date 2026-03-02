import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AkademikClient } from './akademik-client'
import { GraduationCap } from 'lucide-react'

export const metadata = { title: 'Pusat Akademik - MANSATAS App' }

export default async function AkademikPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Ambil Data Master Mapel
  const { data: mapelData } = await supabase
    .from('mata_pelajaran')
    .select('*')
    .order('nama_mapel')

  // Ambil Data Penugasan (Join tabel Guru, Mapel, dan Kelas)
  const { data: penugasanData } = await supabase
    .from('penugasan_mengajar')
    .select(`
      id,
      guru:profiles(nama_lengkap),
      mapel:mata_pelajaran(nama_mapel, kelompok),
      kelas:kelas(tingkat, nomor_kelas, kelompok)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-indigo-600" />
            Pusat Akademik & Kurikulum
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola Master Mata Pelajaran (Fase E/F) dan Import Beban Mengajar dari ASC Timetables.
          </p>
        </div>
      </div>

      <AkademikClient mapelData={mapelData || []} penugasanData={(penugasanData as any) || []} />
    </div>
  )
}