// Lokasi: app/dashboard/akademik/analitik/actions.ts
'use server'

import { getDB, dbUpdate, parseJsonCol } from '@/utils/db'
import { revalidatePath } from 'next/cache'

// ============================================================
// 1. PENGATURAN AKADEMIK (row singleton 'global')
// ============================================================
export async function getPengaturanAkademik() {
  const db = await getDB()
  const row = await db
    .prepare('SELECT * FROM pengaturan_akademik WHERE id = ?')
    .bind('global')
    .first<any>()

  if (!row) return null

  // Parse JSON columns
  return {
    ...row,
    mapel_snbp: parseJsonCol<string[]>(row.mapel_snbp, []),
    mapel_span: parseJsonCol<string[]>(row.mapel_span, []),
    daftar_jurusan: parseJsonCol<string[]>(row.daftar_jurusan, ['MIPA','SOSHUM','KEAGAMAAN','UMUM']),
  }
}

export async function simpanPengaturanAkademik(payload: any) {
  const db = await getDB()
  const result = await dbUpdate(
    db,
    'pengaturan_akademik',
    {
      mapel_snbp: JSON.stringify(payload.mapel_snbp),
      mapel_span: JSON.stringify(payload.mapel_span),
      bobot_rapor: payload.bobot_rapor,
      bobot_um: payload.bobot_um,
      updated_at: new Date().toISOString(),
    },
    { id: 'global' }
  )

  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/akademik/analitik')
  return { success: 'Pengaturan rumus dan mata pelajaran berhasil disimpan!' }
}

// ============================================================
// 2. IMPORT NILAI DARI EXCEL
// ============================================================
export async function importNilaiDariExcel(dataExcel: any[], targetKolom: string) {
  const db = await getDB()

  const dbSiswa = await db.prepare('SELECT id, nisn, nama_lengkap FROM siswa').all<any>()
  if (!dbSiswa.results.length) return { error: 'Gagal memuat database siswa' }

  const dbMapel = await db
    .prepare('SELECT nama_mapel, kode_mapel FROM mata_pelajaran')
    .all<any>()
  const kamusMapel = new Map<string, string>()
  dbMapel.results.forEach((m: any) => {
    kamusMapel.set(m.nama_mapel.toLowerCase().trim(), m.nama_mapel)
    if (m.kode_mapel) kamusMapel.set(m.kode_mapel.toLowerCase().trim(), m.nama_mapel)
  })

  const nisnMap = new Map<string, string>(dbSiswa.results.map((s: any) => [s.nisn, s.id]))

  const toUpsert: any[] = []
  const errorLogs: string[] = []

  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]

    const nisnKey = Object.keys(row).find(k => k.toUpperCase().trim() === 'NISN')
    const nisn = nisnKey ? String(row[nisnKey]).trim() : ''

    const namaKey = Object.keys(row).find(k => {
      const u = k.toUpperCase().trim()
      return u === 'NAMA' || u === 'NAMA LENGKAP' || u === 'NAMA_LENGKAP'
    })
    const namaSiswa = namaKey ? String(row[namaKey]).trim() : 'Nama Tidak Tersedia'

    if (!nisn) {
      errorLogs.push(`Baris Excel ke-${i + 1}: Dilewati (Tidak terdeteksi NISN untuk ${namaSiswa}).`)
      continue
    }

    const siswa_id = nisnMap.get(nisn)
    if (!siswa_id) {
      errorLogs.push(
        `Siswa "${namaSiswa}" (NISN: ${nisn}) tidak ditemukan di database Madrasah.`
      )
      continue
    }

    const nilaiMapel: any = {}
    const blacklist = ['NO', 'NIS', 'NISN', 'NAMA', 'JK', 'L/P', 'JUMLAH', 'RATA', 'RATA-RATA', 'KELAS']

    Object.keys(row).forEach(kolomExcel => {
      if (blacklist.includes(kolomExcel.toUpperCase().trim())) return
      const namaStandar = kamusMapel.get(kolomExcel.toLowerCase().trim()) || kolomExcel.trim()
      const nilaiAngka = Number(row[kolomExcel])
      if (!isNaN(nilaiAngka)) nilaiMapel[namaStandar] = nilaiAngka
    })

    toUpsert.push({
      siswa_id,
      [targetKolom]: JSON.stringify(nilaiMapel),
      updated_at: new Date().toISOString(),
    })
  }

  if (toUpsert.length > 0) {
    // Upsert per siswa_id (UNIQUE constraint)
    const stmts = toUpsert.map(row =>
      db
        .prepare(
          `INSERT INTO rekap_nilai_akademik (siswa_id, ${targetKolom}, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(siswa_id) DO UPDATE SET ${targetKolom} = excluded.${targetKolom}, updated_at = excluded.updated_at`
        )
        .bind(row.siswa_id, row[targetKolom], row.updated_at)
    )

    try {
      const chunkSize = 100
      for (let i = 0; i < stmts.length; i += chunkSize) {
        await db.batch(stmts.slice(i, i + chunkSize))
      }
    } catch (e: any) {
      return { error: e.message }
    }
  }

  revalidatePath('/dashboard/akademik/analitik')
  return {
    success: `Selesai! Berhasil memploting nilai RDM untuk ${toUpsert.length} Siswa.`,
    logs: errorLogs,
  }
}
