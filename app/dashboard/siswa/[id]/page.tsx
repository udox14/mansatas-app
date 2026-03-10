// Lokasi: app/dashboard/siswa/[id]/page.tsx
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { DetailSiswaClient } from './components/detail-client'

export const metadata = { title: 'Buku Induk Siswa - MANSATAS' }

export default async function DetailSiswaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()

  const siswa = await db.prepare(`
    SELECT s.*, k.tingkat, k.kelompok, k.nomor_kelas
    FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE s.id = ?
  `).bind(id).first<any>()

  if (!siswa) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
      <h1 className="text-2xl font-bold mb-2">Siswa Tidak Ditemukan</h1>
      <Link href="/dashboard/siswa" className="text-blue-600 hover:underline">Kembali ke Daftar Siswa</Link>
    </div>
  )

  const [riwayatKelas, pelanggaran, izinKeluar, izinKelas, rekapNilai] = await Promise.all([
    db.prepare(`SELECT rk.id, rk.created_at, k.tingkat, k.kelompok, k.nomor_kelas, ta.nama, ta.semester FROM riwayat_kelas rk LEFT JOIN kelas k ON rk.kelas_id = k.id LEFT JOIN tahun_ajaran ta ON rk.tahun_ajaran_id = ta.id WHERE rk.siswa_id = ? ORDER BY rk.created_at DESC`).bind(id).all<any>(),
    db.prepare(`SELECT sp.id, sp.tanggal, sp.keterangan, sp.foto_url, mp.nama_pelanggaran, mp.poin, mp.kategori, u.nama_lengkap as pelapor_nama FROM siswa_pelanggaran sp JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id LEFT JOIN user u ON sp.diinput_oleh = u.id WHERE sp.siswa_id = ? ORDER BY sp.tanggal DESC`).bind(id).all<any>(),
    db.prepare(`SELECT ik.id, ik.waktu_keluar, ik.waktu_kembali, ik.status, ik.keterangan, u.nama_lengkap as pelapor_nama FROM izin_keluar_komplek ik LEFT JOIN user u ON ik.diinput_oleh = u.id WHERE ik.siswa_id = ? ORDER BY ik.waktu_keluar DESC`).bind(id).all<any>(),
    db.prepare(`SELECT itk.id, itk.tanggal, itk.jam_pelajaran, itk.alasan, itk.keterangan, u.nama_lengkap as pelapor_nama FROM izin_tidak_masuk_kelas itk LEFT JOIN user u ON itk.diinput_oleh = u.id WHERE itk.siswa_id = ? ORDER BY itk.tanggal DESC`).bind(id).all<any>(),
    db.prepare(`SELECT * FROM rekap_nilai_akademik WHERE siswa_id = ?`).bind(id).all<any>(),
  ])

  const siswaWithNilai = {
    ...siswa,
    kelas: siswa.tingkat ? { tingkat: siswa.tingkat, kelompok: siswa.kelompok, nomor_kelas: siswa.nomor_kelas } : null,
    rekap_nilai_akademik: rekapNilai.results || []
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <Link href="/dashboard/siswa" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200/60 w-fit">
        <ChevronLeft className="h-4 w-4" /> Kembali ke Data Siswa
      </Link>
      <DetailSiswaClient
        siswa={siswaWithNilai}
        riwayatKelas={riwayatKelas.results || []}
        pelanggaran={pelanggaran.results || []}
        izinKeluar={izinKeluar.results || []}
        izinKelas={izinKelas.results || []}
      />
    </div>
  )
}