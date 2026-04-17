// Lokasi: app/dashboard/siswa/[id]/page.tsx
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { DetailSiswaClient } from './components/detail-client'
import { getSanksiList } from '../../kedisiplinan/actions'
import { getUserRoles } from '@/lib/features'

export const metadata = { title: 'Buku Induk Siswa - MANSATAS' }
export const dynamic = 'force-dynamic'

export default async function DetailSiswaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()

  // STRICT RBAC CHECK FOR DETAIL VIEW
  const userRoles = await getUserRoles(db, user.id)
  const isAdminTu = userRoles.some(r => ['super_admin', 'admin_tu'].includes(r))
  const isKepsekWakamad = userRoles.some(r => ['kepsek', 'wakamad'].includes(r))

  // FIX: Ganti SELECT s.* → kolom eksplisit (s.* ambil 40+ kolom tiap query)
  const siswa = await db.prepare(`
    SELECT
      s.id, s.nisn, s.nis_lokal, s.nama_lengkap, s.jenis_kelamin, s.status,
      s.foto_url, s.tempat_tinggal, s.kelas_id, s.minat_jurusan,
      s.nik, s.tempat_lahir, s.tanggal_lahir, s.agama,
      s.jumlah_saudara, s.anak_ke, s.status_anak,
      s.alamat_lengkap, s.rt, s.rw, s.desa_kelurahan, s.kecamatan,
      s.kabupaten_kota, s.provinsi, s.kode_pos, s.nomor_whatsapp, s.nomor_kk,
      s.nama_ayah, s.nik_ayah, s.tempat_lahir_ayah, s.tanggal_lahir_ayah,
      s.status_ayah, s.pendidikan_ayah, s.pekerjaan_ayah, s.penghasilan_ayah,
      s.nama_ibu, s.nik_ibu, s.tempat_lahir_ibu, s.tanggal_lahir_ibu,
      s.status_ibu, s.pendidikan_ibu, s.pekerjaan_ibu, s.penghasilan_ibu,
      k.tingkat, k.kelompok, k.nomor_kelas
    FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id
    WHERE s.id = ?
  `).bind(id).first<any>()

  if (!siswa) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
      <h1 className="text-2xl font-bold mb-2">Siswa Tidak Ditemukan</h1>
      <Link href="/dashboard/siswa" className="text-blue-600 hover:underline">Kembali ke Daftar Siswa</Link>
    </div>
  )

  // Verify access for Wali Kelas / Guru BK / Other roles
  let isAuthorized = false;
  if (isAdminTu || isKepsekWakamad) {
    isAuthorized = true;
  } else if (siswa.kelas_id) {
    // Check if user is the assigned Wali Kelas for THIS student's class
    if (userRoles.includes('wali_kelas')) {
      const isWali = await db.prepare('SELECT id FROM kelas WHERE id = ? AND wali_kelas_id = ?').bind(siswa.kelas_id, user.id).first()
      if (isWali) isAuthorized = true
    }
    
    // Check if user is the assigned Guru BK for THIS student's class
    if (!isAuthorized && userRoles.includes('guru_bk')) {
      const isBP = await db.prepare('SELECT id FROM kelas_binaan_bk WHERE kelas_id = ? AND guru_bk_id = ?').bind(siswa.kelas_id, user.id).first()
      if (isBP) isAuthorized = true
    }
  }

  // Final Strict Block
  if (!isAuthorized) {
    redirect('/dashboard/siswa')
  }

  const [riwayatKelas, pelanggaran, izinKeluar, izinKelas, rekapNilai, kelasResult, sanksiList] = await Promise.all([
    db.prepare(`
      SELECT rk.id, rk.created_at, k.tingkat, k.kelompok, k.nomor_kelas, ta.nama, ta.semester
      FROM riwayat_kelas rk
      LEFT JOIN kelas k ON rk.kelas_id = k.id
      LEFT JOIN tahun_ajaran ta ON rk.tahun_ajaran_id = ta.id
      WHERE rk.siswa_id = ? ORDER BY rk.created_at DESC
    `).bind(id).all<any>(),

    db.prepare(`
      SELECT sp.id, sp.tanggal, sp.keterangan, sp.foto_url,
        mp.nama_pelanggaran, mp.poin, mp.kategori,
        u.nama_lengkap as pelapor_nama
      FROM siswa_pelanggaran sp
      JOIN master_pelanggaran mp ON sp.master_pelanggaran_id = mp.id
      LEFT JOIN "user" u ON sp.diinput_oleh = u.id
      WHERE sp.siswa_id = ? ORDER BY sp.tanggal DESC
    `).bind(id).all<any>(),

    db.prepare(`
      SELECT ik.id, ik.waktu_keluar, ik.waktu_kembali, ik.status, ik.keterangan,
        u.nama_lengkap as pelapor_nama
      FROM izin_keluar_komplek ik
      LEFT JOIN "user" u ON ik.diinput_oleh = u.id
      WHERE ik.siswa_id = ? ORDER BY ik.waktu_keluar DESC
    `).bind(id).all<any>(),

    db.prepare(`
      SELECT itk.id, itk.tanggal, itk.jam_pelajaran, itk.alasan, itk.keterangan,
        u.nama_lengkap as pelapor_nama
      FROM izin_tidak_masuk_kelas itk
      LEFT JOIN "user" u ON itk.diinput_oleh = u.id
      WHERE itk.siswa_id = ? ORDER BY itk.tanggal DESC
    `).bind(id).all<any>(),

    // FIX: Ganti SELECT * → kolom spesifik
    db.prepare(`
      SELECT siswa_id, nilai_smt1, nilai_smt2, nilai_smt3, nilai_smt4, nilai_smt5, nilai_smt6
      FROM rekap_nilai_akademik WHERE siswa_id = ?
    `).bind(id).first<any>(),

    db.prepare(`
      SELECT id, tingkat, nomor_kelas, kelompok
      FROM kelas ORDER BY tingkat ASC, kelompok ASC, nomor_kelas ASC
    `).all<any>(),

    getSanksiList(),
  ])

  const rawRna = rekapNilai || {}
  const parseStr = (val: any) => { try { return val ? JSON.parse(val) : {} } catch { return {} } }

  const siswaWithNilai = {
    ...siswa,
    kelas: siswa.tingkat ? {
      id: siswa.kelas_id, tingkat: siswa.tingkat,
      kelompok: siswa.kelompok, nomor_kelas: siswa.nomor_kelas
    } : null,
    rekap_nilai_akademik: {
      nilai_smt1: parseStr(rawRna.nilai_smt1),
      nilai_smt2: parseStr(rawRna.nilai_smt2),
      nilai_smt3: parseStr(rawRna.nilai_smt3),
      nilai_smt4: parseStr(rawRna.nilai_smt4),
      nilai_smt5: parseStr(rawRna.nilai_smt5),
      nilai_smt6: parseStr(rawRna.nilai_smt6),
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <Link href="/dashboard/siswa" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 transition-colors bg-surface px-4 py-2 rounded-xl shadow-sm border border-surface w-fit">
        <ChevronLeft className="h-4 w-4" /> Kembali ke Data Siswa
      </Link>
      <DetailSiswaClient
        siswa={siswaWithNilai}
        riwayatKelas={riwayatKelas.results || []}
        pelanggaran={pelanggaran.results || []}
        izinKeluar={izinKeluar.results || []}
        izinKelas={izinKelas.results || []}
        kelasList={kelasResult.results || []}
        currentUser={{...user, roles: userRoles}}
        sanksiList={sanksiList}
      />
    </div>
  )
}
