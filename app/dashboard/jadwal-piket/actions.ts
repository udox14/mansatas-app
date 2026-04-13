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

export async function getJadwalPiketData(): Promise<{
  shifts: ShiftPiket[]
  jadwal: JadwalPiket[]
}> {
  const db = await getDB()
  
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

  const res = await dbDelete(db, 'jadwal_guru_piket', { id })
  if (res.error) return { error: res.error }

  revalidatePath('/dashboard/jadwal-piket')
  revalidatePath('/dashboard/penugasan')
  return { success: 'Jadwal dihapus.' }
}

export async function simpanPengaturanShift(data: Array<{ id: number, jam_mulai: number, jam_selesai: number }>): Promise<{ error?: string, success?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }
  const db = await getDB()
  if (!(await checkFeatureAccess(db, user.id, 'jadwal-piket'))) {
    return { error: 'Tidak memiliki akses' }
  }

  for (const s of data) {
    if (s.jam_mulai < 1 || s.jam_selesai < s.jam_mulai) return { error: 'Rentang jam tidak valid.' }
    await db.prepare('UPDATE pengaturan_shift_piket SET jam_mulai = ?, jam_selesai = ? WHERE id = ?')
            .bind(s.jam_mulai, s.jam_selesai, s.id).run()
  }

  revalidatePath('/dashboard/jadwal-piket')
  revalidatePath('/dashboard/penugasan')
  return { success: 'Pengaturan shift disimpan.' }
}
