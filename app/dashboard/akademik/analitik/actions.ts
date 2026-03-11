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

  // FIX: Bersihkan spasi gaib dari NISN di dalam database agar pasti match
  const nisnMap = new Map<string, string>(
    dbSiswa.results.map((s: any) => [s.nisn ? String(s.nisn).trim() : '', s.id])
  )

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
      errorLogs.push(`Baris Excel ke-${i + 2}: Dilewati (Tidak terdeteksi kolom NISN untuk ${namaSiswa}).`)
      continue
    }

    const siswa_id = nisnMap.get(nisn)
    if (!siswa_id) {
      errorLogs.push(
        `Baris Excel ke-${i + 2}: Siswa "${namaSiswa}" (NISN: ${nisn}) tidak ditemukan di database Madrasah.`
      )
      continue
    }

    const nilaiMapel: Record<string, number> = {}
    const blacklist = ['NO', 'NIS', 'NISN', 'NAMA', 'JK', 'L/P', 'JUMLAH', 'RATA', 'RATA-RATA', 'KELAS']

    Object.keys(row).forEach(kolomExcel => {
      if (blacklist.includes(kolomExcel.toUpperCase().trim())) return

      const cellValue = row[kolomExcel]
      // FIX: Jangan anggap sel kosong sebagai angka 0, lewati saja
      if (cellValue === null || cellValue === undefined || cellValue === '') return

      const namaStandar = kamusMapel.get(kolomExcel.toLowerCase().trim()) || kolomExcel.trim()
      
      // FIX: Replace koma (,) menjadi titik (.) agar bisa diparse Javascript
      const strVal = String(cellValue).trim().replace(',', '.')
      const nilaiAngka = Number(strVal)
      
      if (!isNaN(nilaiAngka)) {
        nilaiMapel[namaStandar] = nilaiAngka
      }
    })

    // FIX: Cegah penyimpanan Objek Kosong "{}" jika semua kolom gagal dibaca
    if (Object.keys(nilaiMapel).length === 0) {
      errorLogs.push(`Baris Excel ke-${i + 2}: Siswa "${namaSiswa}" dilewati karena tidak mendeteksi format angka nilai yang valid.`)
      continue
    }

    toUpsert.push({
      siswa_id,
      [targetKolom]: JSON.stringify(nilaiMapel),
      updated_at: new Date().toISOString(),
    })
  }

  if (toUpsert.length > 0) {
    // FIX: Tambahkan explicit ID generate dan Backtick SQLite (`) pada column
    const stmts = toUpsert.map(row =>
      db
        .prepare(
          `INSERT INTO rekap_nilai_akademik (id, siswa_id, \`${targetKolom}\`, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(siswa_id) DO UPDATE SET \`${targetKolom}\` = excluded.\`${targetKolom}\`, updated_at = excluded.updated_at`
        )
        .bind(crypto.randomUUID(), row.siswa_id, row[targetKolom], row.updated_at)
    )

    try {
      const chunkSize = 100
      for (let i = 0; i < stmts.length; i += chunkSize) {
        await db.batch(stmts.slice(i, i + chunkSize))
      }
    } catch (e: any) {
      return { error: `Terjadi kendala pada database: ${e.message}` }
    }
  }

  revalidatePath('/dashboard/akademik/analitik')
  
  let successMsg = `Selesai! Berhasil memploting nilai RDM untuk ${toUpsert.length} Siswa.`
  if (errorLogs.length > 0) {
      successMsg += ` Terdapat ${errorLogs.length} notifikasi baris yang dilewati (lihat log).`
  }

  return {
    success: successMsg,
    logs: errorLogs,
  }
}