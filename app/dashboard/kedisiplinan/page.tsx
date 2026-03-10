// Lokasi: app/dashboard/kedisiplinan/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import { ShieldAlert, CalendarDays } from 'lucide-react'
import { KedisiplinanClient } from './components/kedisiplinan-client'

export const metadata = { title: 'Kedisiplinan & Tata Tertib - MANSATAS App' }

async function KedisiplinanDataFetcher({ currentUser, taAktifId }: { currentUser: any, taAktifId: string }) {
  const db = await getDB()

  const [kasusResult, siswaResult, masterResult] = await Promise.all([
    db.prepare(`
      SELECT sp.id, sp.tanggal, sp.keterangan, sp.foto_url, sp.siswa_id, sp.master_pelanggaran_id, sp.diinput_oleh,
        s.nama_lengkap as siswa_nama, k.tingkat, k.nomor_kelas, k.kelompok,
        mp.nama_pelanggaran, mp.poin, u.nama_lengkap as pelapor_nama
      FROM siswa_pelanggaran sp
      JOIN siswa s ON sp.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      LEFT JOIN user u ON sp.diinput_oleh = u.id
      WHERE sp.tahun_ajaran_id = ?
      ORDER BY sp.tanggal DESC, sp.created_at DESC
    `).bind(taAktifId).all<any>(),
    db.prepare(`
      SELECT s.id, s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s JOIN kelas k ON s.kelas_id = k.id
      WHERE s.status = 'aktif' ORDER BY s.nama_lengkap
    `).all<any>(),
    db.prepare(`SELECT * FROM master_pelanggaran ORDER BY poin ASC`).all<any>()
  ])

  const formattedSiswa = (siswaResult.results || []).map((s: any) => ({
    id: s.id, nama_lengkap: s.nama_lengkap, nisn: s.nisn,
    kelas: s.tingkat ? `${s.tingkat}-${s.nomor_kelas} ${s.kelompok !== 'UMUM' ? s.kelompok : ''}`.trim() : 'Tanpa Kelas'
  }))

  const formattedKasus = (kasusResult.results || []).map((p: any) => ({
    id: p.id, tanggal: p.tanggal, keterangan: p.keterangan, foto_url: p.foto_url,
    siswa_id: p.siswa_id, master_pelanggaran_id: p.master_pelanggaran_id, diinput_oleh: p.diinput_oleh,
    siswa: { nama_lengkap: p.siswa_nama, kelas: p.tingkat ? { tingkat: p.tingkat, nomor_kelas: p.nomor_kelas, kelompok: p.kelompok } : null },
    master_pelanggaran: { nama_pelanggaran: p.nama_pelanggaran, poin: p.poin },
    pelapor: { nama_lengkap: p.pelapor_nama }
  }))

  return <KedisiplinanClient currentUser={currentUser} kasusList={formattedKasus} siswaList={formattedSiswa} masterList={masterResult.results || []} />
}

export default async function KedisiplinanPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const role = (user as any).role ?? 'guru'
  const currentUser = { id: user.id, role, nama: (user as any).nama_lengkap ?? user.name ?? '' }

  const db = await getDB()
  const taAktif = await db.prepare('SELECT id, nama FROM tahun_ajaran WHERE is_active = 1').first<any>()
  if (!taAktif) return <div className="p-8 text-center text-rose-500 font-bold bg-rose-50 rounded-xl m-8">Tahun Ajaran aktif belum diatur oleh Admin. Hubungi Tata Usaha.</div>

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-3">
          <div className="bg-rose-100 p-3 rounded-2xl text-rose-700 shadow-sm border border-rose-200/50 shrink-0">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">Kedisiplinan & Tata Tertib</h1>
            <p className="text-sm text-slate-500 mt-1">Catat pelanggaran siswa, pantau akumulasi poin, dan lampirkan bukti.</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-md border border-slate-700 w-full md:w-auto shrink-0">
          <CalendarDays className="h-4 w-4 text-slate-300" />
          <span>Tahun Ajaran: <strong className="font-bold text-rose-400">{taAktif.nama}</strong></span>
        </div>
      </div>
      <Suspense fallback={
        <div className="bg-white/50 rounded-3xl p-12 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
           <div className="bg-rose-50 p-5 rounded-full mb-5 border border-rose-100 relative">
             <div className="absolute inset-0 rounded-full border-4 border-rose-200 border-t-rose-600 animate-spin"></div>
             <ShieldAlert className="h-8 w-8 text-rose-600 animate-pulse" />
           </div>
           <h3 className="text-xl font-bold text-slate-800">Menyinkronkan Data BK...</h3>
        </div>
      }>
        <KedisiplinanDataFetcher currentUser={currentUser} taAktifId={taAktif.id} />
      </Suspense>
    </div>
  )
}