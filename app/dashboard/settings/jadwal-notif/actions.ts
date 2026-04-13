'use server'

import { getDB, dbInsert, dbUpdate } from '@/utils/db'
import { getCurrentUser } from '@/utils/auth/server'
import { checkFeatureAccess } from '@/lib/features'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', user: null, db: null }
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'settings-notifications')
  if (!allowed) return { error: 'Tidak ada akses.', user: null, db: null }
  return { error: null, user, db }
}

// ============================================================
// GET — Ambil semua jadwal notifikasi
// ============================================================
export async function getJadwalNotifikasi() {
  const { error, db } = await assertAdmin()
  if (error || !db) return []
  const res = await db.prepare('SELECT * FROM jadwal_notifikasi ORDER BY jam ASC, nama ASC').all<any>()
  return res.results || []
}

// ============================================================
// SIMPAN (create / update)
// ============================================================
export async function simpanJadwalNotifikasi(data: {
  id?: string
  nama: string
  judul: string
  isi: string
  url: string
  jam: string
  hari_aktif: number[]
  target_type: string
  target_role?: string
  target_user_ids?: string[]
  is_active: boolean
}) {
  const { error, db } = await assertAdmin()
  if (error || !db) return { error }

  const payload = {
    nama: data.nama,
    judul: data.judul,
    isi: data.isi,
    url: data.url || '/dashboard',
    jam: data.jam,
    hari_aktif: JSON.stringify(data.hari_aktif),
    target_type: data.target_type,
    target_role: data.target_role || null,
    target_user_ids: JSON.stringify(data.target_user_ids || []),
    is_active: data.is_active ? 1 : 0,
    updated_at: new Date().toISOString(),
  }

  if (data.id) {
    // Update existing
    const res = await dbUpdate(db, 'jadwal_notifikasi', payload, { id: data.id })
    if (res.error) return { error: res.error }
  } else {
    // Create new
    const res = await dbInsert(db, 'jadwal_notifikasi', payload)
    if (res.error) return { error: res.error }
  }

  revalidatePath('/dashboard/settings/jadwal-notif')
  return { success: data.id ? 'Jadwal berhasil diperbarui.' : 'Jadwal berhasil dibuat.' }
}

// ============================================================
// TOGGLE AKTIF / NONAKTIF
// ============================================================
export async function toggleJadwalNotifikasi(id: string, isActive: boolean) {
  const { error, db } = await assertAdmin()
  if (error || !db) return { error }
  await dbUpdate(db, 'jadwal_notifikasi', {
    is_active: isActive ? 1 : 0,
    updated_at: new Date().toISOString(),
  }, { id })
  revalidatePath('/dashboard/settings/jadwal-notif')
  return { success: `Jadwal ${isActive ? 'diaktifkan' : 'dinonaktifkan'}.` }
}

// ============================================================
// HAPUS
// ============================================================
export async function hapusJadwalNotifikasi(id: string) {
  const { error, db } = await assertAdmin()
  if (error || !db) return { error }
  await db.prepare('DELETE FROM jadwal_notifikasi WHERE id = ?').bind(id).run()
  revalidatePath('/dashboard/settings/jadwal-notif')
  return { success: 'Jadwal berhasil dihapus.' }
}

// ============================================================
// TEST KIRIM SEKARANG
// ============================================================
export async function testKirimJadwal(id: string) {
  const { error, db } = await assertAdmin()
  if (error || !db) return { error }

  const jadwal = await db.prepare('SELECT * FROM jadwal_notifikasi WHERE id = ?').bind(id).first<any>()
  if (!jadwal) return { error: 'Jadwal tidak ditemukan.' }

  const { sendPushNotification } = await import('@/lib/web-push')

  let target: any = {}
  if (jadwal.target_type === 'all') target.all = true
  else if (jadwal.target_type === 'role') target.role = jadwal.target_role
  else if (jadwal.target_type === 'guru') target.role = 'guru'
  else if (jadwal.target_type === 'custom') {
    try { target.userIds = JSON.parse(jadwal.target_user_ids || '[]') } catch { target.all = true }
  }

  try {
    const res = await sendPushNotification(
      { title: `[TEST] ${jadwal.judul}`, body: jadwal.isi, url: jadwal.url },
      target
    )
    return { success: `Test berhasil dikirim ke ${res.sent || 0} perangkat.` }
  } catch (e: any) {
    return { error: `Gagal mengirim: ${e.message}` }
  }
}
