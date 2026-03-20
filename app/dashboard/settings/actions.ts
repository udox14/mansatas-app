// Lokasi: app/dashboard/settings/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { revalidatePath } from 'next/cache'

// ============================================================
// TAMBAH TAHUN AJARAN
// ============================================================
export async function tambahTahunAjaran(prevState: any, formData: FormData) {
  const db = await getDB()

  const rawJurusan = formData.get('daftar_jurusan') as string
  let daftar_jurusan = ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

  if (rawJurusan) {
    try {
      daftar_jurusan = JSON.parse(rawJurusan)
    } catch {
      console.error('Gagal parse daftar jurusan')
    }
  }

  if (!daftar_jurusan.includes('UMUM')) daftar_jurusan.push('UMUM')

  const payload = {
    nama: formData.get('nama') as string,
    semester: parseInt(formData.get('semester') as string),
    is_active: 0,
    daftar_jurusan: JSON.stringify(daftar_jurusan),
  }

  const result = await dbInsert(db, 'tahun_ajaran', payload)
  if (result.error) return { error: result.error, success: null }

  revalidatePath('/dashboard/settings')
  return { error: null, success: 'Tahun Ajaran & Daftar Jurusan berhasil ditambahkan' }
}

// ============================================================
// SET AKTIF TAHUN AJARAN
// ============================================================
export async function setAktifTahunAjaran(id: string) {
  const db = await getDB()

  try {
    await db.batch([
      db.prepare('UPDATE tahun_ajaran SET is_active = 0'),
      db.prepare('UPDATE tahun_ajaran SET is_active = 1 WHERE id = ?').bind(id),
    ])
  } catch (e: any) {
    return { error: e.message }
  }

  revalidatePath('/', 'layout')
  return { success: 'Tahun Ajaran berhasil diaktifkan!' }
}

// ============================================================
// HAPUS TAHUN AJARAN
// ============================================================
export async function hapusTahunAjaran(id: string, isActive: boolean) {
  if (isActive) {
    return {
      error: 'Tidak bisa menghapus Tahun Ajaran yang sedang aktif. Aktifkan tahun ajaran lain terlebih dahulu.',
    }
  }

  const db = await getDB()
  const result = await dbDelete(db, 'tahun_ajaran', { id })
  if (result.error) return { error: 'Gagal menghapus: ' + result.error }

  revalidatePath('/dashboard/settings')
  return { success: 'Tahun Ajaran berhasil dihapus.' }
}

// ============================================================
// SIMPAN DAFTAR JURUSAN
// ============================================================
export async function simpanDaftarJurusan(tahun_ajaran_id: string, daftar_jurusan: string[]) {
  const db = await getDB()

  if (!daftar_jurusan.includes('UMUM')) daftar_jurusan.push('UMUM')

  const result = await dbUpdate(
    db,
    'tahun_ajaran',
    { daftar_jurusan: JSON.stringify(daftar_jurusan) },
    { id: tahun_ajaran_id }
  )

  if (result.error) return { error: result.error }

  revalidatePath('/', 'layout')
  return { success: 'Daftar Master Jurusan berhasil diperbarui!' }
}
