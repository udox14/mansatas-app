// Lokasi: app/dashboard/settings/actions.ts
'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { revalidatePath } from 'next/cache'

// ============================================================
// TYPES
// ============================================================
export type SlotJam = {
  id: number       // nomor jam pelajaran (1, 2, 3, ...)
  nama: string     // "Jam 1", "Jam 2", dst
  mulai: string    // "08:00"
  selesai: string  // "08:40"
}

export type PolaJam = {
  id: string       // "pola1", "pola2", dst
  nama: string     // "Senin", "Selasa-Rabu", dll — label bebas
  hari: number[]   // [1], [2,3], [5], [4,6] — 1=Senin..6=Sabtu
  slots: SlotJam[]
}

// Default 4 pola MAN 1 Tasikmalaya
export const DEFAULT_POLA_JAM: PolaJam[] = [
  {
    id: 'pola1',
    nama: 'Senin',
    hari: [1],
    slots: [
      { id: 1, nama: 'Jam 1', mulai: '08:00', selesai: '08:40' },
      { id: 2, nama: 'Jam 2', mulai: '08:40', selesai: '09:20' },
      { id: 3, nama: 'Jam 3', mulai: '09:20', selesai: '10:00' },
      { id: 4, nama: 'Jam 4', mulai: '10:15', selesai: '10:50' },
      { id: 5, nama: 'Jam 5', mulai: '10:50', selesai: '11:25' },
      { id: 6, nama: 'Jam 6', mulai: '11:25', selesai: '12:00' },
      { id: 7, nama: 'Jam 7', mulai: '12:30', selesai: '13:05' },
      { id: 8, nama: 'Jam 8', mulai: '13:05', selesai: '13:40' },
    ],
  },
  {
    id: 'pola2',
    nama: 'Selasa & Rabu',
    hari: [2, 3],
    slots: [
      { id: 1,  nama: 'Jam 1',  mulai: '07:15', selesai: '07:50' },
      { id: 2,  nama: 'Jam 2',  mulai: '07:50', selesai: '08:25' },
      { id: 3,  nama: 'Jam 3',  mulai: '08:25', selesai: '09:00' },
      { id: 4,  nama: 'Jam 4',  mulai: '09:00', selesai: '09:35' },
      { id: 5,  nama: 'Jam 5',  mulai: '09:50', selesai: '10:25' },
      { id: 6,  nama: 'Jam 6',  mulai: '10:25', selesai: '11:00' },
      { id: 7,  nama: 'Jam 7',  mulai: '11:00', selesai: '11:35' },
      { id: 8,  nama: 'Jam 8',  mulai: '11:35', selesai: '12:05' },
      { id: 9,  nama: 'Jam 9',  mulai: '12:35', selesai: '13:10' },
      { id: 10, nama: 'Jam 10', mulai: '13:10', selesai: '13:45' },
    ],
  },
  {
    id: 'pola3',
    nama: 'Jumat',
    hari: [5],
    slots: [
      { id: 1, nama: 'Jam 1', mulai: '07:20', selesai: '07:50' },
      { id: 2, nama: 'Jam 2', mulai: '07:50', selesai: '08:20' },
      { id: 3, nama: 'Jam 3', mulai: '08:20', selesai: '08:50' },
      { id: 4, nama: 'Jam 4', mulai: '08:50', selesai: '09:20' },
      { id: 5, nama: 'Jam 5', mulai: '09:20', selesai: '09:50' },
      { id: 6, nama: 'Jam 6', mulai: '09:50', selesai: '10:20' },
    ],
  },
  {
    id: 'pola4',
    nama: 'Kamis & Sabtu',
    hari: [4, 6],
    slots: [
      { id: 1, nama: 'Jam 1', mulai: '07:20', selesai: '07:55' },
      { id: 2, nama: 'Jam 2', mulai: '07:55', selesai: '08:30' },
      { id: 3, nama: 'Jam 3', mulai: '08:30', selesai: '09:05' },
      { id: 4, nama: 'Jam 4', mulai: '09:05', selesai: '09:40' },
      { id: 5, nama: 'Jam 5', mulai: '09:55', selesai: '10:30' },
      { id: 6, nama: 'Jam 6', mulai: '10:30', selesai: '11:05' },
      { id: 7, nama: 'Jam 7', mulai: '11:05', selesai: '11:40' },
      { id: 8, nama: 'Jam 8', mulai: '11:40', selesai: '12:15' },
    ],
  },
]

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

// Helper: cari slot jam untuk hari tertentu
export function getSlotForHari(polaDaftar: PolaJam[], hari: number): SlotJam[] {
  const pola = polaDaftar.find(p => p.hari.includes(hari))
  return pola?.slots ?? []
}
