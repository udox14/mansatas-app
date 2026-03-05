// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/akademik/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AkademikClient } from './akademik-client'
import { BookOpen } from 'lucide-react'

export const metadata = { title: 'Pusat Akademik - MANSATAS App' }

export default async function AkademikPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: taAktif } = await supabase.from('tahun_ajaran').select('id, nama, semester, daftar_jurusan').eq('is_active', true).single()

  const { data: mapelData } = await supabase.from('mata_pelajaran').select('*').order('nama_mapel', { ascending: true })

  let penugasanData: any[] = []
  if (taAktif) {
    const { data } = await supabase
      .from('penugasan_mengajar')
      .select(`
        id,
        guru:profiles!inner(nama_lengkap),
        mapel:mata_pelajaran!inner(nama_mapel, kelompok),
        kelas:kelas!inner(tingkat, nomor_kelas, kelompok)
      `)
      .eq('tahun_ajaran_id', taAktif.id)
      .order('created_at', { ascending: false })

    penugasanData = data || []
  }

  // PERBAIKAN: Ambil dari TA Aktif langsung
  const daftarJurusan = taAktif?.daftar_jurusan || ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-700 shadow-sm border border-emerald-200/50">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pusat Akademik</h1>
            <p className="text-sm text-slate-500 mt-1">
              Kelola master mata pelajaran dan jadwal mengajar dari ASC Timetables.
            </p>
          </div>
        </div>
      </div>

      <AkademikClient 
        mapelData={mapelData || []} 
        penugasanData={penugasanData} 
        taAktif={taAktif} 
        daftarJurusan={daftarJurusan}
      />
    </div>
  )
}