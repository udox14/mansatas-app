// Lokasi: app/dashboard/kelas/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB, parseJsonCol } from '@/utils/db'
import { redirect } from 'next/navigation'
import { KelasClient } from './components/kelas-client'
import { Library } from 'lucide-react'

export const metadata = { title: 'Manajemen Kelas - MANSATAS App' }

async function KelasDataFetcher() {
  const db = await getDB()

  const [kelasResult, guruResult, taAktif] = await Promise.all([
    db.prepare(`
      SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok, k.kapasitas, k.wali_kelas_id,
        u.nama_lengkap as wali_kelas_nama,
        (SELECT COUNT(*) FROM siswa s WHERE s.kelas_id = k.id AND s.status = 'aktif') as jumlah_siswa
      FROM kelas k LEFT JOIN "user" u ON k.wali_kelas_id = u.id
      ORDER BY k.tingkat ASC, k.kelompok ASC, k.nomor_kelas ASC
    `).all<any>(),
    db.prepare(`SELECT id, nama_lengkap FROM "user" WHERE role IN ('guru','guru_bk') ORDER BY nama_lengkap ASC`).all<any>(),
    db.prepare(`SELECT daftar_jurusan FROM tahun_ajaran WHERE is_active = 1`).first<any>()
  ])

  const formattedData = (kelasResult.results || []).map((item: any) => ({
    id: item.id, tingkat: item.tingkat, nomor_kelas: item.nomor_kelas,
    kelompok: item.kelompok, kapasitas: item.kapasitas || 36,
    wali_kelas_id: item.wali_kelas_id || 'none',
    wali_kelas_nama: item.wali_kelas_nama || 'Belum Ditentukan',
    jumlah_siswa: item.jumlah_siswa || 0
  }))

  const daftarJurusan = taAktif?.daftar_jurusan
    ? parseJsonCol<string[]>(taAktif.daftar_jurusan, []) || ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']
    : ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  return <KelasClient initialData={formattedData} daftarGuru={guruResult.results || []} daftarJurusan={daftarJurusan} />
}

export default async function KelasPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center gap-3">
        <div className="bg-blue-100 p-3 rounded-2xl text-blue-700 shadow-sm border border-blue-200/50">
          <Library className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Manajemen Kelas</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola data kelas, kapasitas, dan penugasan Wali Kelas langsung dari tabel.</p>
        </div>
      </div>

      <Suspense fallback={
        <div className="bg-white/50 rounded-3xl p-12 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
           <div className="bg-blue-50 p-5 rounded-full mb-5 border border-blue-100 relative">
             <div className="absolute inset-0 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
             <Library className="h-8 w-8 text-blue-600 animate-pulse" />
           </div>
           <h3 className="text-xl font-bold text-slate-800">Membaca Rombongan Belajar...</h3>
        </div>
      }>
        <KelasDataFetcher />
      </Suspense>
    </div>
  )
}