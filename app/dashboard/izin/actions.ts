// Lokasi: app/dashboard/izin/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'

// ============================================================
// 1. IZIN KELUAR KOMPLEK
// ============================================================
export async function tambahIzinKeluar(prevState: any, formData: FormData) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', success: null }

  const siswa_id = formData.get('siswa_id') as string
  const keterangan = formData.get('keterangan') as string

  if (!siswa_id) return { error: 'Siswa wajib dipilih!', success: null }

  const result = await dbInsert(db, 'izin_keluar_komplek', {
    siswa_id,
    keterangan,
    diinput_oleh: user.id,
  })

  if (result.error) return { error: result.error, success: null }

  revalidatePath('/dashboard/izin')
  return { error: null, success: 'Berhasil mencatat izin keluar komplek!' }
}

export async function tandaiSudahKembali(id: string) {
  const db = await getDB()
  const result = await dbUpdate(
    db,
    'izin_keluar_komplek',
    {
      waktu_kembali: new Date().toISOString(),
      status: 'SUDAH KEMBALI',
      updated_at: new Date().toISOString(),
    },
    { id }
  )

  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/izin')
  return { success: 'Status siswa diperbarui menjadi SUDAH KEMBALI.' }
}

export async function hapusIzinKeluar(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'izin_keluar_komplek', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/izin')
  return { success: 'Riwayat izin berhasil dihapus.' }
}

// ============================================================
// 2. IZIN TIDAK MASUK KELAS
// Catatan: kolom jam_pelajaran disimpan sebagai JSON string di D1
// karena SQLite tidak support native ARRAY.
// Contoh: "[1,2,3]" bukan PostgreSQL ARRAY {1,2,3}
// ============================================================
export async function tambahIzinKelas(prevState: any, formData: FormData) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', success: null }

  const siswa_id = formData.get('siswa_id') as string
  const alasan = formData.get('alasan') as string
  const keterangan = formData.get('keterangan') as string

  const jamRaw = formData.getAll('jam_pelajaran')
  const jam_pelajaran = jamRaw
    .map(j => parseInt(j as string))
    .sort((a, b) => a - b)

  if (!siswa_id) return { error: 'Siswa wajib dipilih!', success: null }
  if (jam_pelajaran.length === 0) return { error: 'Pilih minimal 1 jam pelajaran!', success: null }
  if (!alasan) return { error: 'Alasan wajib dipilih!', success: null }

  const result = await dbInsert(db, 'izin_tidak_masuk_kelas', {
    siswa_id,
    // Simpan sebagai JSON string — parse di client side saat ditampilkan
    jam_pelajaran: JSON.stringify(jam_pelajaran),
    alasan,
    keterangan,
    diinput_oleh: user.id,
  })

  if (result.error) return { error: result.error, success: null }

  revalidatePath('/dashboard/izin')
  return { error: null, success: 'Berhasil mencatat izin tidak masuk kelas!' }
}

export async function hapusIzinKelas(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'izin_tidak_masuk_kelas', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/izin')
  return { success: 'Riwayat izin kelas berhasil dihapus.' }
}
