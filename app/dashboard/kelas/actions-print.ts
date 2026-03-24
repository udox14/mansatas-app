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
    jumlah_l: siswa.filter(s => s.jenis_kelamin === 'L').length,
    jumlah_p: siswa.filter(s => s.jenis_kelamin === 'P').length,
  }
}

// Fetch semua kelas berdasarkan filter tingkat ('10'|'11'|'12'|'semua')
export async function getDataBlankAbsensiByTingkat(
  tingkat: '10' | '11' | '12' | 'semua'
): Promise<BlankAbsensiData[]> {
  const db = await getDB()

  let kelasQuery = `
    SELECT k.id, k.tingkat, k.nomor_kelas, k.kelompok,
           u.nama_lengkap as wali_kelas_nama
    FROM kelas k
    LEFT JOIN "user" u ON k.wali_kelas_id = u.id
  `
  const params: any[] = []
  if (tingkat !== 'semua') {
    kelasQuery += ` WHERE k.tingkat = ?`
    params.push(parseInt(tingkat))
  }
  kelasQuery += ` ORDER BY k.tingkat ASC, k.kelompok ASC, k.nomor_kelas ASC`

  const [kelasList, taAktif] = await Promise.all([
    db.prepare(kelasQuery).bind(...params).all<any>(),
    db.prepare(`SELECT nama, semester FROM tahun_ajaran WHERE is_active = 1 LIMIT 1`).first<any>(),
  ])

  const rows = kelasList.results ?? []
  if (rows.length === 0) return []

  // Batch: ambil semua siswa sekaligus lalu group di JS
  const kelasIds = rows.map((k: any) => k.id)
  const placeholders = kelasIds.map(() => '?').join(',')
  const siswaResult = await db.prepare(`
    SELECT kelas_id, nisn, nis_lokal, nama_lengkap, jenis_kelamin
    FROM siswa
    WHERE kelas_id IN (${placeholders}) AND status = 'aktif'
    ORDER BY nama_lengkap ASC
  `).bind(...kelasIds).all<any>()

  const siswaByKelas: Record<string, any[]> = {}
  for (const s of siswaResult.results ?? []) {
    if (!siswaByKelas[s.kelas_id]) siswaByKelas[s.kelas_id] = []
    siswaByKelas[s.kelas_id].push(s)
  }

  return rows.map((k: any) => {
    const siswaDiKelas = siswaByKelas[k.id] ?? []
    const siswa: SiswaAbsensiRow[] = siswaDiKelas.map((s: any, i: number) => ({
      urut: i + 1,
      nis: s.nis_lokal ?? '-',
      nisn: s.nisn ?? '-',
      nama_lengkap: s.nama_lengkap,
      jenis_kelamin: s.jenis_kelamin,
    }))
    return {
      kelas: {
        id: k.id,
        tingkat: k.tingkat,
        nomor_kelas: k.nomor_kelas,
        kelompok: k.kelompok,
        wali_kelas_nama: k.wali_kelas_nama ?? 'Belum Ditentukan',
      },
      tahun_ajaran: taAktif ?? null,
      siswa,
      jumlah_l: siswa.filter(s => s.jenis_kelamin === 'L').length,
      jumlah_p: siswa.filter(s => s.jenis_kelamin === 'P').length,
    }
  })
}