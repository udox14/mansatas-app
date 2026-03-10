// Lokasi: app/dashboard/akademik/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete, dbBatchInsert } from '@/utils/db'
import { revalidatePath } from 'next/cache'

// ============================================================
// 1. MAPEL ACTIONS
// ============================================================
export async function tambahMapel(prevState: any, formData: FormData) {
  const db = await getDB()
  const payload = {
    nama_mapel: formData.get('nama_mapel') as string,
    kode_mapel: (formData.get('kode_mapel') as string) || null,
    kelompok: formData.get('kelompok') as string,
    tingkat: formData.get('tingkat') as string,
    kategori: formData.get('kategori') as string,
  }

  const result = await dbInsert(db, 'mata_pelajaran', payload)
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/akademik')
  return { success: 'Mata pelajaran berhasil ditambahkan' }
}

export async function editMapel(prevState: any, formData: FormData) {
  const db = await getDB()
  const id = formData.get('id') as string
  const payload = {
    nama_mapel: formData.get('nama_mapel') as string,
    kode_mapel: (formData.get('kode_mapel') as string) || null,
    kelompok: formData.get('kelompok') as string,
    tingkat: formData.get('tingkat') as string,
    kategori: formData.get('kategori') as string,
  }

  const result = await dbUpdate(db, 'mata_pelajaran', payload, { id })
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/akademik')
  return { success: 'Mata pelajaran berhasil diperbarui' }
}

export async function hapusMapel(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'mata_pelajaran', { id })
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/akademik')
  return { success: 'Mata pelajaran berhasil dihapus' }
}

export async function importMapelMassal(dataExcel: any[]) {
  const db = await getDB()
  const toInsert = dataExcel
    .map(row => ({
      nama_mapel: String(row.NAMA_MAPEL).trim(),
      kode_mapel: row.KODE_RDM ? String(row.KODE_RDM).trim() : null,
      kelompok: String(row.KELOMPOK || 'UMUM').trim(),
      tingkat: String(row.TINGKAT || 'Semua').trim(),
      kategori: String(row.KATEGORI || 'Umum').trim(),
    }))
    .filter(item => item.nama_mapel && item.nama_mapel !== 'undefined')

  if (toInsert.length === 0) return { error: 'Data Excel kosong atau format tidak sesuai.' }

  const { error } = await dbBatchInsert(db, 'mata_pelajaran', toInsert)
  if (error) return { error }

  revalidatePath('/dashboard/akademik')
  return { success: `Berhasil mengimport ${toInsert.length} data mata pelajaran.` }
}

// ============================================================
// 2. PENUGASAN MENGAJAR
// ============================================================
export async function hapusPenugasan(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'penugasan_mengajar', { id })
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/akademik')
  return { success: 'Penugasan mengajar berhasil dihapus' }
}

// Reset semua penugasan di semester aktif
export async function resetPenugasanSemesterIni(tahun_ajaran_id: string) {
  const db = await getDB()
  try {
    await db.prepare('DELETE FROM penugasan_mengajar WHERE tahun_ajaran_id = ?')
      .bind(tahun_ajaran_id).run()
    revalidatePath('/dashboard/akademik')
    return { success: 'Semua penugasan semester ini berhasil dihapus.' }
  } catch (e: any) {
    return { error: e.message }
  }
}

// Import penugasan dari file ASC (format: NAMA_GURU, NAMA_KELAS, NAMA_MAPEL)
export async function importPenugasanASC(dataExcel: any[]) {
  const db = await getDB()
  const errorLogs: string[] = []
  let successCount = 0

  // Ambil tahun ajaran aktif
  const ta = await db.prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1').first<{ id: string }>()
  if (!ta) return { error: 'Tahun Ajaran aktif belum diatur.', success: null, logs: [] }

  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]
    const namaGuru = String(row.NAMA_GURU || '').trim()
    const namaKelas = String(row.NAMA_KELAS || '').trim()
    const namaMapel = String(row.NAMA_MAPEL || '').trim()

    if (!namaGuru || !namaKelas || !namaMapel) continue

    try {
      // Cari guru (fuzzy match nama)
      const guru = await db.prepare(
        'SELECT id FROM "user" WHERE LOWER(nama_lengkap) LIKE LOWER(?) LIMIT 1'
      ).bind(`%${namaGuru}%`).first<{ id: string }>()

      if (!guru) {
        errorLogs.push(`Baris ${i + 2}: Guru "${namaGuru}" tidak ditemukan.`)
        continue
      }

      // Cari mapel (fuzzy match)
      const mapel = await db.prepare(
        'SELECT id FROM mata_pelajaran WHERE LOWER(nama_mapel) LIKE LOWER(?) LIMIT 1'
      ).bind(`%${namaMapel}%`).first<{ id: string }>()

      if (!mapel) {
        errorLogs.push(`Baris ${i + 2}: Mapel "${namaMapel}" tidak ditemukan.`)
        continue
      }

      // Parse NAMA_KELAS: format "12-1", "12-1 MIPA", "11-2 IPS", dll
      const kelasParts = namaKelas.split(/[-\s]+/)
      const tingkat = parseInt(kelasParts[0]) || 0
      const nomor_kelas = parseInt(kelasParts[1]) || 0
      const kelompokRaw = kelasParts[2] || 'UMUM'
      const kelompok = ['MIPA', 'IPS', 'BAHASA', 'AGAMA'].includes(kelompokRaw.toUpperCase())
        ? kelompokRaw.toUpperCase()
        : 'UMUM'

      if (!tingkat || !nomor_kelas) {
        errorLogs.push(`Baris ${i + 2}: Format kelas "${namaKelas}" tidak valid.`)
        continue
      }

      const kelas = await db.prepare(
        'SELECT id FROM kelas WHERE tingkat = ? AND nomor_kelas = ? AND kelompok = ? LIMIT 1'
      ).bind(tingkat, nomor_kelas, kelompok).first<{ id: string }>()

      if (!kelas) {
        errorLogs.push(`Baris ${i + 2}: Kelas "${namaKelas}" tidak ditemukan di database.`)
        continue
      }

      // Insert — abaikan duplikat
      await db.prepare(`
        INSERT OR IGNORE INTO penugasan_mengajar (guru_id, mapel_id, kelas_id, tahun_ajaran_id)
        VALUES (?, ?, ?, ?)
      `).bind(guru.id, mapel.id, kelas.id, ta.id).run()

      successCount++
    } catch (e: any) {
      errorLogs.push(`Baris ${i + 2} ("${namaGuru}"): ${e.message}`)
    }
  }

  revalidatePath('/dashboard/akademik')
  return {
    success: `Berhasil mengimport ${successCount} dari ${dataExcel.length} penugasan.`,
    error: successCount === 0 && dataExcel.length > 0 ? 'Tidak ada data yang berhasil diimport.' : null,
    logs: errorLogs,
  }
}