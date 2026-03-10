// Lokasi: app/dashboard/kelas/[id]/page.tsx
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Users, UserCircle } from 'lucide-react'
import { DetailKelasClient } from './components/detail-client'

export const metadata = { title: 'Detail Kelas - MANSATAS App' }

export default async function DetailKelasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()

  const kelasData = await db.prepare(`
    SELECT k.id, k.tingkat, k.kelompok, k.nomor_kelas, k.kapasitas, k.wali_kelas_id,
      u.nama_lengkap as wali_kelas_nama
    FROM kelas k LEFT JOIN user u ON k.wali_kelas_id = u.id
    WHERE k.id = ?
  `).bind(id).first<any>()

  if (!kelasData) return <div className="p-8 text-center text-red-500">Data kelas tidak ditemukan.</div>

  const siswaResult = await db.prepare(`
    SELECT id, nisn, nama_lengkap, jenis_kelamin, status
    FROM siswa WHERE kelas_id = ? AND status = 'aktif'
    ORDER BY nama_lengkap ASC
  `).bind(id).all<any>()

  const siswaList = siswaResult.results || []
  const isFull = siswaList.length >= kelasData.kapasitas
  const namaKelasSingkat = `${kelasData.tingkat}-${kelasData.nomor_kelas}`

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Link href="/dashboard/kelas" className="hover:text-blue-600 flex items-center gap-1 transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 w-fit font-bold text-sm text-slate-500">
        <ChevronLeft className="h-4 w-4" /> Kembali ke Manajemen Kelas
      </Link>

      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-blue-50 rounded-bl-full -z-0 opacity-50"></div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">{namaKelasSingkat}</h1>
            {kelasData.kelompok !== 'UMUM' && (
              <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 border border-indigo-200 rounded-full shadow-sm">{kelasData.kelompok}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <UserCircle className="h-5 w-5 text-slate-400" />
            <span>Wali Kelas: <strong className="text-slate-800">{kelasData.wali_kelas_nama || 'Belum Ditentukan'}</strong></span>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className={`p-3.5 rounded-xl shadow-inner ${isFull ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Kapasitas Kelas</p>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl sm:text-3xl font-black tracking-tight ${isFull ? 'text-red-600' : 'text-slate-900'}`}>{siswaList.length}</span>
                <span className="text-slate-400 font-bold text-sm">/ {kelasData.kapasitas}</span>
              </div>
            </div>
          </div>
          {isFull && <div className="px-4 py-1.5 bg-red-100 border border-red-200 text-red-700 text-xs font-black tracking-wider rounded-full shadow-sm animate-pulse">PENUH</div>}
        </div>
      </div>

      <div className="pt-2">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600"/> Daftar Siswa Kelas {namaKelasSingkat}
        </h2>
        <DetailKelasClient siswaData={siswaList} kelasId={kelasData.id} tingkatKelas={kelasData.tingkat} />
      </div>
    </div>
  )
}