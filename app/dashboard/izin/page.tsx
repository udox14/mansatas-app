// Lokasi: app/dashboard/izin/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB, parseJsonCol } from '@/utils/db'
import { redirect } from 'next/navigation'
import { IzinClient } from './components/izin-client'
import { DoorOpen } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Perizinan Siswa - MANSATAS App' }

async function IzinDataFetcher({ currentUserRole }: { currentUserRole: string }) {
  const db = await getDB()
  const today = new Date().toISOString().split('T')[0]

  const [siswaResult, keluarResult, kelasResult] = await Promise.all([
    db.prepare(`
      SELECT s.id, s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas
      FROM siswa s JOIN kelas k ON s.kelas_id = k.id
      WHERE s.status = 'aktif' ORDER BY s.nama_lengkap
    `).all<any>(),
    db.prepare(`
      SELECT ik.id, ik.waktu_keluar, ik.waktu_kembali, ik.status, ik.keterangan,
        s.nama_lengkap as siswa_nama, k.tingkat, k.nomor_kelas, u.nama_lengkap as pelapor_nama
      FROM izin_keluar_komplek ik
      JOIN siswa s ON ik.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      LEFT JOIN "user" u ON ik.diinput_oleh = u.id
      ORDER BY ik.waktu_keluar DESC LIMIT 300
    `).all<any>(),
    db.prepare(`
      SELECT itk.id, itk.tanggal, itk.jam_pelajaran, itk.alasan, itk.keterangan,
        s.nama_lengkap as siswa_nama, k.tingkat, k.nomor_kelas, u.nama_lengkap as pelapor_nama
      FROM izin_tidak_masuk_kelas itk
      JOIN siswa s ON itk.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      LEFT JOIN "user" u ON itk.diinput_oleh = u.id
      WHERE itk.tanggal = ?
      ORDER BY itk.created_at DESC
    `).bind(today).all<any>()
  ])

  const filteredKeluar = (keluarResult.results || [])
    .filter((k: any) => k.waktu_keluar?.startsWith(today) || k.status === 'BELUM KEMBALI')
    .map((k: any) => ({ ...k, siswa: { nama_lengkap: k.siswa_nama, kelas: k.tingkat ? { tingkat: k.tingkat, nomor_kelas: k.nomor_kelas } : null }, pelapor: { nama_lengkap: k.pelapor_nama } }))

  const formattedSiswa = (siswaResult.results || []).map((s: any) => ({
    id: s.id, nama_lengkap: s.nama_lengkap, nisn: s.nisn,
    kelas: s.tingkat ? { tingkat: s.tingkat, nomor_kelas: s.nomor_kelas } : null
  }))

  const formattedIzinKelas = (kelasResult.results || []).map((itk: any) => ({
    ...itk,
    jam_pelajaran: parseJsonCol(itk.jam_pelajaran, null) ?? itk.jam_pelajaran,
    siswa: { nama_lengkap: itk.siswa_nama, kelas: itk.tingkat ? { tingkat: itk.tingkat, nomor_kelas: itk.nomor_kelas } : null },
    pelapor: { nama_lengkap: itk.pelapor_nama }
  }))

  return <IzinClient siswaList={formattedSiswa} izinKeluarList={filteredKeluar} izinKelasList={formattedIzinKelas} currentUserRole={currentUserRole} />
}

export default async function IzinPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const role = (user as any).role ?? ''

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader title="Perizinan Siswa Harian" description="Posko pencatatan siswa keluar komplek dan izin meninggalkan jam pelajaran." icon={DoorOpen} iconColor="text-indigo-500" />
      <Suspense fallback={
        <div className="bg-white/50 rounded-3xl p-12 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
           <div className="bg-blue-50 p-5 rounded-full mb-5 border border-blue-100 relative">
             <div className="absolute inset-0 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
             <DoorOpen className="h-8 w-8 text-blue-600 animate-pulse" />
           </div>
           <h3 className="text-xl font-bold text-slate-800">Menarik Data Perizinan...</h3>
        </div>
      }>
        <IzinDataFetcher currentUserRole={role} />
      </Suspense>
    </div>
  )
}