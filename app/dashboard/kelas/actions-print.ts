'use server'

import { getDB } from '@/utils/db'

export type SiswaAbsensiRow = {
  urut: number
  nis: string
  nisn: string
  nama_lengkap: string
  jenis_kelamin: 'L' | 'P'
}

export type BlankAbsensiData = {
  kelas: {
    id: string
    tingkat: number
    nomor_kelas: string
    kelompok: string
    wali_kelas_nama: string
  }
  tahun_ajaran: {
    nama: string
    semester: number
  } | null
  siswa: SiswaAbsensiRow[]
  jumlah_l: number
  jumlah_p: number
}

export async function getDataBlankAbsensi(kelasId: string): Promise<BlankAbsensiData | null> {
  const db = await getDB()

  const [kelasRow, siswaResult, taAktif] = await Promise.all([
    db.prepare(`
      SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok,
             u.nama_lengkap as wali_kelas_nama
      FROM kelas k
      LEFT JOIN "user" u ON k.wali_kelas_id = u.id
      WHERE k.id = ?
    `).bind(kelasId).first<any>(),

    db.prepare(`
      SELECT nisn, nis_lokal, nama_lengkap, jenis_kelamin
      FROM siswa
      WHERE kelas_id = ? AND status = 'aktif'
      ORDER BY nama_lengkap ASC
    `).bind(kelasId).all<any>(),

    db.prepare(`
      SELECT nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1
    `).first<{ nama: string; semester: number }>(),
  ])

  if (!kelasRow) return null

  const siswaRows = siswaResult.results ?? []
  const siswa: SiswaAbsensiRow[] = siswaRows.map((s: any, i: number) => ({
    urut: i + 1,
    nis: s.nis_lokal ?? '-',
    nisn: s.nisn ?? '-',
    nama_lengkap: s.nama_lengkap,
    jenis_kelamin: s.jenis_kelamin,
  }))

  const jumlah_l = siswa.filter(s => s.jenis_kelamin === 'L').length
  const jumlah_p = siswa.filter(s => s.jenis_kelamin === 'P').length

  return {
    kelas: {
      id: kelasRow.id,
      tingkat: kelasRow.tingkat,
      nomor_kelas: kelasRow.nomor_kelas,
      kelompok: kelasRow.kelompok,
      wali_kelas_nama: kelasRow.wali_kelas_nama ?? 'Belum Ditentukan',
    },
    tahun_ajaran: taAktif ?? null,
    siswa,
    jumlah_l,
    jumlah_p,
  }
}