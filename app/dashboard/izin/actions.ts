// Lokasi: app/dashboard/izin/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { nowWIBISO, todayWIB } from '@/lib/time'

// ============================================================
// SEARCH SISWA (lazy — dipanggil saat user mengetik, LIMIT 20)
// ============================================================
export async function searchSiswaIzin(query: string) {
  if (!query || query.trim().length < 2) return []

  const db = await getDB()
  const q = `%${query.trim()}%`

  const result = await db
    .prepare(
      `SELECT s.id, s.nama_lengkap, s.nisn, k.tingkat, k.nomor_kelas
       FROM siswa s
       LEFT JOIN kelas k ON s.kelas_id = k.id
       WHERE s.status = 'aktif' AND (s.nama_lengkap LIKE ? OR s.nisn LIKE ?)
       ORDER BY s.nama_lengkap ASC
       LIMIT 20`
    )
    .bind(q, q)
    .all<any>()

  return (result.results ?? []).map((s: any) => ({
    id: s.id,
    nama_lengkap: s.nama_lengkap,
    nisn: s.nisn,
    kelas: s.tingkat ? { tingkat: s.tingkat, nomor_kelas: s.nomor_kelas } : null,
  }))
}

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
      waktu_kembali: nowWIBISO(),
      status: 'SUDAH KEMBALI',
      updated_at: nowWIBISO(),
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
// ============================================================
export async function tambahIzinTidakMasuk(prevState: any, formData: FormData) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', success: null }

  const siswa_id = formData.get('siswa_id') as string
  const tanggal = formData.get('tanggal') as string
  const jam_pelajaran = formData.get('jam_pelajaran') as string
  const alasan = formData.get('alasan') as string
  const keterangan = formData.get('keterangan') as string

  if (!siswa_id || !alasan) return { error: 'Siswa dan alasan wajib diisi!', success: null }

  const result = await dbInsert(db, 'izin_tidak_masuk_kelas', {
    siswa_id,
    tanggal: tanggal || todayWIB(),
    jam_pelajaran: jam_pelajaran || null,
    alasan,
    keterangan: keterangan || null,
    diinput_oleh: user.id,
  })

  if (result.error) return { error: result.error, success: null }

  revalidatePath('/dashboard/izin')
  return { error: null, success: 'Izin tidak masuk kelas berhasil dicatat!' }
}

export async function hapusIzinTidakMasuk(id: string) {
  const db = await getDB()
  const result = await dbDelete(db, 'izin_tidak_masuk_kelas', { id })
  if (result.error) return { error: result.error }
  revalidatePath('/dashboard/izin')
  return { success: 'Data izin berhasil dihapus.' }
}

// ============================================================
// IZIN TIDAK MASUK KELAS — fungsi tambah & hapus
// (fungsi ini dipakai oleh izin-client.tsx yang sudah ada)
// ============================================================
export async function tambahIzinKelas(prevState: any, formData: FormData) {
  const db = await getDB()
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', success: null }

  const siswa_id = formData.get('siswa_id') as string
  const alasan = formData.get('alasan') as string
  const keterangan = formData.get('keterangan') as string
  const jamRaw = formData.getAll('jam_pelajaran')
  const jam_pelajaran = jamRaw.map(j => parseInt(j as string)).sort((a, b) => a - b)

  if (!siswa_id) return { error: 'Siswa wajib dipilih!', success: null }
  if (jam_pelajaran.length === 0) return { error: 'Pilih minimal 1 jam pelajaran!', success: null }
  if (!alasan) return { error: 'Alasan wajib dipilih!', success: null }

  const result = await dbInsert(db, 'izin_tidak_masuk_kelas', {
    siswa_id,
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
