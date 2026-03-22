// Lokasi: app/dashboard/settings/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { revalidatePath } from 'next/cache'
import type { SlotJam, PolaJam } from './types'
export type { SlotJam, PolaJam }

// ============================================================
// TAMBAH TAHUN AJARAN
// ============================================================
export async function tambahTahunAjaran(prevState: any, formData: FormData) {
  const db = await getDB()

  const rawJurusan = formData.get('daftar_jurusan') as string
  let daftar_jurusan = ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']
  if (rawJurusan) {
    try { daftar_jurusan = JSON.parse(rawJurusan) } catch {}
  }
  if (!daftar_jurusan.includes('UMUM')) daftar_jurusan.push('UMUM')

  const rawJam = formData.get('jam_pelajaran') as string
  let jam_pelajaran: PolaJam[] = []
  if (rawJam) {
    try { jam_pelajaran = JSON.parse(rawJam) } catch {}
  }

  const payload = {
    nama: formData.get('nama') as string,
    semester: parseInt(formData.get('semester') as string),
    is_active: 0,
    daftar_jurusan: JSON.stringify(daftar_jurusan),
    jam_pelajaran: JSON.stringify(jam_pelajaran),
  }

  const result = await dbInsert(db, 'tahun_ajaran', payload)
  if (result.error) return { error: result.error, success: null }

  revalidatePath('/dashboard/settings')
  return { error: null, success: 'Tahun Ajaran berhasil ditambahkan' }
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
    return { error: 'Tidak bisa menghapus Tahun Ajaran yang sedang aktif. Aktifkan tahun ajaran lain terlebih dahulu.' }
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
  const result = await dbUpdate(db, 'tahun_ajaran', { daftar_jurusan: JSON.stringify(daftar_jurusan) }, { id: tahun_ajaran_id })
  if (result.error) return { error: result.error }
  revalidatePath('/', 'layout')
  return { success: 'Daftar Master Jurusan berhasil diperbarui!' }
}

// ============================================================
// SIMPAN JAM PELAJARAN (pola per hari)
// ============================================================
export async function simpanJamPelajaran(tahun_ajaran_id: string, pola_jam: PolaJam[]) {
  const db = await getDB()

  if (pola_jam.length === 0) return { error: 'Minimal harus ada 1 pola jam.' }

  // Validasi: setiap hari (1-6) harus di-cover tepat 1 pola
  const hariCovered = pola_jam.flatMap(p => p.hari)
  const duplikat = hariCovered.filter((h, i) => hariCovered.indexOf(h) !== i)
  if (duplikat.length > 0) {
    const HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
    return { error: `Hari duplikat: ${duplikat.map(h => HARI[h]).join(', ')}. Satu hari hanya boleh masuk satu pola.` }
  }

  for (const p of pola_jam) {
    if (!p.nama.trim()) return { error: 'Nama pola tidak boleh kosong.' }
    if (p.hari.length === 0) return { error: `Pola "${p.nama}" belum di-assign ke hari manapun.` }
    if (p.slots.length === 0) return { error: `Pola "${p.nama}" belum memiliki jam pelajaran.` }
    for (const s of p.slots) {
      if (!s.mulai || !s.selesai) return { error: `Pola "${p.nama}" Jam ${s.id}: waktu mulai/selesai wajib diisi.` }
    }
  }

  const result = await dbUpdate(db, 'tahun_ajaran', { jam_pelajaran: JSON.stringify(pola_jam) }, { id: tahun_ajaran_id })
  if (result.error) return { error: result.error }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/akademik')
  return { success: 'Jam pelajaran berhasil disimpan!' }
}

// ============================================================
// GET JAM PELAJARAN (helper untuk modul lain)
// ============================================================
export async function getPolaJamByTA(tahun_ajaran_id: string): Promise<PolaJam[]> {
  const db = await getDB()
  const row = await db.prepare('SELECT jam_pelajaran FROM tahun_ajaran WHERE id = ?').bind(tahun_ajaran_id).first<any>()
  if (!row?.jam_pelajaran) return []
  try { return JSON.parse(row.jam_pelajaran) } catch { return [] }
}


