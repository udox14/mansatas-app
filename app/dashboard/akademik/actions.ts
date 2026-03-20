// Lokasi: app/dashboard/akademik/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
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
    .map((row) => ({
      nama_mapel: String(row.NAMA_MAPEL).trim(),
      kode_mapel: row.KODE_RDM ? String(row.KODE_RDM).trim() : null,
      kelompok: String(row.KELOMPOK || 'UMUM').trim(),
      tingkat: String(row.TINGKAT || 'Semua').trim(),
      kategori: String(row.KATEGORI || 'Umum').trim(),
    }))
    .filter((item) => item.nama_mapel && item.nama_mapel !== 'undefined')

  if (toInsert.length === 0) return { error: 'Tidak ada data valid untuk diimport.' }

  const { successCount, error } = await (await import('@/utils/db')).dbBatchInsert(
    db,
    'mata_pelajaran',
    toInsert
  )

  if (error) return { error }

  revalidatePath('/dashboard/akademik')
  return { success: `Berhasil mengimport ${successCount} mata pelajaran.` }
}

// ============================================================
// 2. PENUGASAN MENGAJAR ACTIONS
// ============================================================
export async function tambahPenugasan(prevState: any, formData: FormData) {
  const db = await getDB()

  const ta = await db
    .prepare('SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
    .first<any>()
  if (!ta) return { error: 'Tahun Ajaran aktif belum diatur.' }

  const payload = {
    guru_id: formData.get('guru_id') as string,
    mapel_id: formData.get('mapel_id') as string,
    kelas_id: formData.get('kelas_id') as string,
    tahun_ajaran_id: ta.id,
  }

  if (!payload.guru_id || !payload.mapel_id || !payload.kelas_id) {
    return { error: 'Semua field wajib diisi.' }
  }

  const result = await dbInsert(db, 'penugasan_mengajar', payload)
  if (result.error) {
    return {
      error: result.error.includes('UNIQUE')
        ? 'Penugasan ini sudah ada untuk tahun ajaran yang sama.'
        : result.error,
    }
  }

  revalidatePath('/dashboard/akademik')
  return { success: 'Penugasan berhasil ditambahkan.' }
}

export async function hapusPenugasan(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'penugasan_mengajar', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/akademik')
  return { success: 'Penugasan berhasil dihapus.' }
}
