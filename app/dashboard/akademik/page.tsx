// Lokasi: app/dashboard/akademik/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB, parseJsonCol } from '@/utils/db'
import { redirect } from 'next/navigation'
import { AkademikClient } from './akademik-client'
import { BookOpen, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { getDaftarMapelCached, getTahunAjaranAktifCached } from '@/utils/cache'

export const metadata = { title: 'Pusat Akademik - MANSATAS App' }

async function AkademikDataFetcher() {
  const db = await getDB()

  // FIX: Gunakan cache untuk data statis mapel dan tahun ajaran
  const [taAktif, mapelList] = await Promise.all([
    getTahunAjaranAktifCached(),
    getDaftarMapelCached(),
  ])

  let penugasanData: any[] = []
  if (taAktif) {
    // Hanya ambil kolom yang ditampilkan di tabel
    const res = await db
      .prepare(
        `SELECT pm.id,
          u.nama_lengkap as guru_nama,
          mp.nama_mapel, mp.kelompok as mapel_kelompok,
          k.tingkat, k.nomor_kelas, k.kelompok as kelas_kelompok
         FROM penugasan_mengajar pm
         JOIN "user" u ON pm.guru_id = u.id
         JOIN mata_pelajaran mp ON pm.mapel_id = mp.id
         JOIN kelas k ON pm.kelas_id = k.id
         WHERE pm.tahun_ajaran_id = ?
         ORDER BY k.tingkat ASC, k.nomor_kelas ASC, mp.nama_mapel ASC`
      )
      .bind(taAktif.id)
      .all<any>()

    penugasanData = (res.results ?? []).map((p: any) => ({
      id: p.id,
      guru: { nama_lengkap: p.guru_nama },
      mapel: { nama_mapel: p.nama_mapel, kelompok: p.mapel_kelompok },
      kelas: { tingkat: p.tingkat, nomor_kelas: p.nomor_kelas, kelompok: p.kelas_kelompok },
    }))
  }

  const daftarJurusan = taAktif?.daftar_jurusan
    ? parseJsonCol<string[]>(taAktif.daftar_jurusan, []) ?? ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']
    : ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  return (
    <AkademikClient
      mapelData={mapelList}
      penugasanData={penugasanData}
      taAktif={taAktif}
      daftarJurusan={daftarJurusan}
    />
  )
}

export default async function AkademikPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Pusat Akademik"
        description="Kelola master mata pelajaran dan jadwal mengajar."
        icon={BookOpen}
        iconColor="text-emerald-500"
      />
      <Suspense
        fallback={
          <div className="bg-white/50 rounded-3xl p-12 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
            <div className="bg-emerald-50 p-4 rounded-full mb-4 shadow-inner border border-emerald-100">
              <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Menyusun Pusat Akademik...</h3>
          </div>
        }
      >
        <AkademikDataFetcher />
      </Suspense>
    </div>
  )
}
