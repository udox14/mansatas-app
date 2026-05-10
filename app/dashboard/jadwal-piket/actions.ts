'use server'

import { getDB, dbInsert, dbUpdate, dbDelete } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { revalidatePath } from 'next/cache'
import { checkFeatureAccess } from '@/lib/features'

export type ShiftPiket = {
  id: number
  nama_shift: string
  jam_mulai: number
  jam_selesai: number
}

export type JadwalPiket = {
  id: string
  user_id: string
  hari: number
  shift_id: number
  nama_lengkap: string
}

const DEFAULT_SHIFTS: ShiftPiket[] = [
  { id: 1, nama_shift: 'Shift 1', jam_mulai: 1, jam_selesai: 5 },
  { id: 2, nama_shift: 'Shift 2', jam_mulai: 6, jam_selesai: 99 },
]

async function ensureDefaultShiftPiket(db: D1Database) {
  for (const shift of DEFAULT_SHIFTS) {
    await db.prepare(`
      INSERT OR IGNORE INTO pengaturan_shift_piket (id, nama_shift, jam_mulai, jam_selesai)
      VALUES (?, ?, ?, ?)
    `).bind(shift.id, shift.nama_shift, shift.jam_mulai, shift.jam_selesai).run()
  }
}

export async function getJadwalPiketData(): Promise<{
  shifts: ShiftPiket[]
  jadwal: JadwalPiket[]
}> {
  const db = await getDB()
  await ensureDefaultShiftPiket(db)
  
  const shiftsRes = await db.prepare('SELECT * FROM pengaturan_shift_piket ORDER BY id ASC').all<ShiftPiket>()
  
  const jadwalRes = await db.prepare(`
    SELECT j.*, u.nama_lengkap
    FROM jadwal_guru_piket j
    JOIN "user" u ON j.user_id = u.id
    ORDER BY j.hari ASC, j.shift_id ASC, u.nama_lengkap ASC
  `).all<JadwalPiket>()

  return {
    shifts: shiftsRes.results || [],
    jadwal: jadwalRes.results || []
  }
}

export async function getDaftarGuruDropdown(): Promise<Array<{ id: string; nama: string }>> {
  const db = await getDB()
  const res = await db.prepare(
    `SELECT id, nama_lengkap FROM "user" WHERE banned = 0 ORDER BY nama_lengkap ASC`
  ).all<any>()
  return (res.results || []).map(u => ({ id: u.id, nama: u.nama_lengkap || 'Tanpa Nama' }))
}

export async function tambahJadwalPiket(user_id: string, hari: number, shift_id: number): Promise<{ error?: string, success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const db = await getDB()
  if (!(await checkFeatureAccess(db, user.id, 'jadwal-piket'))) {
    return { error: 'Tidak memiliki akses' }
  }

  await ensureDefaultShiftPiket(db)

  if (!user_id) return { error: 'Guru wajib dipilih.' }
  if (!Number.isInteger(hari) || hari < 1 || hari > 7) return { error: 'Hari piket tidak valid.' }
  if (!Number.isInteger(shift_id) || shift_id < 1) return { error: 'Shift piket tidak valid.' }

  const [guruExists, shiftExists] = await Promise.all([
    db.prepare('SELECT id FROM "user" WHERE id = ?').bind(user_id).first<{ id: string }>(),
    db.prepare('SELECT id FROM pengaturan_shift_piket WHERE id = ?').bind(shift_id).first<{ id: number }>(),
  ])

  if (!guruExists) return { error: 'Guru yang dipilih tidak ditemukan. Coba muat ulang halaman.' }
  if (!shiftExists) return { error: 'Shift piket belum tersedia. Coba simpan pengaturan shift dulu.' }

  // Check unique
  const exist = await db.prepare('SELECT id FROM jadwal_guru_piket WHERE user_id = ? AND hari = ? AND shift_id = ?').bind(user_id, hari, shift_id).first()
  if (exist) return { error: 'Guru ini sudah memiliki jadwal pada shift tersebut.' }

  const res = await dbInsert(db, 'jadwal_guru_piket', {
    user_id, hari, shift_id
  })

  if (res.error) return { error: res.error }

  revalidatePath('/dashboard/jadwal-piket')
  revalidatePath('/dashboard/penugasan')
  return { success: 'Jadwal ditambahkan.' }
}

export async function hapusJadwalPiket(id: string): Promise<{ error?: string, success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const db = await getDB()
  if (!(await checkFeatureAccess(db, user.id, 'jadwal-piket'))) {
    return { error: 'Tidak memiliki akses' }
  }

  // Bersihkan relasi turunan lebih dulu agar tidak bergantung penuh pada
  // cascade FK di environment yang schema PU-nya belum lengkap.
  await db.prepare('DELETE FROM agenda_piket WHERE jadwal_id = ?').bind(id).run()
  await db.prepare('DELETE FROM guru_ppl_mapping WHERE jadwal_piket_id = ?').bind(id).run()

  const res = await dbDelete(db, 'jadwal_guru_piket', { id })
  if (res.error) return { error: res.error }

  revalidatePath('/dashboard/jadwal-piket')
  revalidatePath('/dashboard/penugasan')
  revalidatePath('/dashboard/kelola-ppl')
  revalidatePath('/dashboard/agenda')
  return { success: 'Jadwal dihapus.' }
}

export async function simpanPengaturanShift(data: Array<{ id: number, jam_mulai: number, jam_selesai: number }>): Promise<{ error?: string, success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const db = await getDB()
  if (!(await checkFeatureAccess(db, user.id, 'jadwal-piket'))) {
    return { error: 'Tidak memiliki akses' }
  }

  await ensureDefaultShiftPiket(db)

  for (const s of data) {
    if (s.jam_mulai < 1 || s.jam_selesai < s.jam_mulai) return { error: 'Rentang jam tidak valid.' }
    await db.prepare('UPDATE pengaturan_shift_piket SET jam_mulai = ?, jam_selesai = ? WHERE id = ?')
            .bind(s.jam_mulai, s.jam_selesai, s.id).run()
  }

  revalidatePath('/dashboard/jadwal-piket')
  revalidatePath('/dashboard/penugasan')
  return { success: 'Pengaturan shift disimpan.' }
}
